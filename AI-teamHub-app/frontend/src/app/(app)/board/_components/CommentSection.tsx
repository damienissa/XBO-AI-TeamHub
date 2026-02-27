"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchMe, fetchUsers } from "@/lib/api/tickets";
import { TiptapEditor } from "./TiptapEditor";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
}

interface CommentSectionProps {
  ticketId: string;
}

// ---- API helpers -----------------------------------------------------------

async function fetchComments(ticketId: string): Promise<Comment[]> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/comments`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

async function createComment(ticketId: string, body: string): Promise<Comment> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error("Failed to post comment");
  return res.json();
}

async function deleteComment(ticketId: string, commentId: string): Promise<void> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/comments/${commentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete comment");
}

// ---- Avatar helper ---------------------------------------------------------

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-amber-500",
];

function getAvatarColor(authorId: string): string {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = (hash * 31 + authorId.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

function safeRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// ---- Render comment body (JSON TipTap doc or plain string) -----------------

function renderCommentBody(body: string): React.ReactNode {
  try {
    const doc = JSON.parse(body);
    return <TiptapEditorReadOnly content={doc} />;
  } catch {
    return (
      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words" style={{ color: "#37352F" }}>
        {body}
      </p>
    );
  }
}

function TiptapEditorReadOnly({ content }: { content: object }) {
  return (
    <div className="text-sm mt-0.5">
      {/* Lazy import to keep bundle light — just render with TiptapEditor editable=false */}
      <TiptapEditor initialContent={content} onSave={() => {}} editable={false} />
    </div>
  );
}

// ---- CommentSection --------------------------------------------------------

export function CommentSection({ ticketId }: CommentSectionProps) {
  const queryClient = useQueryClient();
  const [commentContent, setCommentContent] = useState<object | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["comments", ticketId],
    queryFn: () => fetchComments(ticketId),
    enabled: !!ticketId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (body: string) => createComment(ticketId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
      setCommentContent(null);
      setResetKey((k) => k + 1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(ticketId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
    },
  });

  function handleSubmit() {
    if (!commentContent) return;
    addMutation.mutate(JSON.stringify(commentContent));
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium" style={{ color: "#37352F" }}>Comments</h3>

      {/* Comment list */}
      {commentsLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2.5 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-1/3" />
                <div className="h-10 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm" style={{ color: "#B8B7B3" }}>No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const canDelete =
              currentUser &&
              (currentUser.id === comment.author_id || currentUser.role === "admin");

            return (
              <div key={comment.id} className="flex gap-2.5 group">
                {/* Author avatar */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold",
                    getAvatarColor(comment.author_id)
                  )}
                >
                  {getInitials(comment.author_name)}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Author name + timestamp */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: "#37352F" }}>
                      {comment.author_name ?? "Unknown"}
                    </span>
                    <span className="text-xs" style={{ color: "#9B9A97" }}>
                      {safeRelativeTime(comment.created_at)}
                    </span>
                  </div>

                  {/* Comment body — supports TipTap JSON or plain string */}
                  {renderCommentBody(comment.body)}
                </div>

                {/* Delete button — author or admin only */}
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity self-start"
                        style={{ color: "#9B9A97" }}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5 hover:text-red-500" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone. The comment will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(comment.id)}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comment input */}
      <div className="space-y-2 pt-1">
        <TiptapEditor
          initialContent={null}
          onSave={setCommentContent}
          users={users}
          resetKey={resetKey}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!commentContent || addMutation.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: "#37352F" }}
            onMouseEnter={(e) => {
              if (!addMutation.isPending) (e.currentTarget as HTMLElement).style.background = "#2F2C29";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#37352F";
            }}
          >
            {addMutation.isPending ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
