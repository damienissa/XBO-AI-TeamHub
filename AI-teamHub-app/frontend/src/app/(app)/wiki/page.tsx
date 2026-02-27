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
  Array.from(map.values()).forEach((page) => {
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children!.push(page);
    } else {
      roots.push(page);
    }
  });
  return roots;
}

function WikiTreeNode({ node, depth = 0 }: { node: WikiPageNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div className={`flex items-center gap-1 group ${depth > 0 ? "ml-4 pl-3" : ""}`}
         style={depth > 0 ? { borderLeft: "1px solid #E9E9E6" } : undefined}>
        {hasChildren && (
          <button onClick={() => setExpanded(e => !e)} style={{ color: "#9B9A97" }}>
            <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <a
          href={`/wiki/${node.id}`}
          className="flex-1 py-1.5 text-sm rounded px-2 block hover:opacity-80"
          style={{ color: "#37352F" }}
        >
          <span>{node.title}</span>
          <span className="text-xs ml-2" style={{ color: "#B8B7B3" }}>
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
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#37352F" }}>
          <BookOpen className="h-6 w-6" /> Wiki
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-white text-sm px-4 py-2 rounded"
          style={{ background: "#2383E2" }}
        >
          <Plus className="h-4 w-4" /> New Page
        </button>
      </div>

      {creating && (
        <div className="rounded-lg p-4 bg-white shadow-sm space-y-3" style={{ border: "1px solid #E9E9E6" }}>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Page title"
            className="w-full rounded px-3 py-1.5 text-sm focus:outline-none"
            style={{ border: "1px solid #E9E9E6", color: "#37352F" }}
            onKeyDown={e => e.key === "Enter" && newTitle.trim() && createPage.mutate()}
          />
          <div className="flex gap-2">
            <button
              onClick={() => createPage.mutate()}
              disabled={!newTitle.trim()}
              className="text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
              style={{ background: "#2383E2" }}
            >
              Create
            </button>
            <button onClick={() => { setCreating(false); setNewTitle(""); }}
              className="text-sm px-3 py-1.5 rounded"
              style={{ color: "#9B9A97", border: "1px solid #E9E9E6" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm" style={{ color: "#B8B7B3" }}>Loading wiki...</p>}

      {!isLoading && pages.length === 0 && !creating && (
        <div className="text-center py-12">
          <BookOpen className="h-10 w-10 mx-auto mb-3" style={{ color: "#D3D3D0" }} />
          <p className="text-sm" style={{ color: "#9B9A97" }}>No wiki pages yet.</p>
          <p className="text-xs mt-1" style={{ color: "#B8B7B3" }}>Create the first page to get started.</p>
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
