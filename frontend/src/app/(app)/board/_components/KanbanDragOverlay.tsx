"use client";

import { DragOverlay } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import { Ticket } from "@/lib/api/tickets";

export function KanbanDragOverlay({ activeTicket }: { activeTicket: Ticket | null }) {
  return (
    <DragOverlay>
      {activeTicket ? <KanbanCard ticket={activeTicket} isOverlay /> : null}
    </DragOverlay>
  );
}
