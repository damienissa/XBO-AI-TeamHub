"use client";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/dal";

const NAV_ITEMS = [
  { label: "Board", href: "/board", enabled: true },
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Sprints", href: "/sprints", enabled: true },
  { label: "Department Portal", href: "/portal", enabled: true },
  { label: "Templates", href: "/settings/templates", enabled: true },
  { label: "Wiki", href: "/wiki", enabled: true },
  { label: "Timeline", href: "/timeline", enabled: true },
];

const ADMIN_NAV_ITEMS = [
  { label: "Custom Fields", href: "/settings/custom-fields", enabled: true },
];

const DEPARTMENTS = [
  { slug: "cashier", name: "Cashier" },
  { slug: "fintech360", name: "Fintech360" },
  { slug: "xbo_studio", name: "XBO Studio" },
  { slug: "xbo_marketing", name: "XBO Marketing" },
  { slug: "xbo_dev", name: "XBO Dev" },
  { slug: "xbo_legal", name: "XBO Legal" },
  { slug: "xbo_hr", name: "XBO HR" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="none" className="w-[240px] border-r bg-slate-50">
      <SidebarHeader className="px-4 py-4 border-b">
        <span className="font-semibold text-slate-800 text-sm tracking-wide">XBO TeamHub</span>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild={item.enabled}
                    isActive={item.enabled && pathname.startsWith(item.href)}
                    className={!item.enabled ? "pointer-events-none text-slate-400" : undefined}
                  >
                    {item.enabled ? (
                      <Link href={item.href}>{item.label}</Link>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin settings — only visible to admin role */}
        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild={item.enabled}
                      isActive={item.enabled && pathname.startsWith(item.href)}
                    >
                      {item.enabled ? (
                        <Link href={item.href}>{item.label}</Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Departments — links to /board?dept={slug}, Phase 2 implements board filter */}
        <SidebarGroup>
          <SidebarGroupLabel>Departments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DEPARTMENTS.map((dept) => (
                <SidebarMenuItem key={dept.slug}>
                  <SidebarMenuButton asChild>
                    <Link href={`/board?dept=${dept.slug}`}>{dept.name}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-semibold text-slate-700 flex-shrink-0">
            {getInitials(user.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{user.full_name}</p>
            <Badge variant="outline" className="text-xs capitalize">{user.role}</Badge>
          </div>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-slate-600">
            Log out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
