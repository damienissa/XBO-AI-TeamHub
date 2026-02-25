"use client";

import { useState, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState, parseAsString } from "nuqs";
import { createTicket } from "@/lib/api/tickets";
import { getDepartments } from "@/lib/api/client";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  slug: string;
  name: string;
}

export function QuickAddInput() {
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // nuqs URL state — opens the ticket detail modal after creation (DETAIL-01)
  const [, setTicketId] = useQueryState("ticket", parseAsString);

  // Fetch departments for the select dropdown
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: getDepartments,
    staleTime: 60_000,
  });

  async function handleSubmit() {
    if (!title.trim() || !departmentId) {
      setError("Title and department required");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const newTicket = await createTicket({
        title: title.trim(),
        department_id: departmentId,
      });

      // Refresh the board to show the new ticket
      await queryClient.invalidateQueries({ queryKey: ["board"] });

      // Open the detail modal immediately (CONTEXT.md locked decision)
      setTicketId(newTicket.id);

      // Reset inputs
      setTitle("");
      setDepartmentId("");
    } catch {
      setError("Failed to create ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSubmit();
    }
  }

  return (
    <div className="mb-3">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a ticket..."
          disabled={isSubmitting}
          className={cn(
            "flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 disabled:opacity-50"
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          aria-label="Add ticket"
        >
          <Plus className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <select
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        disabled={isSubmitting}
        className="mt-1.5 w-full text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
      >
        <option value="">Select department...</option>
        {departments?.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
