"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface FieldDef { id: string; name: string; field_type: string; scope: string; }

export default function WorkspaceCustomFieldsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "number" | "date">("text");

  const { data: defs = [] } = useQuery<FieldDef[]>({
    queryKey: ["custom-field-defs"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/custom-field-defs`, { credentials: "include" });
      return r.json();
    },
  });

  const createField = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/custom-field-defs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, field_type: fieldType, scope: "workspace" }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-field-defs"] }); setName(""); },
  });

  const deleteField = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/api/custom-field-defs/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-field-defs"] }),
  });

  const workspaceDefs = defs.filter(d => d.scope === "workspace");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Custom Fields</h1>
      <p className="text-sm text-slate-500">Define workspace-wide fields that appear on every ticket.</p>

      {/* Create new field form */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-slate-500 block mb-1">Field Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer ID"
            className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Type</label>
          <select value={fieldType} onChange={e => setFieldType(e.target.value as "text" | "number" | "date")}
            className="border rounded px-3 py-1.5 text-sm">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
        </div>
        <button onClick={() => createField.mutate()} disabled={!name.trim()}
          className="bg-slate-800 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50">
          Add Field
        </button>
      </div>

      {/* Workspace fields list */}
      {workspaceDefs.length === 0 ? (
        <p className="text-sm text-slate-400">No workspace fields defined yet.</p>
      ) : (
        <ul className="space-y-2">
          {workspaceDefs.map(def => (
            <li key={def.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{def.name}</p>
                <p className="text-xs text-slate-500 capitalize">{def.field_type}</p>
              </div>
              <button onClick={() => deleteField.mutate(def.id)} className="text-slate-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
