"use client";

import { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useBoard } from "@/hooks/useBoard";
import { useMoveTicket } from "@/hooks/useMoveTicket";
import { StatusColumn, Ticket } from "@/lib/api/tickets";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanDragOverlay } from "./KanbanDragOverlay";
import { OwnerModal } from "./OwnerModal";
import { BoardFilterBar } from "./BoardFilterBar";
import { TicketDetailModal } from "./TicketDetailModal";

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

  // Client-side ordering: column → ordered ticket IDs
  const [columnOrder, setColumnOrder] = useState<Map<StatusColumn, string[]>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Sync columnOrder from server data.
  // Guarded while a mutation is in-flight to avoid overwriting optimistic updates.
  useEffect(() => {
    if (!tickets) return;
    if (moveTicket.isPending) return;

    setColumnOrder((prev) => {
      const next = new Map(prev);
      COLUMNS.forEach((col) => {
        const freshIds = tickets
          .filter((t) => t.status_column === col)
          .map((t) => t.id);

        if (!next.has(col)) {
          // First load: initialize from server order
          next.set(col, freshIds);
        } else {
          const existing = next.get(col)!;
          const freshSet = new Set(freshIds);
          // Preserve local order, prune stale IDs, append new ones at the end
          const pruned = existing.filter((id) => freshSet.has(id));
          const newIds = freshIds.filter((id) => !existing.includes(id));
          next.set(col, [...pruned, ...newIds]);
        }
      });
      return next;
    });
  }, [tickets, moveTicket.isPending]);

  // Apply client-side column order on top of server data.
  // Filters by status_column to stay consistent with React Query optimistic updates.
  const ticketsByColumn = useMemo(() => {
    const map = new Map<StatusColumn, Ticket[]>();
    COLUMNS.forEach((col) => map.set(col, []));
    if (!tickets) return map;

    const ticketById = new Map(tickets.map((t) => [t.id, t]));
    COLUMNS.forEach((col) => {
      const order = columnOrder.get(col);
      if (order) {
        map.set(
          col,
          order
            .map((id) => ticketById.get(id))
            .filter((t): t is Ticket => !!t && t.status_column === col)
        );
      } else {
        map.set(col, tickets.filter((t) => t.status_column === col));
      }
    });
    return map;
  }, [tickets, columnOrder]);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | { type?: string; ticket?: Ticket }
      | undefined;
    if (data?.type === "ticket" && data.ticket) {
      setActiveTicket(data.ticket);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const activeData = active.data.current as
      | { type?: string; ticket?: Ticket }
      | undefined;
    const ticket = activeData?.type === "ticket" ? activeData.ticket : undefined;
    if (!ticket) return;

    const overId = over.id as string;
    const overData = over.data.current as
      | { type?: string; column?: StatusColumn; ticket?: Ticket }
      | undefined;

    const isColumnTarget = overData?.type === "column";
    const sourceColumn = ticket.status_column;
    const targetColumn: StatusColumn = isColumnTarget
      ? overData!.column!
      : (overData?.ticket?.status_column ?? sourceColumn);

    if (sourceColumn === targetColumn) {
      // Same-column reorder
      const currentIds = columnOrder.get(sourceColumn) ?? [];
      const activeIndex = currentIds.indexOf(ticket.id);
      const overIndex = currentIds.indexOf(overId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setColumnOrder((prev) => {
          const next = new Map(prev);
          next.set(sourceColumn, arrayMove(currentIds, activeIndex, overIndex));
          return next;
        });
      }
      return;
    }

    // Cross-column move ─────────────────────────────────────────────────────

    // BOARD-03: intercept Backlog → any move for unowned tickets
    if (ticket.status_column === "Backlog" && !ticket.owner_id) {
      setPendingMove({ ticketId: ticket.id, targetColumn });
      return;
    }

    // Optimistic local order update: remove from source, insert in target
    setColumnOrder((prev) => {
      const next = new Map(prev);
      const sourceIds = (prev.get(sourceColumn) ?? []).filter(
        (id) => id !== ticket.id
      );
      const targetIds = [...(prev.get(targetColumn) ?? [])];
      if (!isColumnTarget) {
        const overIdx = targetIds.indexOf(overId);
        overIdx !== -1
          ? targetIds.splice(overIdx, 0, ticket.id)
          : targetIds.push(ticket.id);
      } else {
        targetIds.push(ticket.id);
      }
      next.set(sourceColumn, sourceIds);
      next.set(targetColumn, targetIds);
      return next;
    });

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
      <div className="flex flex-col h-full">
        <BoardFilterBar />
        <div className="flex gap-4 p-6 overflow-x-auto flex-1">
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
      </div>
    );
  }

  // Hard error: no cached data at all — nothing to show
  if (isError && !tickets) {
    return (
      <div className="flex flex-col h-full">
        <BoardFilterBar />
        <div className="flex items-center justify-center flex-1 p-6">
          <p className="text-red-500">Failed to load board. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full">
        {/* Sync error banner — shown only when background refetch fails but cached data is still available */}
        {isError && tickets && (
          <div className="flex items-center justify-center gap-2 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex-shrink-0">
            <span>Sync failed — showing last saved data.</span>
            <button
              onClick={() => window.location.reload()}
              className="underline hover:text-amber-900"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Filter bar above the columns */}
        <BoardFilterBar />

        {/* Columns container: horizontal scroll, each column scrolls vertically */}
        <div className="flex gap-4 p-6 overflow-x-auto flex-1 min-h-0">
          {COLUMNS.map((col, index) => (
            <KanbanColumn
              key={col}
              column={col}
              tickets={ticketsByColumn.get(col) ?? []}
              showQuickAdd={index === 0}
            />
          ))}
        </div>
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
            setPendingMove(null);
          }}
        />
      )}

      {/* Ticket detail modal — mounted once; uses nuqs ?ticket= URL state */}
      <TicketDetailModal />
    </DndContext>
  );
}
