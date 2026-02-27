"use client";

import { NotificationBell } from "./NotificationBell";

export function NotificationBar() {
  return (
    <div
      className="flex items-center justify-end px-4 flex-shrink-0"
      style={{
        height: "44px",
        borderBottom: "1px solid #E9E9E6",
        background: "#fff",
      }}
    >
      <NotificationBell />
    </div>
  );
}
