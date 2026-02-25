import { verifySession } from "@/lib/dal";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();  // Redirects to /login if invalid
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar user={user} />
        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
