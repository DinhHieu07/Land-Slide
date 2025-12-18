"use client";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ResponsiveTrigger() {
  const pathname = usePathname();
  if (pathname === "/map" || pathname.startsWith("/map/")) return null;
  return <SidebarTrigger />;
}