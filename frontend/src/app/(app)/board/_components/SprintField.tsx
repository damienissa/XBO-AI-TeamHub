"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Sprint {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export function SprintField({ ticketId, sprintId }: { ticketId: string; sprintId: string | null }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sprints`, { credentials: "include" });
      return r.json();
    },
    staleTime: 30_000,
  });

  const assignSprint = useMutation({
    mutationFn: (newSprintId: string | null) =>
      fetch(`${API}/api/tickets/${ticketId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprint_id: newSprintId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const currentSprint = sprints.find((s) => s.id === sprintId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-24 shrink-0">Sprint</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="text-sm text-slate-700 hover:bg-slate-100 px-2 py-1 rounded border border-transparent hover:border-slate-200 text-left">
            {currentSprint ? currentSprint.name : "None"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64">
          <Command>
            <CommandInput placeholder="Search sprints..." />
            <CommandList>
              <CommandEmpty>No sprints.</CommandEmpty>
              <CommandItem value="None" onSelect={() => { assignSprint.mutate(null); setOpen(false); }}>
                None
              </CommandItem>
              {sprints.map((s) => (
                <CommandItem key={s.id} value={s.name} onSelect={() => { assignSprint.mutate(s.id); setOpen(false); }}>
                  {s.name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
