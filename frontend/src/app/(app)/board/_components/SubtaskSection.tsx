"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { fetchSubtasks as fetchAiSubtasks } from "@/lib/api/ai";
import { useToast } from "@/hooks/use-toast";
import { SubtaskAiModal } from "./SubtaskAiModal";

const API = process.env.NEXT_PUBLIC_API_URL;

export interface Subtask {
  id: string;
  ticket_id: string;
  title: string;
  done: boolean;
  position: number;
}

interface SubtaskSectionProps {
  ticketId: string;
  ticketContext: {
    title: string;
    problem_statement?: string | null;
    business_impact?: string | null;
    urgency?: number | null;
  };
}

// ---- API helpers -----------------------------------------------------------

async function fetchSubtasks(ticketId: string): Promise<Subtask[]> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/subtasks`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch subtasks");
  return res.json();
}

async function createSubtask(ticketId: string, title: string): Promise<Subtask> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/subtasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create subtask");
  return res.json();
}

async function toggleSubtask(ticketId: string, subtaskId: string, done: boolean): Promise<Subtask> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/subtasks/${subtaskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ done }),
  });
  if (!res.ok) throw new Error("Failed to toggle subtask");
  return res.json();
}

async function deleteSubtask(ticketId: string, subtaskId: string): Promise<void> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/subtasks/${subtaskId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete subtask");
}

async function reorderSubtasks(ticketId: string, orderedIds: string[]): Promise<Subtask[]> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/subtasks/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder subtasks");
  return res.json();
}

// ---- SortableSubtaskItem ---------------------------------------------------

interface SortableSubtaskItemProps {
  subtask: Subtask;
  onToggle: (subtaskId: string, done: boolean) => void;
  onDelete: (subtaskId: string) => void;
}

function SortableSubtaskItem({ subtask, onToggle, onDelete }: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 group py-1.5 px-1 rounded hover:bg-slate-50",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-300 hover:text-slate-500 flex-shrink-0 focus:outline-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={(e) => onToggle(subtask.id, e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-green-600 cursor-pointer flex-shrink-0"
      />

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-sm",
          subtask.done ? "line-through text-slate-400" : "text-slate-700"
        )}
      >
        {subtask.title}
      </span>

      {/* Delete button */}
      <button
        onClick={() => onDelete(subtask.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 transition-opacity"
        aria-label="Delete subtask"
      >
        <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
      </button>
    </div>
  );
}

// ---- SubtaskSection --------------------------------------------------------

export function SubtaskSection({ ticketId, ticketContext }: SubtaskSectionProps) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSubtasks, setAiSubtasks] = useState<string[]>([]);
  const aiEnabled = useAiEnabled();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: subtasks = [], isLoading } = useQuery<Subtask[]>({
    queryKey: ["subtasks", ticketId],
    queryFn: () => fetchSubtasks(ticketId),
    enabled: !!ticketId,
  });

  const addMutation = useMutation({
    mutationFn: (title: string) => createSubtask(ticketId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ subtaskId, done }: { subtaskId: string; done: boolean }) =>
      toggleSubtask(ticketId, subtaskId, done),
    onMutate: async ({ subtaskId, done }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["subtasks", ticketId] });
      const previous = queryClient.getQueryData<Subtask[]>(["subtasks", ticketId]);
      queryClient.setQueryData<Subtask[]>(["subtasks", ticketId], (old = []) =>
        old.map((s) => (s.id === subtaskId ? { ...s, done } : s))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["subtasks", ticketId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (subtaskId: string) => deleteSubtask(ticketId, subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => fetchAiSubtasks({
      title: ticketContext.title,
      problem_statement: ticketContext.problem_statement as string | null | undefined,
      business_impact: ticketContext.business_impact,
      urgency: ticketContext.urgency,
      existing_subtasks: subtasks.map(s => s.title),
    }),
    onSuccess: (data) => {
      setAiSubtasks(data.subtasks);
      setAiModalOpen(true);
    },
    onError: (err) => {
      toast({
        title: "AI request failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && newTitle.trim()) {
      addMutation.mutate(newTitle.trim());
      setNewTitle("");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(subtasks, oldIndex, newIndex);

    // Optimistic local update
    queryClient.setQueryData<Subtask[]>(["subtasks", ticketId], reordered);

    // Persist to server — always refetch after to confirm saved order
    reorderSubtasks(ticketId, reordered.map((s) => s.id))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["subtasks", ticketId] });
      })
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: ["subtasks", ticketId] });
      });
  }

  const doneCount = subtasks.filter((s) => s.done).length;
  const totalCount = subtasks.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-slate-700">Subtasks</h3>
        {totalCount > 0 && (
          <span
            className={cn(
              "inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium",
              doneCount === totalCount
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {doneCount}/{totalCount}
          </span>
        )}
        {aiEnabled && (
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Generate with AI</>
            )}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-7 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subtasks.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {subtasks.map((subtask) => (
                <SortableSubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={(id, done) => toggleMutation.mutate({ subtaskId: id, done })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Inline add input */}
      <input
        ref={inputRef}
        type="text"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a subtask… (press Enter)"
        className="w-full text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
        disabled={addMutation.isPending}
      />

      <SubtaskAiModal
        ticketId={ticketId}
        open={aiModalOpen}
        initialSubtasks={aiSubtasks}
        onClose={() => setAiModalOpen(false)}
      />
    </div>
  );
}
