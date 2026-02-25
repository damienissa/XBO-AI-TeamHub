"use client";

import { useQueryStates, parseAsString, parseAsIsoDate, parseAsInteger } from "nuqs";
import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

async function fetchDepartments(): Promise<{ id: string; slug: string; name: string }[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/departments`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function BoardFilterBar() {
  const [filters, setFilters] = useQueryStates({
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

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 60_000,
  });

  // Count active filters
  const activeFilterCount = Object.values(filters).filter((v) => v !== null).length;

  function clearAll() {
    setFilters({
      owner: null,
      department: null,
      priority: null,
      min_urgency: null,
      max_urgency: null,
      due_before: null,
      due_after: null,
      created_after: null,
      created_before: null,
      min_age_days: null,
    });
  }

  function toDateInputValue(date: Date | null): string {
    if (!date) return "";
    return date.toISOString().slice(0, 10);
  }

  function parseDateInput(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-200 bg-white overflow-x-auto flex-shrink-0 flex-wrap">
      {/* Owner dropdown */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-slate-500 whitespace-nowrap">Owner</label>
        <select
          value={filters.owner ?? ""}
          onChange={(e) => setFilters({ owner: e.target.value || null })}
          className="text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="">All owners</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Department dropdown */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-slate-500 whitespace-nowrap">Dept</label>
        <select
          value={filters.department ?? ""}
          onChange={(e) => setFilters({ department: e.target.value || null })}
          className="text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="">All depts</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Priority dropdown */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-slate-500 whitespace-nowrap">Priority</label>
        <select
          value={filters.priority ?? ""}
          onChange={(e) => setFilters({ priority: e.target.value || null })}
          className="text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="">All</option>
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Urgency range */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-slate-500 whitespace-nowrap">Urgency</label>
        <input
          type="number"
          min={1}
          max={5}
          placeholder="min"
          value={filters.min_urgency ?? ""}
          onChange={(e) =>
            setFilters({ min_urgency: e.target.value ? parseInt(e.target.value, 10) : null })
          }
          className="w-12 text-sm border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <span className="text-xs text-slate-400">–</span>
        <input
          type="number"
          min={1}
          max={5}
          placeholder="max"
          value={filters.max_urgency ?? ""}
          onChange={(e) =>
            setFilters({ max_urgency: e.target.value ? parseInt(e.target.value, 10) : null })
          }
          className="w-12 text-sm border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Due date range */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-slate-500 whitespace-nowrap">Due</label>
        <input
          type="date"
          value={toDateInputValue(filters.due_after)}
          onChange={(e) => setFilters({ due_after: parseDateInput(e.target.value) })}
          className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <span className="text-xs text-slate-400">–</span>
        <input
          type="date"
          value={toDateInputValue(filters.due_before)}
          onChange={(e) => setFilters({ due_before: parseDateInput(e.target.value) })}
          className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Aging filter */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-slate-500 whitespace-nowrap">Min days in column</label>
        <input
          type="number"
          min={0}
          placeholder="0"
          value={filters.min_age_days ?? ""}
          onChange={(e) =>
            setFilters({ min_age_days: e.target.value ? parseInt(e.target.value, 10) : null })
          }
          className="w-16 text-sm border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Clear all + active badge */}
      <div className="flex items-center gap-2 ml-auto">
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-slate-800 text-white text-xs font-medium px-2 py-0.5">
            {activeFilterCount} active filter{activeFilterCount !== 1 ? "s" : ""}
          </span>
        )}
        <button
          onClick={clearAll}
          disabled={activeFilterCount === 0}
          className={cn(
            "text-xs px-3 py-1 rounded border transition-colors",
            activeFilterCount > 0
              ? "border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
              : "border-slate-200 text-slate-300 cursor-not-allowed"
          )}
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
