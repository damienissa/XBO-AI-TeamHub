"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveTicket, Ticket, StatusColumn } from "@/lib/api/tickets";

function applyOptimisticMove(tickets: Ticket[] | undefined, ticketId: string, targetColumn: StatusColumn): Ticket[] {
  if (!tickets) return [];
  return tickets.map(t =>
    t.id === ticketId ? { ...t, status_column: targetColumn } : t
  );
}

export function useMoveTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, targetColumn, ownerId }: { ticketId: string; targetColumn: StatusColumn; ownerId: string | null }) =>
      moveTicket(ticketId, targetColumn, ownerId),
    onMutate: async ({ ticketId, targetColumn }) => {
      await queryClient.cancelQueries({ queryKey: ["board"] });
      const previousBoard = queryClient.getQueryData<Ticket[]>(["board"]);
      queryClient.setQueryData<Ticket[]>(["board"], old => applyOptimisticMove(old, ticketId, targetColumn));
      return { previousBoard };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board"], context.previousBoard);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}
