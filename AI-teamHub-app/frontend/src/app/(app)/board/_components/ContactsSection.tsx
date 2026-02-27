"use client";

import { useState, useEffect } from "react";
import { X, UserPlus } from "lucide-react";
import { ContactOut, ContactIn } from "@/lib/api/tickets";

type UserOption = { id: string; full_name: string; email: string };

interface ContactsSectionProps {
  contacts: ContactOut[];
  users: UserOption[];
  onUpdate: (contacts: ContactIn[]) => void;
}

export function ContactsSection({ contacts, users, onUpdate }: ContactsSectionProps) {
  // Local draft mirrors the saved contacts, rebuilt whenever props change
  const [draft, setDraft] = useState<ContactIn[]>(() => toContactIn(contacts));
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showExtForm, setShowExtForm] = useState(false);
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");

  // Sync when contacts prop changes (e.g. after a successful mutation)
  useEffect(() => {
    setDraft(toContactIn(contacts));
  }, [contacts]);

  function toContactIn(list: ContactOut[]): ContactIn[] {
    return list.map((c) =>
      c.user_id
        ? { user_id: c.user_id }
        : { external_name: c.name, external_email: c.email ?? undefined }
    );
  }

  function removeAt(idx: number) {
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    onUpdate(next);
  }

  function addInternal(uid: string) {
    if (!uid || draft.some((c) => c.user_id === uid)) return;
    const next = [...draft, { user_id: uid }];
    setDraft(next);
    onUpdate(next);
    setSelectedUserId("");
  }

  function addExternal() {
    const name = extName.trim();
    const email = extEmail.trim() || undefined;
    if (!name) return;
    const next = [...draft, { external_name: name, external_email: email }];
    setDraft(next);
    onUpdate(next);
    setExtName("");
    setExtEmail("");
    setShowExtForm(false);
  }

  // Resolve display info for a draft entry
  function resolve(c: ContactIn): { name: string; email: string | null; isInternal: boolean } {
    if (c.user_id) {
      const u = users.find((u) => u.id === c.user_id);
      return { name: u?.full_name ?? c.user_id, email: u?.email ?? null, isInternal: true };
    }
    return { name: c.external_name ?? "?", email: c.external_email ?? null, isInternal: false };
  }

  const alreadyPickedIds = new Set(draft.filter((c) => c.user_id).map((c) => c.user_id!));
  const availableUsers = users.filter((u) => !alreadyPickedIds.has(u.id));

  return (
    <div className="space-y-2">
      {/* Contact list */}
      {draft.map((c, i) => {
        const { name, email, isInternal } = resolve(c);
        return (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
            style={{ background: "#F7F7F5", border: "1px solid #E9E9E6" }}
          >
            {/* Avatar initial */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{
                background: isInternal ? "#EEF4FD" : "#F0F0EE",
                color: isInternal ? "#2383E2" : "#9B9A97",
              }}
            >
              {name[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: "#37352F" }}>
                {name}
              </p>
              {email && (
                <p className="text-xs truncate" style={{ color: "#9B9A97" }}>
                  {email}
                </p>
              )}
            </div>

            {!isInternal && (
              <span
                className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: "#FFF3CD", color: "#856404" }}
              >
                External
              </span>
            )}

            <button
              type="button"
              onClick={() => removeAt(i)}
              className="flex-shrink-0 p-0.5 rounded transition-opacity hover:opacity-60"
              style={{ color: "#9B9A97" }}
              title="Remove contact"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {/* Empty state hint */}
      {draft.length === 0 && (
        <p className="text-xs py-1" style={{ color: "#B8B7B3" }}>
          No contacts added yet.
        </p>
      )}

      {/* Add internal user picker */}
      <select
        value={selectedUserId}
        onChange={(e) => addInternal(e.target.value)}
        className="w-full text-sm rounded-lg px-3 py-1.5 focus:outline-none transition-colors"
        style={{
          border: "1px solid #E9E9E6",
          color: selectedUserId ? "#37352F" : "#9B9A97",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        <option value="">
          {availableUsers.length === 0 ? "All team members added" : "+ Add team member…"}
        </option>
        {availableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name} — {u.email}
          </option>
        ))}
      </select>

      {/* Add external contact */}
      {showExtForm ? (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Full name *"
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 focus:outline-none"
              style={{ border: "1px solid #E9E9E6", color: "#37352F", background: "#fff" }}
              onKeyDown={(e) => e.key === "Enter" && addExternal()}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={extEmail}
              onChange={(e) => setExtEmail(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 focus:outline-none"
              style={{ border: "1px solid #E9E9E6", color: "#37352F", background: "#fff" }}
              onKeyDown={(e) => e.key === "Enter" && addExternal()}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!extName.trim()}
              onClick={addExternal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: "#2383E2" }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setExtName("");
                setExtEmail("");
                setShowExtForm(false);
              }}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: "#9B9A97" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExtForm(true)}
          className="text-xs transition-colors"
          style={{ color: "#9B9A97" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#37352F")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#9B9A97")}
        >
          + Add external contact
        </button>
      )}
    </div>
  );
}
