"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchBoard, Ticket } from "@/lib/api/tickets";

export function useBoard(filters: Record<string, string | null> = {}) {
  return useQuery<Ticket[]>({
    queryKey: ["board", filters],
    queryFn: () => fetchBoard(filters),
    refetchInterval: 30_000,  // BOARD-07
  });
}
