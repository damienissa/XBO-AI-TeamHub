"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryState, parseAsString } from "nuqs";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { X } from "lucide-react";
import { useTicketDetail } from "@/hooks/useTicketDetail";
import { fetchUsers, Priority, StatusColumn } from "@/lib/api/tickets";
import { TiptapEditor } from "./TiptapEditor";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "use-debounce";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

const STATUS_BADGE: Record<StatusColumn, string> = {
  Backlog: "bg-slate-100 text-slate-700",
  Discovery: "bg-blue-100 text-blue-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  "Review/QA": "bg-purple-100 text-purple-700",
  Done: "bg-green-100 text-green-700",
};

function safeFormatDistanceToNow(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function safeFormat(dateStr: string | null, fmt: string): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

// ---- TicketDetailContent --------------------------------------------------

interface TicketDetailContentProps {
  ticketId: string;
  onClose: () => void;
}

function TicketDetailContent({ ticketId, onClose }: TicketDetailContentProps) {
  const { ticketQuery, eventsQuery, historyQuery, updateMutation } = useTicketDetail(ticketId);

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  // Local edit-mode state per field
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [editingOwner, setEditingOwner] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingUrgency, setEditingUrgency] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editingEffort, setEditingEffort] = useState(false);

  // Debounced save for plain textarea fields
  const debouncedSaveNextStep = useDebouncedCallback(
    (value: string) => updateMutation.mutate({ next_step: value }),
    1000
  );
  const debouncedSaveBusinessImpact = useDebouncedCallback(
    (value: string) => updateMutation.mutate({ business_impact: value }),
    1000
  );
  const debouncedSaveSuccessCriteria = useDebouncedCallback(
    (value: string) => updateMutation.mutate({ success_criteria: value }),
    1000
  );

  if (ticketQuery.isPending) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-32 bg-slate-200 rounded" />
        <div className="h-24 bg-slate-200 rounded" />
      </div>
    );
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load ticket. Please try again.</p>
      </div>
    );
  }

  const ticket = ticketQuery.data;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-6 border-b border-slate-200 flex-shrink-0">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (titleDraft.trim() && titleDraft !== ticket.title) {
                  updateMutation.mutate({ title: titleDraft.trim() });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setEditingTitle(false);
                }
              }}
              className="w-full text-xl font-semibold text-slate-900 border-b-2 border-slate-400 focus:outline-none bg-transparent"
            />
          ) : (
            <h2
              className="text-xl font-semibold text-slate-900 cursor-pointer hover:text-slate-700 truncate"
              onClick={() => {
                setTitleDraft(ticket.title);
                setEditingTitle(true);
              }}
              title="Click to edit title"
            >
              {ticket.title}
            </h2>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Status + Owner bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_BADGE[ticket.status_column]
            )}
          >
            {ticket.status_column}
          </span>

          <span className="text-slate-300">|</span>

          {/* Owner selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Owner:</span>
            {editingOwner ? (
              <select
                autoFocus
                defaultValue={ticket.owner_id ?? ""}
                onChange={(e) => {
                  setEditingOwner(false);
                  updateMutation.mutate({ owner_id: e.target.value || null });
                }}
                onBlur={() => setEditingOwner(false)}
                className="text-sm border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditingOwner(true)}
                className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
              >
                {ticket.owner?.full_name ?? "Unassigned"}
              </button>
            )}
          </div>

          <span className="text-slate-300">|</span>

          {/* Department badge */}
          <span className="text-xs text-slate-500">
            {ticket.department?.name ?? ticket.department_id}
          </span>
        </div>

        {/* Metadata grid (DETAIL-04) */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
          {/* Priority */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Priority</span>
            {editingPriority ? (
              <select
                autoFocus
                defaultValue={ticket.priority ?? ""}
                onChange={(e) => {
                  setEditingPriority(false);
                  updateMutation.mutate({ priority: (e.target.value as Priority) || null });
                }}
                onBlur={() => setEditingPriority(false)}
                className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">None</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditingPriority(true)}
                className="flex items-start"
              >
                {ticket.priority ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize hover:opacity-80",
                      PRIORITY_BADGE[ticket.priority]
                    )}
                  >
                    {ticket.priority}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 hover:text-slate-600">Not set</span>
                )}
              </button>
            )}
          </div>

          {/* Urgency */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Urgency (1–5)</span>
            {editingUrgency ? (
              <input
                autoFocus
                type="number"
                min={1}
                max={5}
                defaultValue={ticket.urgency ?? ""}
                onBlur={(e) => {
                  setEditingUrgency(false);
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  updateMutation.mutate({ urgency: val });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingUrgency(false);
                }}
                className="w-20 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            ) : (
              <button
                onClick={() => setEditingUrgency(true)}
                className="text-sm text-left text-slate-700 hover:text-slate-900 hover:underline"
              >
                {ticket.urgency !== null ? ticket.urgency : <span className="text-slate-400">Not set</span>}
              </button>
            )}
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</span>
            {editingDueDate ? (
              <input
                autoFocus
                type="date"
                defaultValue={ticket.due_date ? ticket.due_date.slice(0, 10) : ""}
                onBlur={(e) => {
                  setEditingDueDate(false);
                  updateMutation.mutate({ due_date: e.target.value || null });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingDueDate(false);
                }}
                className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            ) : (
              <button
                onClick={() => setEditingDueDate(true)}
                className={cn(
                  "text-sm text-left hover:underline",
                  ticket.due_date && new Date(ticket.due_date) < new Date()
                    ? "text-red-500 font-medium"
                    : "text-slate-700 hover:text-slate-900"
                )}
              >
                {ticket.due_date ? safeFormat(ticket.due_date, "MMM d, yyyy") : <span className="text-slate-400">Not set</span>}
              </button>
            )}
          </div>

          {/* Effort estimate */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Effort (hours)</span>
            {editingEffort ? (
              <input
                autoFocus
                type="number"
                min={0}
                step={0.5}
                defaultValue={ticket.effort_estimate ?? ""}
                onBlur={(e) => {
                  setEditingEffort(false);
                  const val = e.target.value ? parseFloat(e.target.value) : null;
                  updateMutation.mutate({ effort_estimate: val });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingEffort(false);
                }}
                className="w-24 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            ) : (
              <button
                onClick={() => setEditingEffort(true)}
                className="text-sm text-left text-slate-700 hover:text-slate-900 hover:underline"
              >
                {ticket.effort_estimate !== null
                  ? ticket.effort_estimate >= 8
                    ? `${Math.round(ticket.effort_estimate / 8)}d`
                    : `${ticket.effort_estimate}h`
                  : <span className="text-slate-400">Not set</span>}
              </button>
            )}
          </div>
        </div>

        {/* Problem Statement — Tiptap rich text (DETAIL-03) */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Problem Statement</h3>
          <TiptapEditor
            initialContent={ticket.problem_statement}
            onSave={(json) => updateMutation.mutate({ problem_statement: json })}
          />
        </div>

        {/* Next Step */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Next Step</h3>
          <textarea
            defaultValue={ticket.next_step ?? ""}
            onChange={(e) => debouncedSaveNextStep(e.target.value)}
            onBlur={(e) => {
              debouncedSaveNextStep.flush();
              updateMutation.mutate({ next_step: e.target.value });
            }}
            rows={3}
            placeholder="What needs to happen next?"
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none placeholder:text-slate-400"
          />
        </div>

        {/* Business Impact */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Business Impact</h3>
          <textarea
            defaultValue={ticket.business_impact ?? ""}
            onChange={(e) => debouncedSaveBusinessImpact(e.target.value)}
            onBlur={(e) => {
              debouncedSaveBusinessImpact.flush();
              updateMutation.mutate({ business_impact: e.target.value });
            }}
            rows={3}
            placeholder="What is the business impact?"
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none placeholder:text-slate-400"
          />
        </div>

        {/* Success Criteria */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Success Criteria</h3>
          <textarea
            defaultValue={ticket.success_criteria ?? ""}
            onChange={(e) => debouncedSaveSuccessCriteria(e.target.value)}
            onBlur={(e) => {
              debouncedSaveSuccessCriteria.flush();
              updateMutation.mutate({ success_criteria: e.target.value });
            }}
            rows={3}
            placeholder="How do we know this is done?"
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none placeholder:text-slate-400"
          />
        </div>

        {/* Activity Timeline (DETAIL-05) */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">Activity Timeline</h3>
          {eventsQuery.isPending ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {[...eventsQuery.data]
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((event) => {
                  const actor = event.actor_id ? `user ${event.actor_id.slice(0, 6)}` : "system";
                  let description = "";
                  if (event.event_type === "created") {
                    description = `Ticket created by ${actor}`;
                  } else if (event.event_type === "moved") {
                    const payload = event.payload as { from?: string; to?: string };
                    description = `Moved from ${payload.from ?? "?"} to ${payload.to ?? "?"} by ${actor}`;
                  } else if (event.event_type === "assigned") {
                    const payload = event.payload as { owner_name?: string };
                    description = `Assigned to ${payload.owner_name ?? "someone"} by ${actor}`;
                  } else if (event.event_type === "edited") {
                    const payload = event.payload as { fields?: string[] };
                    const fields = payload.fields?.join(", ") ?? "fields";
                    description = `Fields updated by ${actor}: ${fields}`;
                  }

                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">{description}</p>
                        <p className="text-xs text-slate-400">
                          {safeFormatDistanceToNow(event.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No activity yet.</p>
          )}
        </div>

        {/* Column History (DETAIL-06) */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">Column History</h3>
          {historyQuery.isPending ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : historyQuery.data && historyQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="pb-2 pr-4 font-medium">Column</th>
                    <th className="pb-2 pr-4 font-medium">Entered</th>
                    <th className="pb-2 pr-4 font-medium">Exited</th>
                    <th className="pb-2 font-medium">Time Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyQuery.data.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4 text-slate-700 font-medium">{entry.column}</td>
                      <td className="py-2 pr-4 text-slate-500">
                        {safeFormat(entry.entered_at, "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">
                        {entry.exited_at ? safeFormat(entry.exited_at, "MMM d, yyyy HH:mm") : "Still here"}
                      </td>
                      <td className="py-2 text-slate-500">{entry.time_spent ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No column history yet.</p>
          )}
        </div>

        {/* Save indicator */}
        {updateMutation.isPending && (
          <p className="text-xs text-slate-400 text-right">Saving...</p>
        )}
      </div>
    </div>
  );
}

// ---- TicketDetailModal (root export) --------------------------------------

export function TicketDetailModal() {
  const [ticketId, setTicketId] = useQueryState("ticket", parseAsString);

  return (
    <Dialog.Root open={!!ticketId} onOpenChange={(open) => !open && setTicketId(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Ticket Detail</Dialog.Title>
          {ticketId && (
            <TicketDetailContent
              ticketId={ticketId}
              onClose={() => setTicketId(null)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
