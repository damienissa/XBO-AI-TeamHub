"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Sprint {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export default function SprintsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sprints`, { credentials: "include" });
      return r.json();
    },
  });

  const createSprint = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/sprints`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, start_date: startDate || null, end_date: endDate || null }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setName("");
      setStartDate("");
      setEndDate("");
      setCreating(false);
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Sprints</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded hover:bg-slate-700"
        >
          Create Sprint
        </button>
      </div>

      {creating && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white shadow-sm">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Sprint name"
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <div className="flex gap-3">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm flex-1"
            />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm flex-1"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createSprint.mutate()}
              disabled={!name.trim() || createSprint.isPending}
              className="bg-slate-800 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
            >
              {createSprint.isPending ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-slate-500 text-sm px-3 py-1.5 rounded border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sprints.length === 0 && !creating ? (
        <p className="text-slate-500 text-sm">No sprints yet. Create one to start organizing work.</p>
      ) : (
        <ul className="space-y-3">
          {sprints.map(s => (
            <li key={s.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
              <Link href={`/sprints/${s.id}`} className="block">
                <p className="font-semibold text-slate-800">{s.name}</p>
                {(s.start_date || s.end_date) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {s.start_date ? format(new Date(s.start_date), "MMM d") : "—"}
                    {" "}&rarr;{" "}
                    {s.end_date ? format(new Date(s.end_date), "MMM d, yyyy") : "—"}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
