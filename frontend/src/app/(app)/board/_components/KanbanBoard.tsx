"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useBoard } from "@/hooks/useBoard";
import { useMoveTicket } from "@/hooks/useMoveTicket";
import { StatusColumn, Ticket } from "@/lib/api/tickets";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanDragOverlay } from "./KanbanDragOverlay";
import { OwnerModal } from "./OwnerModal";

const COLUMNS: StatusColumn[] = [
  "Backlog",
  "Discovery",
  "In Progress",
  "Review/QA",
  "Done",
];

export function KanbanBoard() {
  const { data: tickets, isPending, isError } = useBoard();
  const moveTicket = useMoveTicket();

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    ticketId: string;
    targetColumn: StatusColumn;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const ticketsByColumn = useMemo(() => {
    const map = new Map<StatusColumn, Ticket[]>();
    COLUMNS.forEach((col) => map.set(col, []));
    if (tickets) {
      tickets.forEach((ticket) => {
        const col = ticket.status_column;
        if (map.has(col)) {
          map.get(col)!.push(ticket);
        }
      });
    }
    return map;
  }, [tickets]);

  function handleDragStart(event: DragStartEvent) {
    const ticket = event.active.data.current as Ticket | undefined;
    if (ticket) {
      setActiveTicket(ticket);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const ticket = active.data.current as Ticket | undefined;
    if (!ticket) return;

    const targetColumn = over.id as StatusColumn;
    if (ticket.status_column === targetColumn) return;

    // BOARD-03: intercept Backlog → any move for unowned tickets
    // Do NOT apply optimistic update yet — wait for owner selection
    if (ticket.status_column === "Backlog" && !ticket.owner_id) {
      setPendingMove({ ticketId: ticket.id, targetColumn });
      return;
    }

    // All other moves: commit immediately with optimistic update
    moveTicket.mutate({
      ticketId: ticket.id,
      targetColumn,
      ownerId: ticket.owner_id,
    });
  }

  function handleDragCancel() {
    setActiveTicket(null);
  }

  if (isPending) {
    return (
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {COLUMNS.map((col) => (
          <div
            key={col}
            className="flex-shrink-0 w-72 bg-slate-100 rounded-lg p-3 animate-pulse"
          >
            <div className="h-6 bg-slate-200 rounded mb-3 w-3/4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded mb-2" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-red-500">Failed to load board. Please refresh.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {COLUMNS.map((col, index) => (
          <KanbanColumn
            key={col}
            column={col}
            tickets={ticketsByColumn.get(col) ?? []}
            showQuickAdd={index === 0}
          />
        ))}
      </div>

      {/* DragOverlay is always mounted — never conditionally rendered */}
      <KanbanDragOverlay activeTicket={activeTicket} />

      {pendingMove && (
        <OwnerModal
          ticketId={pendingMove.ticketId}
          targetColumn={pendingMove.targetColumn}
          onConfirm={(ownerId) => {
            moveTicket.mutate({
              ticketId: pendingMove.ticketId,
              targetColumn: pendingMove.targetColumn,
              ownerId,
            });
            setPendingMove(null);
          }}
          onCancel={() => {
            // Card snaps back automatically: optimistic update was never applied
            setPendingMove(null);
          }}
        />
      )}
    </DndContext>
  );
}
