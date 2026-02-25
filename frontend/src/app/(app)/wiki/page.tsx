"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API = process.env.NEXT_PUBLIC_API_URL;

interface WikiPageNode {
  id: string;
  title: string;
  parent_id: string | null;
  updated_at: string;
  children?: WikiPageNode[];
}

function buildTree(pages: WikiPageNode[]): WikiPageNode[] {
  const map = new Map(pages.map(p => [p.id, { ...p, children: [] as WikiPageNode[] }]));
  const roots: WikiPageNode[] = [];
  for (const page of map.values()) {
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children!.push(page);
    } else {
      roots.push(page);
    }
  }
  return roots;
}

function WikiTreeNode({ node, depth = 0 }: { node: WikiPageNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div className={`flex items-center gap-1 group ${depth > 0 ? "ml-4 border-l border-slate-200 pl-3" : ""}`}>
        {hasChildren && (
          <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600">
            <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <a
          href={`/wiki/${node.id}`}
          className="flex-1 py-1.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded px-2 block"
        >
          <span>{node.title}</span>
          <span className="text-xs text-slate-400 ml-2">
            {formatDistanceToNow(new Date(node.updated_at), { addSuffix: true })}
          </span>
        </a>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <WikiTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WikiListPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: pages = [], isLoading } = useQuery<WikiPageNode[]>({
    queryKey: ["wiki-pages"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/wiki`, { credentials: "include" });
      return r.json();
    },
  });

  const createPage = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/wiki`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: null, parent_id: null }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wiki-pages"] });
      setNewTitle("");
      setCreating(false);
      router.push(`/wiki/${data.id}`);
    },
  });

  const tree = buildTree(pages);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Wiki
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-slate-800 text-white text-sm px-4 py-2 rounded hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" /> New Page
        </button>
      </div>

      {creating && (
        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm space-y-3">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Page title"
            className="w-full border rounded px-3 py-1.5 text-sm"
            onKeyDown={e => e.key === "Enter" && newTitle.trim() && createPage.mutate()}
          />
          <div className="flex gap-2">
            <button
              onClick={() => createPage.mutate()}
              disabled={!newTitle.trim()}
              className="bg-slate-800 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
            >
              Create
            </button>
            <button onClick={() => { setCreating(false); setNewTitle(""); }} className="text-slate-500 text-sm px-3 py-1.5 rounded border">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-slate-400 text-sm">Loading wiki...</p>}

      {!isLoading && pages.length === 0 && !creating && (
        <div className="text-center py-12">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No wiki pages yet.</p>
          <p className="text-slate-400 text-xs mt-1">Create the first page to get started.</p>
        </div>
      )}

      {tree.length > 0 && (
        <div className="space-y-0.5">
          {tree.map(node => <WikiTreeNode key={node.id} node={node} />)}
        </div>
      )}
    </div>
  );
}
