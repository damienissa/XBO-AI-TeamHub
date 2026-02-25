"use client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { parseISO, format } from "date-fns";
import { CalendarDays } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

// Use the same STATUS_BADGE color palette as the board (extract or duplicate constants)
const STATUS_COLORS: Record<string, string> = {
  "Backlog": "#94a3b8",       // slate-400
  "Discovery": "#60a5fa",     // blue-400
  "In Progress": "#34d399",   // emerald-400
  "Review/QA": "#f59e0b",     // amber-400
  "Done": "#4ade80",          // green-400
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface Ticket {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  status_column: string;
  department?: { name: string } | null;
}

interface TimelineEntry {
  id: string;
  title: string;
  start: number;       // epoch ms — created_at
  duration: number;    // epoch ms
  status_column: string;
}

function toEntry(t: Ticket): TimelineEntry | null {
  if (!t.due_date) return null;

  const start = parseISO(t.created_at).getTime();
  const end = parseISO(t.due_date).getTime();
  const duration = Math.max(end - start, ONE_DAY_MS); // minimum 1 day visible bar

  return { id: t.id, title: t.title, start, duration, status_column: t.status_column };
}

export default function TimelinePage() {
  const { data: boardData, isLoading } = useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/board`, { credentials: "include" });
      return r.json();
    },
    staleTime: 60_000,
  });

  // Board returns { Backlog: Ticket[], "In Progress": Ticket[], ... }
  // Flatten all tickets from all columns
  const allTickets: Ticket[] = boardData
    ? (Object.values(boardData) as Ticket[][]).flat()
    : [];

  const withDueDate = allTickets.filter(t => t.due_date);
  const withoutDueDate = allTickets.filter(t => !t.due_date);

  const entries: TimelineEntry[] = withDueDate
    .map(toEntry)
    .filter((e): e is TimelineEntry => e !== null)
    .sort((a, b) => a.start - b.start);

  if (isLoading) return <div className="p-6 text-slate-400">Loading timeline...</div>;

  if (entries.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <CalendarDays className="h-6 w-6" /> Timeline
        </h1>
        <p className="text-slate-500 text-sm">No tickets with due dates to display.</p>
        {withoutDueDate.length > 0 && (
          <p className="text-slate-400 text-xs mt-1">
            {withoutDueDate.length} ticket{withoutDueDate.length !== 1 ? "s" : ""} without due dates are hidden.
          </p>
        )}
      </div>
    );
  }

  // X axis domain: min start to max end (with 5% padding on each side)
  const minDate = Math.min(...entries.map(e => e.start));
  const maxDate = Math.max(...entries.map(e => e.start + e.duration));
  const padding = (maxDate - minDate) * 0.05 || ONE_DAY_MS;

  // Chart height: 36px per ticket, minimum 200px
  const chartHeight = Math.max(entries.length * 36, 200);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarDays className="h-6 w-6" /> Timeline
        </h1>
        {withoutDueDate.length > 0 && (
          <p className="text-xs text-slate-400 italic">
            {withoutDueDate.length} ticket{withoutDueDate.length !== 1 ? "s" : ""} without due dates hidden
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-slate-500">{status}</span>
          </div>
        ))}
      </div>

      {/* RESEARCH.md Pattern 6: stacked horizontal BarChart, transparent offset bar + visible duration bar */}
      {/* CRITICAL: Both X axis type="number" and data keys MUST be epoch milliseconds numbers, NOT date strings */}
      {/* RESEARCH.md Pitfall 6: never pass ISO date strings to Recharts number-type axis — bars collapse to left edge */}
      <div style={{ height: chartHeight + 40 }}>
        <ResponsiveContainer width="100%" height={chartHeight + 40}>
          <BarChart
            data={entries}
            layout="vertical"
            margin={{ left: 180, right: 20, top: 10, bottom: 30 }}
          >
            <XAxis
              type="number"
              domain={[minDate - padding, maxDate + padding]}
              tickFormatter={(v) => format(new Date(v), "MMM d")}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickCount={6}
            />
            <YAxis
              type="category"
              dataKey="title"
              width={170}
              tick={{ fontSize: 11, fill: "#475569" }}
              tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + "\u2026" : v}
            />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                if (name === "start" || value === undefined) return null;
                return [`${Math.round(value / ONE_DAY_MS)} days`, "Duration"];
              }}
              labelFormatter={(label: unknown) => String(label)}
            />
            {/* Transparent offset bar — pushes visible bar to correct start position */}
            <Bar dataKey="start" stackId="gantt" fill="transparent" isAnimationActive={false} />
            {/* Visible duration bar — colored by status_column */}
            <Bar dataKey="duration" stackId="gantt" radius={[4, 4, 4, 4]} isAnimationActive={false}>
              {entries.map((entry) => (
                <Cell key={entry.id} fill={STATUS_COLORS[entry.status_column] ?? "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
