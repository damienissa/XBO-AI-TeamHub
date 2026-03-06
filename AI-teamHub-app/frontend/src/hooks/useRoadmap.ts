"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsString } from "nuqs";
import { fetchBoard, Ticket } from "@/lib/api/tickets";
import { fetchWithAuth } from "@/lib/api/client";

const API = process.env.NEXT_PUBLIC_API_URL;

export interface DepartmentSwimlane {
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  tickets: Ticket[];
}

export interface RoadmapData {
  swimlanes: DepartmentSwimlane[];
  unscheduled: Ticket[];
}

async function fetchDepartments(): Promise<{ id: string; slug: string; name: string }[]> {
  const res = await fetchWithAuth(`${API}/api/departments`);
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

export function useRoadmap() {
  const [filters] = useQueryStates({
    department: parseAsString,
  });

  const filterParams = Object.fromEntries(
    Object.entries({ department_id: filters.department }).map(([k, v]) => [
      k,
      v != null ? String(v) : null,
    ])
  );

  const { data: tickets, isPending, isError } = useQuery<Ticket[]>({
    queryKey: ["board", filterParams],
    queryFn: () => fetchBoard(filterParams),
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 60_000,
  });

  const roadmapData = useMemo<RoadmapData>(() => {
    if (!tickets) return { swimlanes: [], unscheduled: [] };

    const scheduled: Ticket[] = [];
    const unscheduled: Ticket[] = [];

    for (const ticket of tickets) {
      if (ticket.due_date) {
        scheduled.push(ticket);
      } else {
        unscheduled.push(ticket);
      }
    }

    const byDept = new Map<string, DepartmentSwimlane>();
    for (const ticket of scheduled) {
      const deptId = ticket.department.id;
      if (!byDept.has(deptId)) {
        byDept.set(deptId, {
          departmentId: deptId,
          departmentName: ticket.department.name,
          departmentSlug: ticket.department.slug,
          tickets: [],
        });
      }
      byDept.get(deptId)!.tickets.push(ticket);
    }

    const swimlanes = Array.from(byDept.values()).sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName)
    );

    // Sort tickets within each swimlane by created_at
    for (const lane of swimlanes) {
      lane.tickets.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return { swimlanes, unscheduled };
  }, [tickets]);

  return { ...roadmapData, departments, isPending, isError };
}
