"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface FieldDef {
  id: string;
  name: string;
  field_type: "text" | "number" | "date";
  scope: "workspace" | "personal";
  owner_id: string | null;
}

function FieldInput({
  def, value, onSave,
}: { def: FieldDef; value: string | number | null; onSave: (val: string | null) => void }) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  const handleBlur = () => {
    onSave(draft.trim() || null);
  };

  const inputProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: handleBlur,
    className: "border-0 border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:outline-none bg-transparent text-sm text-slate-700 w-full py-0.5",
  };

  if (def.field_type === "date") return <input type="date" {...inputProps} />;
  if (def.field_type === "number") return <input type="number" step="any" {...inputProps} />;
  return <input type="text" placeholder="—" {...inputProps} />;
}

export function CustomFieldsSection({
  ticketId, customFieldValues,
}: { ticketId: string; customFieldValues: Record<string, unknown> | null }) {
  const qc = useQueryClient();
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date">("text");

  const { data: defs = [] } = useQuery<FieldDef[]>({
    queryKey: ["custom-field-defs"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/custom-field-defs`, { credentials: "include" });
      return r.json();
    },
    staleTime: 60_000,
  });

  const saveValue = useMutation({
    mutationFn: async ({ fieldId, value }: { fieldId: string; value: string | null }) => {
      const existing = customFieldValues ?? {};
      const updated = value === null
        ? Object.fromEntries(Object.entries(existing).filter(([k]) => k !== fieldId))
        : { ...existing, [fieldId]: value };
      await fetch(`${API}/api/tickets/${ticketId}/custom-fields`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const createPersonalField = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/custom-field-defs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFieldName, field_type: newFieldType, scope: "personal" }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-field-defs"] });
      setNewFieldName("");
      setNewFieldType("text");
      setAddingPersonal(false);
    },
  });

  const workspaceDefs = defs.filter(d => d.scope === "workspace");
  const personalDefs = defs.filter(d => d.scope === "personal");
  const values = customFieldValues ?? {};

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Custom Fields</h3>
      </div>

      {workspaceDefs.length === 0 && personalDefs.length === 0 && !addingPersonal && (
        <p className="text-xs text-slate-400">No custom fields defined for this workspace yet.</p>
      )}

      {/* Workspace fields */}
      {workspaceDefs.map(def => (
        <div key={def.id} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-32 shrink-0">{def.name}</span>
          <FieldInput
            def={def}
            value={values[def.id] as string | number | null ?? null}
            onSave={(val) => saveValue.mutate({ fieldId: def.id, value: val })}
          />
        </div>
      ))}

      {/* Personal fields */}
      {personalDefs.length > 0 && (
        <>
          <p className="text-xs text-slate-400 mt-2">My fields</p>
          {personalDefs.map(def => (
            <div key={def.id} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-32 shrink-0">{def.name}</span>
              <FieldInput
                def={def}
                value={values[def.id] as string | number | null ?? null}
                onSave={(val) => saveValue.mutate({ fieldId: def.id, value: val })}
              />
            </div>
          ))}
        </>
      )}

      {/* Add personal field inline */}
      {addingPersonal ? (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            placeholder="Field name"
            className="border rounded px-2 py-1 text-sm flex-1"
          />
          <select
            value={newFieldType}
            onChange={e => setNewFieldType(e.target.value as "text" | "number" | "date")}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
          <button
            onClick={() => createPersonalField.mutate()}
            disabled={!newFieldName.trim()}
            className="text-xs bg-slate-800 text-white px-3 py-1 rounded disabled:opacity-50"
          >
            Add
          </button>
          <button onClick={() => setAddingPersonal(false)} className="text-xs text-slate-500 px-2 py-1">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingPersonal(true)}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add my field
        </button>
      )}
    </div>
  );
}
