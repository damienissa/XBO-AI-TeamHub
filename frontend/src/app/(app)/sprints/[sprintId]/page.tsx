"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;
const COLUMNS = ["Backlog", "Discovery", "In Progress", "Review/QA", "Done"];

interface SprintTicket {
  id: string;
  title: string;
  status_column: string;
  effort_estimate: number | null;
}

interface VelocityData {
  effort_completed: number;
  effort_total: number;
  pct: number;
}

interface SprintBoardData {
  sprint: { id: string; name: string; start_date: string | null; end_date: string | null };
  tickets: SprintTicket[];
  velocity: VelocityData;
}

export default function SprintBoardPage() {
  const { sprintId } = useParams<{ sprintId: string }>();

  const { data, isLoading } = useQuery<SprintBoardData>({
    queryKey: ["sprint-board", sprintId],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sprints/${sprintId}/board`, { credentials: "include" });
      if (!r.ok) throw new Error("Sprint not found");
      return r.json();
    },
  });

  if (isLoading) return <div className="p-6 text-slate-500">Loading sprint...</div>;
  if (!data) return <div className="p-6 text-slate-500">Sprint not found.</div>;

  const { sprint, tickets, velocity } = data;
  const grouped: Record<string, SprintTicket[]> = COLUMNS.reduce(
    (acc, col) => ({ ...acc, [col]: [] }),
    {} as Record<string, SprintTicket[]>
  );
  tickets.forEach((t) => {
    if (grouped[t.status_column]) {
      grouped[t.status_column].push(t);
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Velocity header — per CONTEXT.md decision */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-lg font-bold text-slate-800 mb-2">{sprint.name}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {velocity.effort_completed} of {velocity.effort_total} effort hours completed
          </span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-xs">
            <div
              className="h-2 bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(velocity.pct, 100)}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-700">{Math.round(velocity.pct)}%</span>
        </div>
      </div>

      {/* Columns — display only, no drag-and-drop per RESEARCH.md Pitfall 4 */}
      <div className="flex gap-4 p-6 overflow-x-auto flex-1">
        {COLUMNS.map(col => (
          <div key={col} className="flex-1 min-w-[200px]">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {col} ({grouped[col].length})
            </h2>
            <div className="space-y-2">
              {grouped[col].map((t) => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                  <p className="text-sm font-medium text-slate-800">{t.title}</p>
                  {t.effort_estimate !== null && (
                    <p className="text-xs text-slate-500 mt-1">{t.effort_estimate}h</p>
                  )}
                </div>
              ))}
              {grouped[col].length === 0 && (
                <p className="text-xs text-slate-400 italic">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
