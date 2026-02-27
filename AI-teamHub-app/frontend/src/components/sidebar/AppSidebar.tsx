"use client";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/dal";

const NAV_ITEMS = [
  { label: "Board", href: "/board", enabled: true },
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Project creation", href: "/portal", enabled: true },
  { label: "Templates", href: "/settings/templates", enabled: true },
  { label: "Wiki", href: "/wiki", enabled: true },
];

const ADMIN_NAV_ITEMS = [
  { label: "Custom Fields", href: "/settings/custom-fields", enabled: true },
];

const DEPARTMENTS = [
  { slug: "rnd", name: "R&D" },
  { slug: "back_office", name: "Back office" },
  { slug: "banking", name: "Banking" },
  { slug: "bi", name: "BI" },
  { slug: "bizdev_sales", name: "Bizdev & Sales" },
  { slug: "cashier", name: "Cashier" },
  { slug: "compliance", name: "Compliance" },
  { slug: "content", name: "Content" },
  { slug: "creative_studio", name: "Creative Studio" },
  { slug: "design", name: "Design" },
  { slug: "customer_support", name: "Customer Support" },
  { slug: "dealing", name: "Dealing" },
  { slug: "devops_it", name: "DevOps & IT" },
  { slug: "finance", name: "Finance" },
  { slug: "hr_recruitment_cy", name: "HR&Recruitment (CY)" },
  { slug: "hr_recruitment_ukr", name: "HR&Recruitment (UKR)" },
  { slug: "legal", name: "Legal" },
  { slug: "onboarding", name: "Onboarding" },
  { slug: "product_xbo", name: "Product (XBO)" },
  { slug: "success", name: "Success" },
  { slug: "technical_support", name: "Technical Support" },
  { slug: "technical_writers", name: "Technical Writers" },
  { slug: "ui_ux", name: "UI/UX" },
];

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="none"
      className="w-[240px] border-r"
      style={{ background: "#F7F7F5", borderColor: "#E9E9E6" }}
    >
      {/* Logo */}
      <SidebarHeader className="px-3 py-3 border-b" style={{ borderColor: "#E9E9E6" }}>
        <Link href="/board" className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-black/5 transition-colors">
          <div
            className="h-6 w-6 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "#2383E2" }}
          >
            X
          </div>
          <span className="font-semibold text-sm" style={{ color: "#37352F" }}>
            XBO TeamHub
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = item.enabled && pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild={item.enabled}
                      isActive={isActive}
                      className="rounded-md mx-1 text-sm font-medium transition-colors duration-100"
                      style={{
                        color: isActive ? "#37352F" : "#73726E",
                        background: isActive ? "#EFEDEA" : "transparent",
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {item.enabled
                        ? <Link href={item.href}>{item.label}</Link>
                        : <span className="opacity-40">{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin */}
        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs px-3 pb-1" style={{ color: "#9B9A97" }}>
              Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = item.enabled && pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild={item.enabled}
                        isActive={isActive}
                        className="rounded-md mx-1 text-sm transition-colors"
                        style={{
                          color: isActive ? "#37352F" : "#73726E",
                          background: isActive ? "#EFEDEA" : "transparent",
                        }}
                      >
                        {item.enabled
                          ? <Link href={item.href}>{item.label}</Link>
                          : <span className="opacity-40">{item.label}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Departments */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs px-3 pb-1" style={{ color: "#9B9A97" }}>
            Departments
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DEPARTMENTS.map((dept) => (
                <SidebarMenuItem key={dept.slug}>
                  <SidebarMenuButton
                    asChild
                    className="rounded-md mx-1 text-xs transition-colors"
                    style={{ color: "#73726E" }}
                  >
                    <Link href={`/dept/${dept.slug}`}>{dept.name}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="px-3 py-3 border-t" style={{ borderColor: "#E9E9E6" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: "#2383E2" }}
          >
            {getInitials(user.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "#37352F" }}>{user.full_name}</p>
            <p className="text-xs capitalize" style={{ color: "#9B9A97" }}>{user.role}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <Button
            type="submit" variant="ghost" size="sm"
            className="w-full justify-start text-xs h-7 px-2"
            style={{ color: "#9B9A97" }}
          >
            Log out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
