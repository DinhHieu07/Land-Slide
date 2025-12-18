"use client";

import { useEffect, useMemo, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Map,
    ShieldCheck,
    Radio,
    Bell,
    LogOut,
    Activity,
    Server,
    AlertTriangle,
    Layers,
    Compass,
    Cpu,
    CloudRain,
    Waves,
    Gauge,
    BarChart3,
} from "lucide-react";
import Link from "next/link";
import { LoginDialog } from "./LoginDialog";
import { RegisterDialog } from "./RegisterDialog";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";

const featureCards = [
    {
        title: "Quan trắc thời gian thực",
        desc: "Nhận dữ liệu sensor (MQTT/REST), hiển thị bản đồ và dashboard ngay lập tức.",
        icon: <Radio className="size-5 text-blue-600" />,
    },
    {
        title: "Bản đồ nguy cơ",
        desc: "Lớp bản đồ thiết bị, cảnh báo, khu vực; hỗ trợ zoom tới điểm chi tiết.",
        icon: <Map className="size-5 text-amber-600" />,
    },
    {
        title: "Cảnh báo đa kênh",
        desc: "WebSocket/REST; phân loại mức độ rõ ràng.",
        icon: <Bell className="size-5 text-red-600" />,
    },
    {
        title: "Phân quyền & nhật ký",
        desc: "Chỉ admin thao tác dữ liệu; ghi nhận lịch sử; bảo vệ phiên đăng nhập.",
        icon: <ShieldCheck className="size-5 text-emerald-600" />,
    },
];

