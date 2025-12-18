"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
    Activity,
    AlertTriangle,
    MapPin,
    Radio,
    TrendingUp,
    Users,
    Wifi,
    WifiOff,
    AlertCircle,
    Settings,
    BarChart3,
    Zap,
    Thermometer,
    Droplets,
    CloudRain,
    Gauge,
    Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    BarChart as RechartsBarChart,
    Bar,
    AreaChart as RechartsAreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Header from "@/components/Header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type DashboardStats = {
    devices: {
        total: number;
        online: number;
        offline: number;
        disconnected: number;
        maintenance: number;
        byProvince: Array<{ province_code: string; province_name: string; count: number }>;
        recentUpdates: number;
    };
    events: {
        total: number;
        severity: {
            1: number;
            2: number;
            3: number;
            4: number;
            5: number;
        };
        last7Days: Array<{ date: string; count: number }>;
        recent: number;
    };
    alerts: {
        total: number;
    };
    areas: {
        total: number;
    };
};

type SensorSeries = Record<
    string,
    Array<{
        time: string;
        count: number;
        avg_value: number | null;
    }>
>;

export default function DashboardView() {
    const router = useRouter();
    const { isAuthenticated, isAdmin, loading } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [sensorSeries, setSensorSeries] = useState<SensorSeries>({});
    const [topDevices, setTopDevices] = useState<Array<{ device_id: string; samples: number }>>([]);
    const [loadingSensor, setLoadingSensor] = useState(true);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchStats();
            fetchSensorStats();
        }
    }, [isAuthenticated, isAdmin]);

    const sensorTypes = useMemo(() => Object.keys(sensorSeries || {}), [sensorSeries]);

    const maxCountByType: Record<string, number> = useMemo(() => {
        const result: Record<string, number> = {};
        sensorTypes.forEach((t) => {
            result[t] = Math.max(...(sensorSeries[t]?.map((p) => p.count) || [1]), 1);
        });
        return result;
    }, [sensorSeries, sensorTypes]);

    const fetchStats = async () => {
        try {
            setLoadingStats(true);
            const res = await authenticatedFetch(`${API_URL}/api/dashboard/stats`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error("Lỗi khi lấy thống kê:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchSensorStats = async () => {
        try {
            setLoadingSensor(true);
            const res = await authenticatedFetch(`${API_URL}/api/dashboard/sensor-stats?hours=24&interval=hour`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSensorSeries(data.data || {});
                setTopDevices(data.topDevices || []);
            }
        } catch (error) {
            console.error("Lỗi khi lấy thống kê cảm biến:", error);
        } finally {
            setLoadingSensor(false);
        }
    };

    if (!isAuthenticated || !isAdmin) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-red-600 font-semibold">Bạn cần đăng nhập để truy cập trang này.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading || loadingStats) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-gray-600">Không thể tải dữ liệu thống kê.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tổng quan hệ thống giám sát sạt lở đất
                    </p>
                </div>
                <Header />
            </div>
            <div className="flex gap-2 justify-end">
                <Button onClick={() => { fetchStats(); fetchSensorStats(); }} variant="outline">
                    <BarChart3 className="size-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Tổng thiết bị */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng thiết bị</CardTitle>
                        <Radio className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.devices.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.devices.recentUpdates} cập nhật trong 24h
                        </p>
                    </CardContent>
                </Card>

                {/* Tổng sự kiện */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng sự kiện</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.events.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.events.recent} sự kiện trong 24h
                        </p>
                    </CardContent>
                </Card>

                {/* Tổng cảnh báo */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cảnh báo</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.alerts.total}</div>
                        <p className="text-xs text-muted-foreground">
                            Tổng số cảnh báo hệ thống
                        </p>
                    </CardContent>
                </Card>

                {/* Tổng khu vực */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Khu vực</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.areas.total}</div>
                        <p className="text-xs text-muted-foreground">
                            Khu vực được giám sát
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Trạng thái thiết bị */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Trạng thái thiết bị</CardTitle>
                        <CardDescription>Tổng quan trạng thái kết nối</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Wifi className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm">Online</span>
                                </div>
                                <span className="font-semibold">{stats.devices.online}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-emerald-600 h-2 rounded-full transition-all"
                                    style={{ width: `${stats.devices.total > 0 ? (stats.devices.online / stats.devices.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <WifiOff className="h-4 w-4 text-gray-600" />
                                    <span className="text-sm">Offline</span>
                                </div>
                                <span className="font-semibold">{stats.devices.offline}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-gray-600 h-2 rounded-full transition-all"
                                    style={{ width: `${stats.devices.total > 0 ? (stats.devices.offline / stats.devices.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm">Mất kết nối</span>
                                </div>
                                <span className="font-semibold">{stats.devices.disconnected}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-red-600 h-2 rounded-full transition-all"
                                    style={{ width: `${stats.devices.total > 0 ? (stats.devices.disconnected / stats.devices.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm">Bảo trì</span>
                                </div>
                                <span className="font-semibold">{stats.devices.maintenance}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{ width: `${stats.devices.total > 0 ? (stats.devices.maintenance / stats.devices.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Thiết bị theo tỉnh/thành */}
                <Card>
                    <CardHeader>
                        <CardTitle>Thiết bị theo tỉnh/thành</CardTitle>
                        <CardDescription>Phân bổ thiết bị theo khu vực địa lý</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.devices.byProvince.map((item) => (
                                <div key={item.province_code} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">{item.province_name || "Không rõ"}</span>
                                        <span className="font-semibold">{item.count}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${stats.devices.total > 0 ? (item.count / stats.devices.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Số lượng mẫu cảm biến theo giờ (24h) */}
            <Card>
                <CardHeader>
                    <CardTitle>Số lượng mẫu cảm biến 24h qua</CardTitle>
                    <CardDescription>Biểu đồ cột thể hiện số lượng mẫu dữ liệu được ghi nhận mỗi giờ</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingSensor && (
                        <div className="text-sm text-muted-foreground">Đang tải biểu đồ...</div>
                    )}
                    {!loadingSensor && sensorTypes.length === 0 && (
                        <div className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử cảm biến.</div>
                    )}
                    {!loadingSensor && sensorTypes.length > 0 && (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {sensorTypes.map((type) => {
                                const series = sensorSeries[type] || [];

                                // Format dữ liệu cho Recharts - gom theo giờ (kèm ngày) và lấy 24 giờ gần nhất
                                const sortedSeries = [...series].sort(
                                    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
                                );
                                const uniqueHours = new Map<number, number>();

                                // Group theo mốc giờ (đã set phút/giây về 0) để tránh ghi đè giữa các ngày
                                sortedSeries.forEach((p) => {
                                    const date = new Date(p.time);
                                    date.setMinutes(0, 0, 0);
                                    const bucket = date.getTime();
                                    uniqueHours.set(bucket, (uniqueHours.get(bucket) || 0) + p.count);
                                });

                                // Lấy 24 giờ gần nhất và format nhãn giờ + ngày
                                const chartData = Array.from(uniqueHours.entries())
                                    .sort((a, b) => a[0] - b[0])
                                    .slice(-24)
                                    .map(([bucket, count]) => {
                                        const d = new Date(bucket);
                                        const timeLabel = `${d
                                            .toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
                                        return {
                                            time: timeLabel,
                                            "Số mẫu": count,
                                        };
                                    });

                                const totalSamples = series.reduce((sum, p) => sum + p.count, 0);
                                const maxSamples = maxCountByType[type] || 0;

                                const colorMap: Record<string, string> = {
                                    rainfall: "hsl(221.2 83.2% 53.3%)",
                                    humidity: "hsl(142.1 76.2% 36.3%)",
                                    vibration: "hsl(0 84.2% 60.2%)",
                                    position: "hsl(262.1 83.3% 57.8%)",
                                    slope: "hsl(43.3 96.4% 56.3%)",
                                };
                                const barColor = colorMap[type] || "hsl(221.2 83.2% 53.3%)";

                                const chartConfig = {
                                    "Số mẫu": {
                                        label: "Số mẫu",
                                        color: barColor,
                                    },
                                };

                                return (
                                    <div key={type} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            {type === "rainfall" && <CloudRain className="h-5 w-5 text-blue-600" />}
                                            {type === "humidity" && <Droplets className="h-5 w-5 text-emerald-600" />}
                                            {type === "vibration" && <Activity className="h-5 w-5 text-red-600" />}
                                            {type === "position" && <Cpu className="h-5 w-5 text-indigo-600" />}
                                            {type === "slope" && <Gauge className="h-5 w-5 text-amber-600" />}
                                            <span className="text-base font-semibold text-slate-900">
                                                {type === "vibration"
                                                    ? "Cảm biến rung"
                                                    : type === "rainfall"
                                                    ? "Lượng mưa"
                                                    : type === "humidity"
                                                    ? "Độ ẩm"
                                                    : type === "position"
                                                    ? "Vị trí"
                                                    : type === "slope"
                                                    ? "Độ dốc"
                                                    : type}
                                            </span>
                                        </div>
                                        {series.length === 0 ? (
                                            <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
                                                Chưa có dữ liệu trong khoảng thời gian này
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                                        <span className="font-medium">Trục Y: Số lượng mẫu (mẫu/giờ)</span>
                                                        <span className="text-muted-foreground">Trục X: Thời gian (giờ)</span>
                                                    </div>
                                                </div>
                                                <ChartContainer config={chartConfig} className="h-64">
                                                    <RechartsBarChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                        <XAxis
                                                            dataKey="time"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            className="text-xs"
                                                        />
                                                        <YAxis
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            className="text-xs"
                                                            label={{ value: "Số mẫu", angle: -90, position: "insideLeft" }}
                                                        />
                                                        <ChartTooltip content={<ChartTooltipContent />} />
                                                        <Bar
                                                            dataKey="Số mẫu"
                                                            fill={barColor}
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                    </RechartsBarChart>
                                                </ChartContainer>
                                                <div className="flex items-center justify-between text-xs text-slate-600 px-2">
                                                    <span>Tổng: <span className="font-semibold text-slate-900">{totalSamples}</span> mẫu</span>
                                                    <span>Max: <span className="font-semibold text-slate-900">{maxSamples}</span> mẫu/giờ</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Giá trị trung bình cảm biến theo giờ (24h) */}
            <Card>
                <CardHeader>
                    <CardTitle>Giá trị trung bình cảm biến 24h qua</CardTitle>
                    <CardDescription>Biểu đồ vùng thể hiện giá trị đo được trung bình mỗi giờ</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingSensor && (
                        <div className="text-sm text-muted-foreground">Đang tải biểu đồ...</div>
                    )}
                    {!loadingSensor && sensorTypes.length === 0 && (
                        <div className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử cảm biến.</div>
                    )}
                    {!loadingSensor && sensorTypes.length > 0 && (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {sensorTypes.map((type) => {
                                const series = sensorSeries[type] || [];

                                // Format dữ liệu cho Recharts - giá trị trung bình theo giờ (kèm ngày) và loại trùng lặp
                                const sortedSeries = [...series]
                                    .filter((p) => p.avg_value !== null)
                                    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

                                const uniqueHours = new Map<number, { sum: number; count: number }>();

                                // Group theo mốc giờ (đã set phút/giây về 0) để tránh ghi đè giữa các ngày
                                sortedSeries.forEach((p) => {
                                    const date = new Date(p.time);
                                    date.setMinutes(0, 0, 0);
                                    const bucket = date.getTime();
                                    const existing = uniqueHours.get(bucket) || { sum: 0, count: 0 };
                                    uniqueHours.set(bucket, {
                                        sum: existing.sum + (p.avg_value || 0),
                                        count: existing.count + 1,
                                    });
                                });

                                // Lấy 24 giờ gần nhất và format nhãn giờ + ngày
                                const chartData = Array.from(uniqueHours.entries())
                                    .sort((a, b) => a[0] - b[0])
                                    .slice(-24)
                                    .map(([bucket, { sum, count }]) => {
                                        const d = new Date(bucket);
                                        const timeLabel = `${d
                                            .toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
                                        return {
                                            time: timeLabel,
                                            "Giá trị TB": Number((sum / count).toFixed(2)),
                                        };
                                    });

                                const unitLabels: Record<string, string> = {
                                    rainfall: "mm",
                                    humidity: "%",
                                    vibration: "g",
                                    position: "mm",
                                    slope: "°",
                                };
                                const unit = unitLabels[type] || "";

                                const colorMap: Record<string, string> = {
                                    rainfall: "hsl(221.2 83.2% 53.3%)",
                                    humidity: "hsl(142.1 76.2% 36.3%)",
                                    vibration: "hsl(0 84.2% 60.2%)",
                                    position: "hsl(262.1 83.3% 57.8%)",
                                    slope: "hsl(43.3 96.4% 56.3%)",
                                };
                                const areaColor = colorMap[type] || "hsl(221.2 83.2% 53.3%)";

                                const chartConfig = {
                                    "Giá trị TB": {
                                        label: `Giá trị TB (${unit})`,
                                        color: areaColor,
                                    },
                                };

                                return (
                                    <div key={type} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            {type === "rainfall" && <CloudRain className="h-5 w-5 text-blue-600" />}
                                            {type === "humidity" && <Droplets className="h-5 w-5 text-emerald-600" />}
                                            {type === "vibration" && <Activity className="h-5 w-5 text-red-600" />}
                                            {type === "position" && <Cpu className="h-5 w-5 text-indigo-600" />}
                                            {type === "slope" && <Gauge className="h-5 w-5 text-amber-600" />}
                                            <span className="text-base font-semibold text-slate-900">
                                                {type === "vibration"
                                                    ? "Cảm biến rung"
                                                    : type === "rainfall"
                                                    ? "Lượng mưa"
                                                    : type === "humidity"
                                                    ? "Độ ẩm"
                                                    : type === "position"
                                                    ? "Vị trí"
                                                    : type === "slope"
                                                    ? "Độ dốc"
                                                    : type}
                                            </span>
                                            <span className="text-xs text-muted-foreground">({unit})</span>
                                        </div>
                                        {chartData.length === 0 ? (
                                            <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
                                                Chưa có giá trị trung bình trong khoảng thời gian này
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                                        <span className="font-medium">Trục Y: Giá trị đo được ({unit})</span>
                                                        <span className="text-muted-foreground">Trục X: Thời gian (giờ)</span>
                                                    </div>
                                                </div>
                                                <ChartContainer config={chartConfig} className="h-64">
                                                    <RechartsAreaChart data={chartData}>
                                                        <defs>
                                                            <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={areaColor} stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor={areaColor} stopOpacity={0.1} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                        <XAxis
                                                            dataKey="time"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            className="text-xs"
                                                        />
                                                        <YAxis
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            className="text-xs"
                                                            label={{ value: `Giá trị (${unit})`, angle: -90, position: "insideLeft" }}
                                                        />
                                                        <ChartTooltip
                                                            content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(2)} ${unit}`} />}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="Giá trị TB"
                                                            stroke={areaColor}
                                                            fill={`url(#gradient-${type})`}
                                                            strokeWidth={2}
                                                        />
                                                    </RechartsAreaChart>
                                                </ChartContainer>
                                                <div className="flex items-center justify-between text-xs text-slate-600 px-2">
                                                    <span>
                                                        Giá trị TB: <span className="font-semibold text-slate-900">
                                                            {(chartData.reduce((sum, d) => sum + (d["Giá trị TB"] || 0), 0) / chartData.length).toFixed(2)} {unit}
                                                        </span>
                                                    </span>
                                                    <span>
                                                        Max: <span className="font-semibold text-slate-900">
                                                            {Math.max(...chartData.map(d => d["Giá trị TB"] || 0)).toFixed(2)} {unit}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Top thiết bị gửi dữ liệu trong 24h */}
            <Card>
                <CardHeader>
                    <CardTitle>Thiết bị gửi dữ liệu nhiều nhất (24h)</CardTitle>
                    <CardDescription>Top 5 theo số bản ghi lịch sử</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingSensor ? (
                        <div className="text-sm text-muted-foreground">Đang tải...</div>
                    ) : topDevices.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Chưa có dữ liệu.</div>
                    ) : (
                        <div className="space-y-2">
                            {topDevices.map((d) => (
                                <div key={d.device_id} className="flex items-center justify-between rounded-md border p-3 bg-slate-50">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-600" />
                                        <span className="text-sm font-semibold">{d.device_id}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">{d.samples} mẫu</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Mức độ nguy hiểm sự kiện */}
            <Card>
                <CardHeader>
                    <CardTitle>Mức độ nguy hiểm sự kiện</CardTitle>
                    <CardDescription>Phân bổ theo mức độ nghiêm trọng</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-5">
                        {[1, 2, 3, 4, 5].map((level) => {
                            const count = stats.events.severity[level as keyof typeof stats.events.severity];
                            const colors = {
                                1: "bg-green-100 text-green-800 border-green-300",
                                2: "bg-blue-100 text-blue-800 border-blue-300",
                                3: "bg-yellow-100 text-yellow-800 border-yellow-300",
                                4: "bg-orange-100 text-orange-800 border-orange-300",
                                5: "bg-red-100 text-red-800 border-red-300",
                            };
                            const labels = {
                                1: "Rất thấp",
                                2: "Thấp",
                                3: "Trung bình",
                                4: "Cao",
                                5: "Rất cao",
                            };
                            return (
                                <div
                                    key={level}
                                    className={cn(
                                        "rounded-lg border p-4 text-center",
                                        colors[level as keyof typeof colors]
                                    )}
                                >
                                    <div className="text-2xl font-bold">{count}</div>
                                    <div className="text-xs mt-1">Mức {level}</div>
                                    <div className="text-xs mt-1 opacity-75">{labels[level as keyof typeof labels]}</div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Sự kiện 7 ngày gần nhất */}
            {stats.events.last7Days.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sự kiện 7 ngày gần nhất</CardTitle>
                        <CardDescription>Xu hướng sự kiện theo thời gian</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2 h-48">
                            {stats.events.last7Days.map((item, index) => {
                                const maxCount = Math.max(...stats.events.last7Days.map(d => d.count), 1);
                                const height = (item.count / maxCount) * 100;
                                const date = new Date(item.date);
                                return (
                                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                        <div className="w-full flex items-end justify-center" style={{ height: '180px' }}>
                                            <div
                                                className="w-full bg-blue-600 rounded-t transition-all hover:bg-blue-700"
                                                style={{ height: `${height}%` }}
                                                title={`${item.count} sự kiện`}
                                            />
                                        </div>
                                        <div className="text-xs text-muted-foreground text-center">
                                            {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                        </div>
                                        <div className="text-sm font-semibold">{item.count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Thao tác nhanh</CardTitle>
                    <CardDescription>Truy cập nhanh các chức năng</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                        <Button variant="outline" onClick={() => router.push('/devices')} className="h-auto flex-col py-4">
                            <Radio className="h-5 w-5 mb-2" />
                            <span>Quản lý thiết bị</span>
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/admin')} className="h-auto flex-col py-4">
                            <Activity className="h-5 w-5 mb-2" />
                            <span>Quản lý sự kiện</span>
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/map')} className="h-auto flex-col py-4">
                            <MapPin className="h-5 w-5 mb-2" />
                            <span>Xem bản đồ</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}