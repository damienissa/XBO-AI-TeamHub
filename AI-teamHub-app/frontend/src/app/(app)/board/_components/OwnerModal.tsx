"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "@/lib/api/tickets";
import { StatusColumn } from "@/lib/api/tickets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Search } from "lucide-react";

interface OwnerModalProps {
  ticketId: string;
  targetColumn: StatusColumn;
  onConfirm: (ownerId: string) => void;
  onCancel: () => void;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

function getInitials(fullName: string): string {
  return fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["#4F8EF7","#9B59B6","#27AE60","#E67E22","#E74C3C","#1ABC9C","#3498DB","#F39C12"];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

export function OwnerModal({ onConfirm, onCancel }: OwnerModalProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: users, isPending } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const selectedUser = users?.find((u) => u.id === selectedOwnerId);
  const filtered = (users ?? []).filter(
    (u) =>
      u.full_name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
  );

  // Close dropdown on outside click
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function selectUser(user: User) {
    setSelectedOwnerId(user.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-[400px]" style={{ overflow: "visible" }}>
        <DialogHeader>
          <DialogTitle>Assign owner before moving</DialogTitle>
          <DialogDescription>
            Tickets moving out of Backlog must have an owner assigned.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2" ref={containerRef} style={{ position: "relative" }}>
          {/* Trigger button */}
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm text-left transition-colors"
            style={{ border: "1px solid #E9E9E6", background: "#fff", color: "#37352F" }}
          >
            {selectedUser ? (
              <span className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
                  style={{ background: avatarColor(selectedUser.id) }}
                >
                  {getInitials(selectedUser.full_name)}
                </span>
                {selectedUser.full_name}
              </span>
            ) : (
              <span style={{ color: "#9B9A97" }}>
                {isPending ? "Loading…" : "Select an owner…"}
              </span>
            )}
            <svg className="ml-2 h-4 w-4 opacity-40" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Dropdown — rendered in-flow (not Portal) so Dialog doesn't block it */}
          {open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid #E9E9E6",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 9999,
                overflow: "hidden",
              }}
            >
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #F0F0EE" }}>
                <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9B9A97" }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search team members…"
                  className="flex-1 text-sm outline-none bg-transparent"
                  style={{ color: "#37352F" }}
                />
              </div>

              {/* User list */}
              <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <p className="text-sm px-3 py-3" style={{ color: "#9B9A97" }}>No members found</p>
                ) : (
                  filtered.map((user) => (
                    <div
                      key={user.id}
                      // Use onMouseDown instead of onClick to fire before blur closes the dropdown
                      onMouseDown={(e) => { e.preventDefault(); selectUser(user); }}
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                      style={{
                        background: selectedOwnerId === user.id ? "#F7F7F5" : "transparent",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F7F5")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = selectedOwnerId === user.id ? "#F7F7F5" : "transparent")}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
                        style={{ background: avatarColor(user.id) }}
                      >
                        {getInitials(user.full_name)}
                      </span>
                      <span className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium truncate" style={{ color: "#37352F" }}>{user.full_name}</span>
                        <span className="text-xs truncate" style={{ color: "#9B9A97" }}>{user.email}</span>
                      </span>
                      {selectedOwnerId === user.id && (
                        <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#2383E2" }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={!selectedOwnerId}
            onClick={() => { if (selectedOwnerId) onConfirm(selectedOwnerId); }}
            style={selectedOwnerId ? { background: "#2383E2", color: "#fff" } : {}}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
