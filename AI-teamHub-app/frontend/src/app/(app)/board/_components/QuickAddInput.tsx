"use client";

import { useState, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState, parseAsString } from "nuqs";
import { createTicket } from "@/lib/api/tickets";
import { getDepartments } from "@/lib/api/client";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Department {
  id: string;
  slug: string;
  name: string;
}

interface Template {
  id: string;
  title: string;
  problem_statement: object | null;
  default_urgency: number | null;
  default_effort_estimate: number | null;
  default_next_step: string | null;
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${API}/api/templates`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export function QuickAddInput() {
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
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

  // Fetch templates for the "Use template" selector
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
    staleTime: 30_000,
  });

  function handleTemplateSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);

    if (!templateId) {
      // Cleared — reset to blank
      setTitle("");
      return;
    }

    const template = templates?.find((t) => t.id === templateId);
    if (!template) return;

    if (template.title) {
      setTitle(template.title);
    }
  }

  function handleClearTemplate() {
    setSelectedTemplateId("");
    setTitle("");
  }

  async function handleSubmit() {
    if (!title.trim() || !departmentId) {
      setError("Title and department required");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const template = selectedTemplateId
        ? templates?.find((t) => t.id === selectedTemplateId)
        : undefined;

      const newTicket = await createTicket({
        title: title.trim(),
        department_id: departmentId,
        ...(template && {
          problem_statement: template.problem_statement,
          urgency: template.default_urgency,
          effort_estimate: template.default_effort_estimate,
          next_step: template.default_next_step,
        }),
      });

      // Refresh the board to show the new ticket
      await queryClient.invalidateQueries({ queryKey: ["board"] });

      // Open the detail modal immediately (CONTEXT.md locked decision)
      setTicketId(newTicket.id);

      // Reset inputs
      setTitle("");
      setDepartmentId("");
      setSelectedTemplateId("");
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

  const hasTemplates = templates && templates.length > 0;

  return (
    <div className="mb-3">
      {/* Template selector — shown only when templates exist */}
      {hasTemplates && (
        <div className="mb-1.5 flex items-center gap-1">
          <select
            value={selectedTemplateId}
            onChange={handleTemplateSelect}
            disabled={isSubmitting}
            className="flex-1 text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
          >
            <option value="">Use template (optional)...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={handleClearTemplate}
              disabled={isSubmitting}
              className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              aria-label="Clear template"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

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
