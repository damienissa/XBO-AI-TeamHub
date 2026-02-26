"use client";
import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SubtaskAiModalProps {
  ticketId: string;
  open: boolean;
  initialSubtasks: string[];
  onClose: () => void;
}

async function saveSubtask(ticketId: string, title: string) {
  const res = await fetch(`${API}/api/tickets/${ticketId}/subtasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to save subtask");
}

export function SubtaskAiModal({ ticketId, open, initialSubtasks, onClose }: SubtaskAiModalProps) {
  const [items, setItems] = useState<string[]>(initialSubtasks);
  const [newItem, setNewItem] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync items whenever the modal opens with fresh AI subtasks
  useEffect(() => {
    if (open) {
      setItems(initialSubtasks);
    }
  }, [open, initialSubtasks]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((t) => t.trim());
      for (const title of validItems) {
        await saveSubtask(ticketId, title.trim());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      onClose();
      toast({ title: `${items.filter(t => t.trim()).length} subtasks added` });
    },
    onError: (err) => {
      toast({
        title: "Failed to save subtasks",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    if (newItem.trim()) {
      setItems((prev) => [...prev, newItem.trim()]);
      setNewItem("");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-slate-800">
              AI-Generated Subtasks
            </Dialog.Title>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Edit, delete, or add subtasks below. Click Save to append them to the ticket.
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateItem(i, e.target.value)}
                  className="flex-1 text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="text-slate-400 hover:text-red-500 flex-shrink-0"
                  aria-label="Remove subtask"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Add another subtask…"
              className="flex-1 text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <button
              onClick={addItem}
              className="flex-shrink-0 p-1.5 rounded hover:bg-slate-100 text-slate-500"
              aria-label="Add subtask"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || items.filter(t => t.trim()).length === 0}
              className="px-3 py-1.5 text-sm rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : (
                `Save ${items.filter(t => t.trim()).length} subtask${items.filter(t => t.trim()).length !== 1 ? "s" : ""}`
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
