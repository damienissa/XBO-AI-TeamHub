"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveTicket, Ticket, StatusColumn, TicketBlockedError } from "@/lib/api/tickets";
import { useToast } from "@/hooks/use-toast";

function applyOptimisticMove(tickets: Ticket[] | undefined, ticketId: string, targetColumn: StatusColumn): Ticket[] {
  if (!tickets) return [];
  return tickets.map(t =>
    t.id === ticketId ? { ...t, status_column: targetColumn } : t
  );
}

export function useMoveTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ ticketId, targetColumn, ownerId }: { ticketId: string; targetColumn: StatusColumn; ownerId: string | null }) =>
      moveTicket(ticketId, targetColumn, ownerId),
    onMutate: async ({ ticketId, targetColumn }) => {
      await queryClient.cancelQueries({ queryKey: ["board"] });
      const previousBoard = queryClient.getQueryData<Ticket[]>(["board"]);
      queryClient.setQueryData<Ticket[]>(["board"], old => applyOptimisticMove(old, ticketId, targetColumn));
      return { previousBoard };
    },
    onError: (err, _vars, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board"], context.previousBoard);
      }
      if (err instanceof TicketBlockedError) {
        const blockerIds = err.blocker_ids;
        toast({
          title: "Blocked — resolve dependencies first",
          description: blockerIds.length > 0
            ? `Blocking tickets: ${blockerIds.map((id: string) => id.slice(0, 8)).join(", ")}`
            : "This ticket has unresolved blocking dependencies.",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}
