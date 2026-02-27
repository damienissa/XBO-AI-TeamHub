import { verifySession } from "@/lib/dal";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Providers } from "@/lib/providers";
import { NotificationBar } from "@/components/notifications/NotificationBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();
  return (
    <Providers>
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar user={user} />
          <div className="flex flex-col flex-1 overflow-hidden">
            <NotificationBar />
            <main className="flex-1 overflow-auto bg-white">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </Providers>
  );
}
