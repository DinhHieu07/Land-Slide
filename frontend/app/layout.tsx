import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/Sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import { ResponsiveTrigger } from "@/components/ResponsiveTriggerSidebar";

export const metadata: Metadata = {
  title: "Landslide Management System",
  description: "Map of landslides in Vietnam",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <AuthProvider>
          <SidebarProvider>
            <AppSidebar />
            <main className="relative min-h-screen w-full h-full">
              <ResponsiveTrigger />
              {children}
            </main>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
