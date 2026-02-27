"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, AtSign, UserCheck, ArrowRightLeft } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useNotifications, Notification } from "@/hooks/useNotifications";

function safeRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function TypeIcon({ type }: { type: Notification["type"] }) {
  if (type === "mention") return <AtSign className="w-3.5 h-3.5" style={{ color: "#2383E2" }} />;
  if (type === "assignment") return <UserCheck className="w-3.5 h-3.5" style={{ color: "#0F9F6E" }} />;
  return <ArrowRightLeft className="w-3.5 h-3.5" style={{ color: "#E07B00" }} />;
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleNotificationClick(n: Notification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.ticket_id) {
      router.push(`?ticket=${n.ticket_id}`);
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md transition-colors"
        style={{ color: "#9B9A97" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F7F7F5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center rounded-full text-white font-semibold"
            style={{
              background: "#E03E3E",
              fontSize: "10px",
              minWidth: "16px",
              height: "16px",
              padding: "0 3px",
              lineHeight: "16px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-1 rounded-lg shadow-lg z-50"
          style={{
            width: "340px",
            maxHeight: "420px",
            background: "#fff",
            border: "1px solid #E9E9E6",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
            style={{ borderColor: "#E9E9E6" }}
          >
            <span className="text-sm font-medium" style={{ color: "#37352F" }}>
              Notifications
              {unreadCount > 0 && (
                <span
                  className="ml-2 text-xs font-semibold rounded-full px-1.5 py-0.5"
                  style={{ background: "#EEF4FD", color: "#2383E2" }}
                >
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: "#9B9A97" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#2383E2")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#9B9A97")}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-8 h-8" style={{ color: "#E9E9E6" }} />
                <p className="text-sm" style={{ color: "#9B9A97" }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="w-full text-left px-4 py-3 flex gap-3 items-start transition-colors border-b last:border-b-0"
                  style={{
                    borderColor: "#F0F0EE",
                    background: n.read ? "transparent" : "#FAFAF9",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F7F7F5")}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = n.read
                      ? "transparent"
                      : "#FAFAF9")
                  }
                >
                  {/* Unread dot */}
                  <span
                    className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: n.read ? "transparent" : "#2383E2" }}
                  />
                  {/* Icon */}
                  <span className="flex-shrink-0 mt-0.5">
                    <TypeIcon type={n.type} />
                  </span>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: "#37352F" }}>
                      {n.message}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#9B9A97" }}>
                      {safeRelative(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
