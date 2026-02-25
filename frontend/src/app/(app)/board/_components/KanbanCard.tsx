"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { useQueryState, parseAsString } from "nuqs";
import { Ticket } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  ticket: Ticket;
  isOverlay?: boolean;
}

// Department slug to color map for consistent badge colors
const DEPT_COLORS: Record<string, string> = {
  engineering: "bg-blue-100 text-blue-800",
  design: "bg-purple-100 text-purple-800",
  marketing: "bg-pink-100 text-pink-800",
  sales: "bg-green-100 text-green-800",
  operations: "bg-orange-100 text-orange-800",
  finance: "bg-yellow-100 text-yellow-800",
  hr: "bg-teal-100 text-teal-800",
  legal: "bg-red-100 text-red-800",
  product: "bg-indigo-100 text-indigo-800",
  default: "bg-slate-100 text-slate-800",
};

// Priority badge colors
const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

// Urgency to left border color (CONTEXT.md locked decision)
function getUrgencyBorderClass(urgency: number | null): string {
  if (urgency === null) return "border-l-slate-300";
  if (urgency >= 4) return "border-l-red-500";
  if (urgency >= 3) return "border-l-orange-400";
  if (urgency >= 2) return "border-l-blue-400";
  return "border-l-slate-300";
}

// Format effort estimate: hours → "2h" or "1d"
function formatEffort(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours >= 8) return `${Math.round(hours / 8)}d`;
  return `${hours}h`;
}

// Get owner initials from full name
function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function KanbanCard({ ticket, isOverlay = false }: KanbanCardProps) {
  // DragOverlay children must NOT use useDraggable (anti-pattern)
  const draggable = isOverlay
    ? { attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useDraggable({ id: ticket.id, data: ticket });

  const { attributes, listeners, setNodeRef, transform, isDragging } = draggable;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [, setTicketId] = isOverlay ? [null, () => {}] : useQueryState("ticket", parseAsString);

  const style = transform
    ? { transform: CSS.Transform.toString(transform) }
    : undefined;

  const deptSlug = ticket.department?.slug?.toLowerCase() ?? "default";
  const deptColor = DEPT_COLORS[deptSlug] ?? DEPT_COLORS.default;
  const priorityColor = ticket.priority ? PRIORITY_COLORS[ticket.priority] : null;
  const effortText = formatEffort(ticket.effort_estimate);
  const urgencyBorderClass = getUrgencyBorderClass(ticket.urgency);

  const isPastDue = ticket.due_date
    ? new Date(ticket.due_date) < new Date()
    : false;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={() => {
        if (!isOverlay) setTicketId(ticket.id);
      }}
      className={cn(
        "bg-white rounded-md shadow-sm border border-slate-200 border-l-4 p-3 cursor-grab active:cursor-grabbing select-none",
        urgencyBorderClass,
        isDragging && "opacity-50"
      )}
    >
      {/* Top row: department badge + priority badge */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            deptColor
          )}
        >
          {ticket.department?.name ?? ticket.department_id}
        </span>
        {priorityColor && ticket.priority && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              priorityColor
            )}
          >
            {ticket.priority}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-2">
        {ticket.title}
      </p>

      {/* Business impact snippet (BOARD-04) */}
      {ticket.business_impact && (
        <p className="text-xs text-slate-400 truncate mb-2">
          {ticket.business_impact}
        </p>
      )}

      {/* Next step */}
      {ticket.next_step && (
        <p className="text-xs text-slate-400 truncate mb-2">
          Next: {ticket.next_step}
        </p>
      )}

      {/* Bottom row: owner, due date, effort */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {/* Owner initials avatar */}
          {ticket.owner ? (
            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {getInitials(ticket.owner.full_name)}
              </span>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex-shrink-0" />
          )}

          {/* Due date */}
          {ticket.due_date && (
            <span
              className={cn(
                "text-xs",
                isPastDue ? "text-red-500 font-medium" : "text-slate-500"
              )}
            >
              {format(parseISO(ticket.due_date), "MMM d")}
            </span>
          )}

          {/* Effort estimate */}
          {effortText && (
            <span className="text-xs text-slate-400">{effortText}</span>
          )}
        </div>
      </div>

      {/* Time in column (BOARD-04) */}
      {ticket.time_in_column && (
        <p className="text-xs text-slate-400 mt-1.5">{ticket.time_in_column}</p>
      )}
    </div>
  );
}
