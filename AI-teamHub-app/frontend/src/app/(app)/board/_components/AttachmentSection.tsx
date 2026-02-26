"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = process.env.NEXT_PUBLIC_API_URL;

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface Attachment {
  id: string;
  ticket_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

interface AttachmentSectionProps {
  ticketId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

async function fetchAttachments(ticketId: string): Promise<Attachment[]> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/attachments`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch attachments");
  return res.json();
}

async function uploadAttachment(ticketId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Upload failed");
  }
  return res.json();
}

async function deleteAttachment(ticketId: string, attachmentId: string): Promise<void> {
  const res = await fetch(
    `${API}/api/tickets/${ticketId}/attachments/${attachmentId}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to delete attachment");
}

async function downloadAttachment(ticketId: string, att: Attachment): Promise<void> {
  const res = await fetch(
    `${API}/api/tickets/${ticketId}/attachments/${att.id}/download`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AttachmentSection({ ticketId }: AttachmentSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ["attachments", ticketId],
    queryFn: () => fetchAttachments(ticketId),
    enabled: !!ticketId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(ticketId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", ticketId] });
    },
    onError: (err) => {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(ticketId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", ticketId] });
    },
    onError: (err) => {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, DOCX, TXT, or MD file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    uploadMutation.mutate(file, { onSettled: () => setUploading(false) });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-700">Attachments</h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-3 w-3" /> Upload file</>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/x-markdown"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-slate-400 py-1">No attachments yet. Upload a PDF, DOCX, TXT, or MD.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 group"
            >
              <Paperclip className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="flex-1 text-sm text-slate-700 truncate" title={att.filename}>
                {att.filename}
              </span>
              <span className="text-xs text-slate-400 flex-shrink-0">
                {formatBytes(att.size_bytes)}
              </span>
              <button
                onClick={async () => {
                  setDownloadingId(att.id);
                  try {
                    await downloadAttachment(ticketId, att);
                  } catch {
                    toast({ title: "Download failed", description: "Please try again.", variant: "destructive" });
                  } finally {
                    setDownloadingId(null);
                  }
                }}
                disabled={downloadingId === att.id}
                className="flex-shrink-0 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                aria-label="Download"
              >
                {downloadingId === att.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => deleteMutation.mutate(att.id)}
                disabled={deleteMutation.isPending}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-opacity disabled:opacity-50"
                aria-label="Delete attachment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
