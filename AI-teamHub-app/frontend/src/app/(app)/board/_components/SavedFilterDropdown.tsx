"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, ChevronDown, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SavedFilter {
  id: string;
  name: string;
  filter_state: Record<string, unknown>;
  created_at: string;
}

interface SavedFilterDropdownProps {
  currentFilters: Record<string, unknown>;
  onApply: (filterState: Record<string, unknown>) => void;
}

export function SavedFilterDropdown({ currentFilters, onApply }: SavedFilterDropdownProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const { data: presets = [] } = useQuery<SavedFilter[]>({
    queryKey: ["saved-filters"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/saved-filters`, { credentials: "include" });
      return r.json();
    },
    staleTime: 30_000,
  });

  const saveFilter = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/saved-filters`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filter_state: currentFilters }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-filters"] });
      setName("");
      setSaving(false);
    },
  });

  const deleteFilter = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/api/saved-filters/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-filters"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50">
          <Bookmark className="h-3.5 w-3.5" />
          Saved
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="end">
        {/* Save current filter state */}
        {saving ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Filter preset name"
              className="w-full border rounded px-2 py-1 text-sm"
              onKeyDown={e => e.key === "Enter" && name.trim() && saveFilter.mutate()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveFilter.mutate()}
                disabled={!name.trim()}
                className="flex-1 bg-slate-800 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => { setSaving(false); setName(""); }} className="text-xs text-slate-500 px-2">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="w-full text-left text-sm text-slate-700 hover:text-slate-900 flex items-center gap-2"
          >
            <Check className="h-3.5 w-3.5 text-green-600" /> Save current filters
          </button>
        )}

        {/* Saved presets list */}
        {presets.length > 0 && (
          <div className="border-t border-slate-100 pt-2 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Presets</p>
            {presets.map(preset => (
              <div key={preset.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => { onApply(preset.filter_state); setOpen(false); }}
                  className="flex-1 text-left text-sm text-slate-700 hover:text-slate-900 py-1 rounded px-1 hover:bg-slate-50"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => deleteFilter.mutate(preset.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {presets.length === 0 && !saving && (
          <p className="text-xs text-slate-400 text-center py-2">No saved presets yet.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
