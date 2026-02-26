"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { X, Plus, Link2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface DepTicket { id: string; title: string; status_column: string; }
interface DepsData { blocks: DepTicket[]; blocked_by: DepTicket[]; }

export function DependenciesSection({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: deps } = useQuery<DepsData>({
    queryKey: ["deps", ticketId],
    queryFn: async () => {
      const r = await fetch(`${API}/api/tickets/${ticketId}/dependencies`, { credentials: "include" });
      return r.json();
    },
  });

  // Board tickets for picker — flatten the flat list from /api/board
  const { data: allTickets } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["ticket-titles"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/board`, { credentials: "include" });
      const data = await r.json();
      // Board returns flat array of ticket objects
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const addDep = useMutation({
    mutationFn: (blockingId: string) =>
      fetch(`${API}/api/tickets/${ticketId}/dependencies`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocking_ticket_id: blockingId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deps", ticketId] });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const removeDep = useMutation({
    mutationFn: (blockingId: string) =>
      fetch(`${API}/api/tickets/${ticketId}/dependencies/${blockingId}`, {
        method: "DELETE", credentials: "include",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deps", ticketId] });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const depIds = new Set([...(deps?.blocks ?? []), ...(deps?.blocked_by ?? [])].map(d => d.id));
  const available = (allTickets ?? []).filter(t => t.id !== ticketId && !depIds.has(t.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Link2 className="h-4 w-4" /> Dependencies
        </h3>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72">
            <Command>
              <CommandInput placeholder="Search tickets..." />
              <CommandList>
                <CommandEmpty>No tickets found.</CommandEmpty>
                {available.map(t => (
                  <CommandItem key={t.id} value={t.title} onSelect={() => { addDep.mutate(t.id); setAddOpen(false); }}>
                    {t.title}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {(deps?.blocked_by ?? []).length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Blocked by</p>
          <ul className="space-y-1">
            {deps!.blocked_by.map(t => (
              <li key={t.id} className="flex items-center justify-between text-sm text-slate-700 bg-red-50 rounded px-2 py-1">
                <span>{t.title}</span>
                <button onClick={() => removeDep.mutate(t.id)} className="text-slate-400 hover:text-red-600 ml-2">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(deps?.blocks ?? []).length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Blocks</p>
          <ul className="space-y-1">
            {deps!.blocks.map(t => (
              <li key={t.id} className="flex items-center justify-between text-sm text-slate-700 bg-slate-50 rounded px-2 py-1">
                <span>{t.title}</span>
                <button onClick={() => removeDep.mutate(t.id)} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!(deps?.blocks.length) && !(deps?.blocked_by.length) && (
        <p className="text-xs text-slate-400">No dependencies.</p>
      )}
    </div>
  );
}
