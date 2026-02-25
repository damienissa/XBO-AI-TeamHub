"use client";

import type { SessionUser } from "@/lib/dal";

export function AppSidebar({ user }: { user: SessionUser }) {
  return <aside>AppSidebar stub — implemented in Task 2. User: {user.full_name}</aside>;
}
