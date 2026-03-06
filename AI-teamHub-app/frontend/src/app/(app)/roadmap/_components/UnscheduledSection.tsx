"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";
import { Ticket } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

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

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

interface UnscheduledSectionProps {
  tickets: Ticket[];
}

export function UnscheduledSection({ tickets }: UnscheduledSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [, setTicketId] = useQueryState("ticket", parseAsString);

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{ borderColor: "#E9E9E6", background: "#FAFAF9" }}
    >
      <button
        className="flex items-center gap-2 px-4 py-2.5 w-full text-left hover:bg-black/5 transition-colors"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        {collapsed ? (
          <ChevronRight size={14} style={{ color: "#73726E" }} />
        ) : (
          <ChevronDown size={14} style={{ color: "#73726E" }} />
        )}
        <span className="text-xs font-medium" style={{ color: "#37352F" }}>
          Unscheduled
        </span>
        <span
          className="text-xs rounded-full px-1.5 py-0.5"
          style={{ background: "#E9E9E6", color: "#73726E" }}
        >
          {tickets.length}
        </span>
      </button>

      {!collapsed && (
        <div className="flex gap-3 px-4 pb-3 overflow-x-auto">
          {tickets.map((ticket) => {
            const deptSlug =
              ticket.department?.slug?.toLowerCase() ?? "default";
            const deptColor = DEPT_COLORS[deptSlug] ?? DEPT_COLORS.default;
            const priorityColor = ticket.priority
              ? PRIORITY_COLORS[ticket.priority]
              : null;

            return (
              <div
                key={ticket.id}
                className="flex-shrink-0 rounded-lg border bg-white p-3 cursor-pointer hover:shadow-sm transition-shadow"
                style={{ width: 220, borderColor: "#E9E9E6" }}
                onClick={() => setTicketId(ticket.id)}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      deptColor
                    )}
                  >
                    {ticket.department?.name}
                  </span>
                  {priorityColor && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        priorityColor
                      )}
                    >
                      {ticket.priority}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs font-medium line-clamp-2 mb-1"
                  style={{ color: "#37352F" }}
                >
                  {ticket.title}
                </p>
                <div className="flex items-center justify-between">
                  {ticket.owner ? (
                    <span className="text-[10px]" style={{ color: "#9B9A97" }}>
                      {ticket.owner.full_name}
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "#CFCDC9" }}>
                      Unassigned
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "#9B9A97" }}>
                    {format(parseISO(ticket.created_at), "MMM d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