const quickActions = [
    { label: "Mở dashboard", href: "/dashboard", icon: BarChart3, tone: "text-blue-600" },
    { label: "Quản lý thiết bị", href: "/devices", icon: Server, tone: "text-emerald-600" },
    { label: "Xem bản đồ", href: "/map", icon: Map, tone: "text-indigo-600" },
    { label: "Lịch sử cảnh báo", href: "/history", icon: AlertTriangle, tone: "text-amber-600" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type HomeSummary = {
    devices: {
        total: number;
        online: number;
        offline: number;
        disconnected: number;
        maintenance: number;
        byType: { type: string; count: number }[];
    };
    alerts: {
        total: number;
        recent: { id: number; level: string; message: string; created_at: string }[];
    };
    events: {
        total: number;
        last24h: number;
    };
    areas: {
        total: number;
    };
    coverage: Record<string, number>;
};

export default function HomePage() {
    const { isAuthenticated, user, logout, login } = useAuth();

    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-slate-50">
                <SidebarInset>
                    <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-white overflow-hidden">
                        <div className="flex-shrink-0 min-w-0 space-y-1">
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">Hệ thống giám sát sạt lở đất</p>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Trang chủ</h1>
                        </div>
                        <Header />
                    </header>

                    <main className="p-6 space-y-6">
                        {/* Tổng quan hệ thống + giới thiệu nhanh */}
                        <section className="bg-white rounded-xl shadow-sm border p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="space-y-3 max-w-2xl">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 w-fit">
                                    Trực quan – Thời gian thực – Đa kênh
                                </Badge>
                                <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                                    Giám sát sạt lở đất <span className="text-blue-600">thời gian thực</span>
                                </h2>
                                <p className="text-gray-600">
                                    Kết nối sensor, hiển thị bản đồ, phát cảnh báo tức thời và quản lý dữ liệu tập trung cho đội vận hành.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Button asChild>
                                        <Link href="/devices">Quản lý thiết bị</Link>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/map">Xem bản đồ</Link>
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Layers className="size-4 text-blue-600" />
                                            <span>Phạm vi triển khai</span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Phù hợp cho các huyện miền núi, khu vực có nguy cơ sạt lở cao.
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Compass className="size-4 text-emerald-600" />
                                            <span>Mục tiêu chính</span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Hỗ trợ ra quyết định sớm, giảm thiểu thiệt hại cho cộng đồng.
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Cpu className="size-4 text-indigo-600" />
                                            <span>Công nghệ sử dụng</span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Ứng dụng IoT, bản đồ số và dashboard web để theo dõi tập trung.
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Gauge className="size-4 text-amber-600" />
                                            <span>Chế độ xem thử</span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Các trang dashboard, thiết bị, bản đồ truy cập được bởi tài khoản admin.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </section>

                        {/* Thao tác nhanh */}
                        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            {quickActions.map((action) => (
                                <Card key={action.label} className="hover:shadow-md transition-shadow">
                                    <Link href={action.href} className="flex items-center justify-between p-4">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                                            <p className="text-xs text-slate-500">Truy cập nhanh chức năng chính</p>
                                        </div>
                                        <action.icon className={`size-5 ${action.tone}`} />
                                    </Link>
                                </Card>
                            ))}
                        </section>

                        {/* Tính năng chính */}
                        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {featureCards.map((f) => (
                                <Card key={f.title} className="border-slate-200">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="inline-flex items-center justify-center rounded-md bg-slate-100 p-2">
                                            {f.icon}
                                        </div>
                                        <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
                                        <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </section>

                        {/* Thông tin dự án */}
                        <section className="bg-white rounded-xl shadow-sm border p-6 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <h3 className="text-base font-semibold text-gray-900">Mục đích sử dụng</h3>
                                <p className="text-sm text-gray-600">
                                    Hệ thống được xây dựng phục vụ và hỗ trợ các nhóm kỹ thuật đánh giá bài toán giám sát sạt lở đất.
                                </p>
                                <p className="text-sm text-gray-600">
                                    Dữ liệu hiển thị là dữ liệu thực tế từ các cảm biến được kết nối vào hệ thống.
                                </p>
                            </div>
                            <div className="grid gap-3">
                                <div className="flex items-start gap-3 text-sm text-gray-700">
                                    <div className="mt-0.5 rounded-full bg-blue-50 p-1.5">
                                        <Activity className="size-3.5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Theo dõi nhanh</p>
                                        <p className="text-xs text-gray-500">
                                            Dùng các trang Dashboard, Thiết bị, Bản đồ để quan sát toàn cảnh trạng thái hệ thống.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 text-sm text-gray-700">
                                    <div className="mt-0.5 rounded-full bg-emerald-50 p-1.5">
                                        <ShieldCheck className="size-3.5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Phân quyền linh hoạt</p>
                                        <p className="text-xs text-gray-500">
                                            Tài khoản đăng nhập khác nhau có thể được cấu hình quyền truy cập riêng.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 text-sm text-gray-700">
                                    <div className="mt-0.5 rounded-full bg-slate-50 p-1.5">
                                        <CloudRain className="size-3.5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Mở rộng dữ liệu</p>
                                        <p className="text-xs text-gray-500">
                                            Có thể bổ sung thêm các cảm biến khác trong các giai đoạn sau.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Đăng nhập/Đăng ký */}
                        {!isAuthenticated ? (
                            <></>
                        ) : (
                            <section className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center justify-center w-12 h-12">
                                        <img src={user?.avatar} alt={user?.username} className="w-full h-full object-cover rounded-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-semibold text-gray-900">Chào mừng trở lại!</h3>
                                        <p className="text-sm text-gray-600">
                                            Đăng nhập với tài khoản <span className="font-medium text-blue-600">{user?.username}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button asChild variant="outline" className="border-gray-300">
                                        <Link href="/map">
                                            <Map className="size-4 mr-2" />
                                            Xem bản đồ
                                        </Link>
                                    </Button>
                                    <Button asChild>
                                        <Link href="/devices">
                                            <ShieldCheck className="size-4 mr-2" />
                                            Quản lý thiết bị
                                        </Link>
                                    </Button>
                                </div>
                            </section>
                        )}
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}