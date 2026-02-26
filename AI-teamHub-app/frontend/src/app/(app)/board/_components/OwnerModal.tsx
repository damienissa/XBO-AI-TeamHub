"use client";

import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function OwnerModal({ onConfirm, onCancel }: OwnerModalProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Cached query — no re-fetch on every open
  const { data: users, isPending } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const selectedUser = users?.find((u) => u.id === selectedOwnerId);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign owner before moving</DialogTitle>
          <DialogDescription>
            Tickets moving out of Backlog must have an owner assigned.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                role="combobox"
                aria-expanded={comboboxOpen}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-left hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                {selectedUser ? (
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {getInitials(selectedUser.full_name)}
                      </span>
                    </span>
                    {selectedUser.full_name}
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {isPending ? "Loading team members..." : "Select an owner..."}
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0">
              <Command>
                <CommandInput placeholder="Search team members..." />
                <CommandList>
                  <CommandEmpty>No team members found.</CommandEmpty>
                  <CommandGroup>
                    {users?.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.full_name}
                        onSelect={() => {
                          setSelectedOwnerId(user.id);
                          setComboboxOpen(false);
                        }}
                      >
                        <span className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-semibold">
                              {getInitials(user.full_name)}
                            </span>
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm">{user.full_name}</span>
                            <span className="text-xs text-slate-400">{user.email}</span>
                          </span>
                        </span>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            selectedOwnerId === user.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!selectedOwnerId}
            onClick={() => {
              if (selectedOwnerId) {
                onConfirm(selectedOwnerId);
              }
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
