"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTicket,
  fetchTicketEvents,
  fetchTicketHistory,
  updateTicket,
  Ticket,
} from "@/lib/api/tickets";

export function useTicketDetail(ticketId: string | null) {
  const queryClient = useQueryClient();

  const ticketQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => fetchTicket(ticketId!),
    enabled: !!ticketId,
  });

  const eventsQuery = useQuery({
    queryKey: ["ticket-events", ticketId],
    queryFn: () => fetchTicketEvents(ticketId!),
    enabled: !!ticketId,
  });

  const historyQuery = useQuery({
    queryKey: ["ticket-history", ticketId],
    queryFn: () => fetchTicketHistory(ticketId!),
    enabled: !!ticketId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => updateTicket(ticketId!, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", ticketId], updated);
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-events", ticketId] });
    },
  });

  return { ticketQuery, eventsQuery, historyQuery, updateMutation };
}
