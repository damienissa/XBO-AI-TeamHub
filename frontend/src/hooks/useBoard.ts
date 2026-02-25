"use client";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsString, parseAsInteger, parseAsIsoDate } from "nuqs";
import { fetchBoard, Ticket } from "@/lib/api/tickets";

export function useBoard() {
  const [filters] = useQueryStates({
    owner:          parseAsString,
    department:     parseAsString,
    priority:       parseAsString,
    min_urgency:    parseAsInteger,
    max_urgency:    parseAsInteger,
    due_before:     parseAsIsoDate,
    due_after:      parseAsIsoDate,
    created_after:  parseAsIsoDate,
    created_before: parseAsIsoDate,
    min_age_days:   parseAsInteger,
  });

  // Convert filter values to string params for fetchBoard.
  // Remap frontend URL param names to backend query param names where they differ.
  const KEY_MAP: Record<string, string> = { owner: "owner_id", department: "department_id" };
  const filterParams = Object.fromEntries(
    Object.entries(filters).map(([k, v]) => [
      KEY_MAP[k] ?? k,
      v != null ? String(v instanceof Date ? v.toISOString().slice(0, 10) : v) : null,
    ])
  );

  return useQuery<Ticket[]>({
    queryKey: ["board", filterParams],
    queryFn: () => fetchBoard(filterParams),
    refetchInterval: 30_000,  // BOARD-07
  });
}
