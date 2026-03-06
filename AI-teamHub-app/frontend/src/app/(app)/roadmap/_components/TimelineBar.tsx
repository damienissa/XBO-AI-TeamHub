"use client";

import { parseISO, differenceInCalendarDays, format } from "date-fns";
import { useQueryState, parseAsString } from "nuqs";
import tippy from "tippy.js";
import { useRef, useEffect } from "react";
import { Ticket } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Backlog:       { bg: "#F3F3F1", text: "#73726E" },
  Discovery:     { bg: "#F5F0FB", text: "#7D3C98" },
  "In Progress": { bg: "#FEF9F0", text: "#A04000" },
  "Review/QA":   { bg: "#EEF4FD", text: "#1A5276" },
  Done:          { bg: "#EBF7EE", text: "#1E8449" },
};

const PRIORITY_BORDER: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#94A3B8",
};

interface TimelineBarProps {
  ticket: Ticket;
  left: number;
  width: number;
  top: number;
}

export function TimelineBar({ ticket, left, width, top }: TimelineBarProps) {
  const [, setTicketId] = useQueryState("ticket", parseAsString);
  const barRef = useRef<HTMLDivElement>(null);

  const colors = STATUS_COLORS[ticket.status_column] ?? STATUS_COLORS.Backlog;
  const priorityBorder = ticket.priority
    ? PRIORITY_BORDER[ticket.priority]
    : "#CBD5E1";

  const isOverdue =
    ticket.due_date &&
    differenceInCalendarDays(new Date(), parseISO(ticket.due_date)) > 0 &&
    ticket.status_column !== "Done";

  useEffect(() => {
    if (!barRef.current) return;
    const instance = tippy(barRef.current, {
      content: [
        ticket.title,
        ticket.owner ? `Owner: ${ticket.owner.full_name}` : "Unassigned",
        `Status: ${ticket.status_column}`,
        ticket.priority ? `Priority: ${ticket.priority}` : null,
        ticket.due_date
          ? `Due: ${format(parseISO(ticket.due_date), "MMM d, yyyy")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      allowHTML: false,
      placement: "top",
      delay: [300, 0],
      theme: "light-border",
    });
    return () => instance.destroy();
  }, [ticket]);

  return (
    <div
      ref={barRef}
      className={cn(
        "absolute rounded cursor-pointer transition-shadow hover:shadow-md",
        "flex items-center px-2 overflow-hidden select-none",
        isOverdue && "ring-1 ring-red-400"
      )}
      style={{
        left,
        top,
        width: Math.max(width, 30),
        height: 28,
        background: colors.bg,
        color: colors.text,
        borderLeft: `3px solid ${priorityBorder}`,
      }}
      onClick={() => setTicketId(ticket.id)}
    >
      <span className="text-xs font-medium truncate">{ticket.title}</span>
    </div>
  );
}
