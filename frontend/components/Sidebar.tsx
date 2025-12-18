"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarHeader,
    SidebarSeparator,
    SidebarTrigger,
    SidebarRail,
} from "@/components/ui/sidebar";
import { Map, Bell, Database, LayoutDashboard, LogIn, UserPlus, LogOut, User, Monitor, BarChart3, History, Mountain, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function AppSidebar() {
    const { isSuperAdmin, isAuthenticated, user, logout } = useAuth();
    return (
        <Sidebar>
            <SidebarHeader className="px-4 py-4 border-b border-gray-200">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black text-white shadow-sm group-hover:bg-gray-800 transition-colors">
                        <Mountain className="size-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-bold text-gray-900 leading-tight group-hover:text-black transition-colors">
                            LandSlide
                        </span>
                        <span className="text-xs text-gray-500 leading-tight">
                            Hệ thống giám sát
                        </span>
                    </div>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                    <Link href="/">
                                        <LayoutDashboard className="size-4" />
                                        Tổng quan
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {isAuthenticated && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href="/dashboard">
                                            <BarChart3 className="size-4" />
                                            Dashboard
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                    <Link href="/map">
                                        <Map className="size-4" />
                                        Bản đồ
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {isAuthenticated && (
                                <>
                                    {/* <SidebarMenuItem>
                                        <SidebarMenuButton asChild>
                                            <Link href="/admin">
                                                <Database className="size-4" />
                                                Quản lý dữ liệu
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem> */}
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild>
                                            <Link href="/devices">
                                                <Monitor className="size-4" />
                                                Quản lý thiết bị
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </>
                            )}
                            {isAuthenticated && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href="/history">
                                            <History className="size-4" />
                                            Lịch sử hệ thống
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            {isSuperAdmin && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href="/account">
                                            <Users className="size-4" />
                                            Quản lý tài khoản
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                    <Link href="/alerts">
                                        <Bell className="size-4" />
                                        Cảnh báo
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                <SidebarGroup>
                  
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {isAuthenticated ? (
                                <>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton disabled>
                                            <User className="size-4" />
                                            <span className="truncate">{user?.username}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton className="cursor-pointer" onClick={logout}>
                                            <LogOut className="size-4" />
                                            Đăng xuất
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </>
                            ) : (
                                <>
                                    
                                </>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-3 pb-3">
                <SidebarTrigger className="w-full justify-center" />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}