"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { BookOpen, ExternalLink, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface WikiPage { id: string; title: string; }

export function WikiLinkField({ ticketId, wikiPageId }: { ticketId: string; wikiPageId: string | null }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: pages = [] } = useQuery<WikiPage[]>({
    queryKey: ["wiki-pages"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/wiki`, { credentials: "include" });
      return r.json();
    },
    staleTime: 60_000,
  });

  const linkPage = useMutation({
    mutationFn: (pageId: string | null) =>
      fetch(`${API}/api/tickets/${ticketId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wiki_page_id: pageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const linkedPage = pages.find(p => p.id === wikiPageId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-24 shrink-0 flex items-center gap-1">
        <BookOpen className="h-3 w-3" /> Wiki
      </span>
      <div className="flex items-center gap-1.5 flex-1">
        {linkedPage ? (
          <>
            <a
              href={`/wiki/${linkedPage.id}`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              target="_blank"
            >
              {linkedPage.title}
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={() => linkPage.mutate(null)}
              className="text-slate-400 hover:text-red-600"
              title="Remove wiki link"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded border border-transparent hover:border-slate-200">
                Link a wiki page...
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-72">
              <Command>
                <CommandInput placeholder="Search wiki pages..." />
                <CommandList>
                  <CommandEmpty>No pages found.</CommandEmpty>
                  {pages.map(p => (
                    <CommandItem key={p.id} value={p.title} onSelect={() => { linkPage.mutate(p.id); setOpen(false); }}>
                      {p.title}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
