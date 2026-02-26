"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, ArrowLeft } from "lucide-react";
import { TiptapEditor } from "../../board/_components/TiptapEditor";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const API = process.env.NEXT_PUBLIC_API_URL;

interface WikiPage {
  id: string;
  title: string;
  content: object | null;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function WikiPageDetailPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { data: page, isLoading } = useQuery<WikiPage>({
    queryKey: ["wiki-page", pageId],
    queryFn: async () => {
      const r = await fetch(`${API}/api/wiki/${pageId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  const updatePage = useMutation({
    mutationFn: async (update: Partial<Pick<WikiPage, "title" | "content">>) => {
      await fetch(`${API}/api/wiki/${pageId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki-page", pageId] }),
  });

  const deletePage = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/wiki/${pageId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw Object.assign(new Error("Delete failed"), { status: r.status, body });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-pages"] });
      router.push("/wiki");
    },
    onError: (err: unknown) => {
      const e = err as { status?: number };
      if (e.status === 403) {
        toast({
          title: "Admin access required to delete pages",
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to delete page", variant: "destructive" });
      }
    },
  });

  if (isLoading) return <div className="p-6 text-slate-400">Loading...</div>;
  if (!page) return <div className="p-6 text-slate-500">Page not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <a href="/wiki" className="text-slate-400 hover:text-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </a>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (titleDraft.trim() && titleDraft !== page.title) {
                updatePage.mutate({ title: titleDraft.trim() });
              }
              setEditingTitle(false);
            }}
            onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="text-2xl font-bold text-slate-800 border-b border-slate-300 focus:outline-none bg-transparent flex-1"
          />
        ) : (
          <h1
            className="text-2xl font-bold text-slate-800 flex-1 cursor-text hover:bg-slate-50 rounded px-1 -mx-1"
            onClick={() => { setTitleDraft(page.title); setEditingTitle(true); }}
          >
            {page.title}
          </h1>
        )}
        <button
          onClick={() => {
            if (confirm(`Delete "${page.title}"? Child pages will become top-level pages.`)) {
              deletePage.mutate();
            }
          }}
          className="text-slate-400 hover:text-red-600 p-1.5 rounded"
          title="Delete page (admin only)"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Last updated {format(new Date(page.updated_at), "MMM d, yyyy 'at' h:mm a")}
      </p>

      {/* Tiptap editor — reuse existing component with immediatelyRender:false */}
      <div className="min-h-[300px] border border-slate-200 rounded-lg p-4 bg-white">
        <TiptapEditor
          initialContent={page.content}
          onSave={(content) => updatePage.mutate({ content })}
          editable={true}
        />
      </div>
    </div>
  );
}
