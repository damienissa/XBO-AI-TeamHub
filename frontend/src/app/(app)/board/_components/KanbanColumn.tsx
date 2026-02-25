"use client";

import { useDroppable } from "@dnd-kit/core";
import { StatusColumn, Ticket } from "@/lib/api/tickets";
import { KanbanCard } from "./KanbanCard";
import { QuickAddInput } from "./QuickAddInput";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  column: StatusColumn;
  tickets: Ticket[];
  showQuickAdd?: boolean;
}

export function KanbanColumn({ column, tickets, showQuickAdd }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-slate-700">{column}</h2>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
          {tickets.length}
        </span>
      </div>

      {/* Column body — droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-lg p-2 min-h-[200px] transition-colors",
          isOver ? "bg-slate-100" : "bg-slate-50"
        )}
      >
        {showQuickAdd && <QuickAddInput />}
        <div className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <KanbanCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </div>
    </div>
  );
}
