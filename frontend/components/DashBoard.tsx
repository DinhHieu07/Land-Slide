"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { authenticatedFetch } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import {
    Activity,
    AlertTriangle,
    MapPin,
    Radio,
    Wifi,
    AlertCircle,
    Settings,
    Zap,
    Droplets,
    CloudRain,
    Gauge,
    Cpu,
    RefreshCw,
    XCircle,
    Clock,
    CheckCircle,
    Info,
    History,
    User,
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
    LineChart,
    Line,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Server } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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

type DeviceSensorData = {
    sensor_code: string;
    sensor_name: string;
    sensor_type: string;
    data: Array<{
        time: string;
        count: number;
        avg_value: number | null;
        min_value: number | null;
        max_value: number | null;
    }>;
};

type DeviceInfo = {
    device_id: string;
    name: string;
    status: string;
    last_seen: string;
    province_id: number | null;
    province_name: string | null;
};

type DeviceOption = {
    device_id: string;
    name: string;
};

type AlertStats = {
    active_count: number;
    acknowledged_count: number;
    resolved_count: number;
    critical_count: number;
    warning_count: number;
    info_count: number;
    total_count: number;
};

export default function DashboardView() {
    const router = useRouter();
    const { isAuthenticated, isAdmin, isSuperAdmin, loading } = useAuth();
    const { socket, isConnected } = useSocket();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [sensorSeries, setSensorSeries] = useState<SensorSeries>({});
    const [topDevices, setTopDevices] = useState<Array<{ device_id: string; samples: number }>>([]);
    const [loadingSensor, setLoadingSensor] = useState(true);
    const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
    const [loadingAlertStats, setLoadingAlertStats] = useState(true);
    const [provincePage, setProvincePage] = useState(1);
    const itemsPerPage = 3;
    
    // State cho section chi tiết theo thiết bị
    const [devices, setDevices] = useState<DeviceOption[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [deviceSensorData, setDeviceSensorData] = useState<DeviceSensorData[]>([]);
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [loadingDeviceData, setLoadingDeviceData] = useState(false);

    // Lấy username từ localStorage (nếu có)
    const getUsername = () => {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            return user?.username || null;
        } catch {
            return null;
        }
    };
    const username = getUsername();

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchStats();
            fetchSensorStats();
            fetchAlertStats();
            fetchDevices();
        }
    }, [isAuthenticated, isAdmin, username]);

    useEffect(() => {
        if (selectedDeviceId && isAuthenticated && isAdmin) {
            fetchDeviceSensorData(selectedDeviceId);
        } else {
            setDeviceSensorData([]);
            setDeviceInfo(null);
        }
    }, [selectedDeviceId, isAuthenticated, isAdmin, username]);

    // Debounce timer ref để tránh quá nhiều requests
    const sensorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Real-time updates via socket
    useEffect(() => {
        if (!socket || !isConnected || !isAuthenticated) {
            return;
        }

        const handleNewAlert = () => {
            // Refresh alert stats khi có cảnh báo mới
            fetchAlertStats();
        };

        const handleAlertUpdated = () => {
            // Refresh alert stats khi cảnh báo được cập nhật
            fetchAlertStats();
        };

        const handleSensorDataUpdate = (data: {
            device_id: string;
            sensor_id: number;
            sensor_code: string;
            sensor_name: string;
            sensor_type: string;
            value: number;
            unit: string;
            recorded_at: string;
        }) => {
            const recordedAt = new Date(data.recorded_at);
            const timeBucket = new Date(recordedAt);
            timeBucket.setMinutes(0, 0, 0); // Round to hour
            
            // Cập nhật trực tiếp vào state để biểu đồ tự động cập nhật ngay
            if (!selectedDeviceId) {
                // Cập nhật biểu đồ tổng quan
                setSensorSeries((prev) => {
                    const newSeries = { ...prev };
                    const sensorType = data.sensor_type;
                    
                    if (!newSeries[sensorType]) {
                        newSeries[sensorType] = [];
                    }
                    
                    // Tìm xem đã có data point cho time bucket này chưa
                    const existingIndex = newSeries[sensorType].findIndex(
                        (item) => new Date(item.time).getTime() === timeBucket.getTime()
                    );
                    
                    if (existingIndex >= 0) {
                        // Cập nhật existing point
                        const existing = newSeries[sensorType][existingIndex];
                        newSeries[sensorType][existingIndex] = {
                            ...existing,
                            count: existing.count + 1,
                            avg_value: existing.avg_value !== null 
                                ? (existing.avg_value * existing.count + data.value) / (existing.count + 1)
                                : data.value
                        };
                    } else {
                        // Thêm data point mới
                        newSeries[sensorType].push({
                            time: timeBucket.toISOString(),
                            count: 1,
                            avg_value: data.value
                        });
                    }
                    
                    // Giữ tối đa 24 giờ gần nhất
                    newSeries[sensorType] = newSeries[sensorType]
                        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                        .slice(-24);
                    
                    return newSeries;
                });
            } else if (data.device_id === selectedDeviceId) {
                // Cập nhật biểu đồ chi tiết theo thiết bị
                setDeviceSensorData((prev) => {
                    const newData = [...prev];
                    const sensorKey = `${data.sensor_code}_${data.sensor_type}`;
                    
                    let sensorIndex = newData.findIndex(
                        (s) => s.sensor_code === data.sensor_code && s.sensor_type === data.sensor_type
                    );
                    
                    if (sensorIndex < 0) {
                        // Thêm sensor mới
                        newData.push({
                            sensor_code: data.sensor_code,
                            sensor_name: data.sensor_name,
                            sensor_type: data.sensor_type,
                            data: []
                        });
                        sensorIndex = newData.length - 1;
                    }
                    
                    const sensor = newData[sensorIndex];
                    const existingIndex = sensor.data.findIndex(
                        (item) => new Date(item.time).getTime() === timeBucket.getTime()
                    );
                    
                    if (existingIndex >= 0) {
                        // Cập nhật existing point
                        const existing = sensor.data[existingIndex];
                        const newCount = existing.count + 1;
                        sensor.data[existingIndex] = {
                            ...existing,
                            count: newCount,
                            avg_value: existing.avg_value !== null
                                ? (existing.avg_value * existing.count + data.value) / newCount
                                : data.value,
                            min_value: existing.min_value !== null 
                                ? Math.min(existing.min_value, data.value)
                                : data.value,
                            max_value: existing.max_value !== null
                                ? Math.max(existing.max_value, data.value)
                                : data.value
                        };
                    } else {
                        // Thêm data point mới
                        sensor.data.push({
                            time: timeBucket.toISOString(),
                            count: 1,
                            avg_value: data.value,
                            min_value: data.value,
                            max_value: data.value
                        });
                    }
                    
                    // Giữ tối đa 24 giờ gần nhất
                    sensor.data = sensor.data
                        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                        .slice(-24);
                    
                    return newData;
                });
            }
            
            // Debounce: sync với server sau 5 giây để đảm bảo dữ liệu chính xác
            if (sensorUpdateTimeoutRef.current) {
                clearTimeout(sensorUpdateTimeoutRef.current);
            }
            
            sensorUpdateTimeoutRef.current = setTimeout(() => {
                if (!selectedDeviceId) {
                    fetchSensorStats();
                } else if (data.device_id === selectedDeviceId) {
                    fetchDeviceSensorData(selectedDeviceId);
                }
            }, 5000);
        };

        const handleDeviceStatusUpdate = (data: {
            device_id: string;
            status: string;
            last_seen: string;
            updated_at: string;
        }) => {
            // Refresh stats khi có device chuyển trạng thái
            fetchStats();
        };

        socket.on("new_alert", handleNewAlert);
        socket.on("alert_updated", handleAlertUpdated);
        socket.on("sensor_data_update", handleSensorDataUpdate);
        socket.on("device_status_updated", handleDeviceStatusUpdate);

        return () => {
            socket.off("new_alert", handleNewAlert);
            socket.off("alert_updated", handleAlertUpdated);
            socket.off("sensor_data_update", handleSensorDataUpdate);
            socket.off("device_status_updated", handleDeviceStatusUpdate);
            // Clear timeout khi cleanup
            if (sensorUpdateTimeoutRef.current) {
                clearTimeout(sensorUpdateTimeoutRef.current);
            }
        };
    }, [socket, isConnected, isAuthenticated, selectedDeviceId]);

    // Reset trang về 1 khi dữ liệu tỉnh thành thay đổi
    useEffect(() => {
        if (stats?.devices?.byProvince) {
            const totalPages = Math.max(1, Math.ceil(stats.devices.byProvince.length / itemsPerPage));
            if (provincePage > totalPages) {
                setProvincePage(1);
            }
        }
    }, [stats?.devices?.byProvince]);

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
            const params = new URLSearchParams();
            if (username) params.append("username", username);
            const res = await authenticatedFetch(`${API_URL}/api/dashboard/stats?${params.toString()}`, {
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
            const params = new URLSearchParams();
            params.append("hours", "24");
            params.append("interval", "hour");
            if (username) params.append("username", username);
            const res = await authenticatedFetch(`${API_URL}/api/dashboard/sensor-stats?${params.toString()}`, {
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

    const fetchAlertStats = async () => {
        try {
            setLoadingAlertStats(true);
            const params = new URLSearchParams();
            if (username) params.append("username", username);
            const res = await authenticatedFetch(`${API_URL}/api/alerts/stats?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setAlertStats(data.data);
            }
        } catch (error) {
            console.error("Lỗi khi lấy thống kê cảnh báo:", error);
        } finally {
            setLoadingAlertStats(false);
        }
    };

    const fetchDevices = async () => {
        try {
            const params = new URLSearchParams();
            if (username) params.append("username", username);
            params.append("limit", "1000");
            params.append("offset", "0");
            const res = await authenticatedFetch(`${API_URL}/api/devices?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const deviceOptions = (data.data || []).map((d: { device_id: string; name: string }) => ({
                    device_id: d.device_id,
                    name: d.name || d.device_id,
                }));
                setDevices(deviceOptions);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách thiết bị:", error);
        }
    };

    const fetchDeviceSensorData = async (deviceId: string) => {
        try {
            setLoadingDeviceData(true);
            const params = new URLSearchParams();
            params.append("device_id", deviceId);
            params.append("hours", "24");
            params.append("interval", "hour");
            if (username) params.append("username", username);
            const res = await authenticatedFetch(`${API_URL}/api/dashboard/sensor-stats-by-device?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setDeviceSensorData(data.sensors || []);
                setDeviceInfo(data.device || null);
            }
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu cảm biến thiết bị:", error);
            setDeviceSensorData([]);
            setDeviceInfo(null);
        } finally {
            setLoadingDeviceData(false);
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
        <div className="space-y-6">

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tổng quan hệ thống giám sát sạt lở đất
                    </p>
                </div>
            </div>
            {/* <div className="flex gap-2 justify-end">
                <Button onClick={() => { fetchStats(); fetchSensorStats(); fetchAlertStats(); }} variant="outline">
                    <RefreshCw className="size-4 mr-2" />
                    Làm mới
                </Button>
            </div> */}
            <div className="text-gray-800 flex items-center gap-2">
                <Server size={20} /> Giám sát thiết bị
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

                {/* Thiết bị đang hoạt động */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Thiết bị đang hoạt động</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.devices.online}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.devices.total > 0
                                ? `${Math.round((stats.devices.online / stats.devices.total) * 100)}% tổng thiết bị`
                                : "Chưa có thiết bị"}
                        </p>
                    </CardContent>
                </Card>

                {/* Thiết bị mất kết nối */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Thiết bị mất kết nối</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.devices.disconnected}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.devices.disconnected > 0
                                ? "Cần kiểm tra và xử lý"
                                : "Tất cả thiết bị đã kết nối"}
                        </p>
                    </CardContent>
                </Card>

                {/* Thiết bị bảo trì */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Thiết bị bảo trì</CardTitle>
                        <Settings className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.devices.maintenance}</div>
                    </CardContent>
                </Card>

                {/* Tổng cảnh báo */}
                {/* <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cảnh báo</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingAlertStats ? "..." : (alertStats?.total_count || stats.alerts.total || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {alertStats?.active_count ? `${alertStats.active_count} đang bị lỗi` : "Tổng số cảnh báo hệ thống"}
                        </p>
                    </CardContent>
                </Card> */}
            </div>

            <h2 className="text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle size={20} /> Tình trạng cảnh báo
            </h2>

            {/* Thống kê cảnh báo chi tiết */}
            {alertStats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Đang bị lỗi</CardDescription>
                            <CardTitle className="text-3xl font-bold text-red-600">{alertStats.active_count}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <AlertTriangle className="size-4 text-red-500" />
                                <span>Cần xử lý ngay</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-amber-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Cảnh báo nghiêm trọng</CardDescription>
                            <CardTitle className="text-3xl font-bold text-amber-600">{alertStats.critical_count}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <XCircle className="size-4 text-amber-500" />
                                <span>Mức độ cao</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-yellow-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Đã xác nhận</CardDescription>
                            <CardTitle className="text-3xl font-bold text-yellow-600">{alertStats.acknowledged_count}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="size-4 text-yellow-500" />
                                <span>Đang xử lý</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Đã xử lý</CardDescription>
                            <CardTitle className="text-3xl font-bold text-green-600">{alertStats.resolved_count}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CheckCircle className="size-4 text-green-500" />
                                <span>Hoàn thành</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Phân bố cảnh báo theo mức độ */}
            {alertStats && (
                <Card>
                    <CardHeader>
                        <CardTitle>Phân bố cảnh báo theo mức độ</CardTitle>
                        <CardDescription>Thống kê cảnh báo theo mức độ nghiêm trọng</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-lg border p-4 bg-red-50 border-red-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <XCircle className="h-5 w-5 text-red-600" />
                                        <span className="text-sm font-medium">Nghiêm trọng</span>
                                    </div>
                                    <span className="text-2xl font-bold text-red-600">{alertStats.critical_count}</span>
                                </div>
                            </div>
                            <div className="rounded-lg border p-4 bg-amber-50 border-amber-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                        <span className="text-sm font-medium">Cảnh báo</span>
                                    </div>
                                    <span className="text-2xl font-bold text-amber-600">{alertStats.warning_count}</span>
                                </div>
                            </div>
                            <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-5 w-5 text-blue-600" />
                                        <span className="text-sm font-medium">Thông tin</span>
                                    </div>
                                    <span className="text-2xl font-bold text-blue-600">{alertStats.info_count}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                                    <span className="text-sm">Hoạt động</span>
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

                        {/* <div className="space-y-2">
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
                        </div> */}

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
                        {(() => {
                            const provinces = stats.devices.byProvince || [];
                            const totalPages = Math.max(1, Math.ceil(provinces.length / itemsPerPage));
                            const startIndex = (provincePage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const currentProvinces = provinces.slice(startIndex, endIndex);

                            return (
                                <>
                                    <div className="space-y-3">
                                        {currentProvinces.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                Không có dữ liệu
                                            </p>
                                        ) : (
                                            currentProvinces.map((item) => (
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
                                            ))
                                        )}
                                    </div>
                                    {provinces.length > itemsPerPage && (
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                            <p className="text-sm text-muted-foreground">
                                                Trang {provincePage} / {totalPages} ({provinces.length} tỉnh thành)
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setProvincePage(1)}
                                                    disabled={provincePage === 1}
                                                >
                                                    Đầu
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setProvincePage((p) => Math.max(1, p - 1))}
                                                    disabled={provincePage === 1}
                                                >
                                                    Trước
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setProvincePage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={provincePage === totalPages}
                                                >
                                                    Tiếp
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setProvincePage(totalPages)}
                                                    disabled={provincePage === totalPages}
                                                >
                                                    Cuối
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
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
                                    rainfall_24h: "hsl(221.2 83.2% 53.3%)",
                                    soil_moisture: "hsl(142.1 76.2% 36.3%)",
                                    vibration_g: "hsl(0 84.2% 60.2%)",
                                    tilt_deg: "hsl(262.1 83.3% 57.8%)",
                                    slope_deg: "hsl(43.3 96.4% 56.3%)",
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
                                            {type === "rainfall_24h" && <CloudRain className="h-5 w-5 text-blue-600" />}
                                            {type === "soil_moisture" && <Droplets className="h-5 w-5 text-emerald-600" />}
                                            {type === "vibration_g" && <Activity className="h-5 w-5 text-red-600" />}
                                            {type === "tilt_deg" && <Cpu className="h-5 w-5 text-indigo-600" />}
                                            {type === "slope_deg" && <Gauge className="h-5 w-5 text-amber-600" />}
                                            <span className="text-base font-semibold text-slate-900">
                                                {type === "vibration_g"
                                                    ? "Cảm biến rung (g)"
                                                    : type === "rainfall_24h"
                                                        ? "Lượng mưa 24h (mm)"
                                                        : type === "soil_moisture"
                                                            ? "Độ ẩm đất (%)"
                                                            : type === "tilt_deg"
                                                                ? "Độ nghiêng (°)"
                                                                : type === "slope_deg"
                                                                    ? "Độ dốc (°)"
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
                                    rainfall_24h: "mm",
                                    soil_moisture: "%",
                                    vibration_g: "g",
                                    tilt_deg: "°",
                                    slope_deg: "°",
                                };
                                const unit = unitLabels[type] || "";

                                const colorMap: Record<string, string> = {
                                    rainfall_24h: "hsl(221.2 83.2% 53.3%)",
                                    soil_moisture: "hsl(142.1 76.2% 36.3%)",
                                    vibration_g: "hsl(0 84.2% 60.2%)",
                                    tilt_deg: "hsl(262.1 83.3% 57.8%)",
                                    slope_deg: "hsl(43.3 96.4% 56.3%)",
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

            {/* Chi tiết dữ liệu theo thiết bị */}
            <Card>
                <CardHeader>
                    <CardTitle>Chi tiết dữ liệu theo thiết bị</CardTitle>
                    <CardDescription>Xem dữ liệu cảm biến của từng thiết bị cụ thể</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="device-select" className="text-sm font-medium min-w-[120px]">
                            Chọn thiết bị:
                        </Label>
                        <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                            <SelectTrigger id="device-select" className="w-full max-w-md">
                                <SelectValue placeholder="Chọn thiết bị để xem chi tiết" />
                            </SelectTrigger>
                            <SelectContent>
                                {devices.length === 0 ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                        Không có thiết bị
                                    </div>
                                ) : (
                                    devices.map((device) => (
                                        <SelectItem key={device.device_id} value={device.device_id}>
                                            {device.name} ({device.device_id})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedDeviceId && deviceInfo && (
                        <div className="rounded-lg border bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">{deviceInfo.name}</h3>
                                    <p className="text-sm text-muted-foreground">ID: {deviceInfo.device_id}</p>
                                    {deviceInfo.province_name && (
                                        <p className="text-sm text-muted-foreground">Tỉnh thành: {deviceInfo.province_name}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <Badge
                                        className={
                                            deviceInfo.status === "online"
                                                ? "bg-green-100 text-green-800"
                                                : deviceInfo.status === "offline"
                                                    ? "bg-gray-100 text-gray-700"
                                                    : deviceInfo.status === "disconnected"
                                                        ? "bg-red-100 text-red-800"
                                                        : "bg-blue-100 text-blue-800"
                                        }
                                    >
                                        {deviceInfo.status === "online"
                                            ? "Đang hoạt động"
                                            : deviceInfo.status === "offline"
                                                ? "Offline"
                                                : deviceInfo.status === "disconnected"
                                                    ? "Mất kết nối"
                                                    : "Bảo trì"}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Cập nhật: {new Date(deviceInfo.last_seen).toLocaleString("vi-VN")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {loadingDeviceData && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
                        </div>
                    )}

                    {!loadingDeviceData && selectedDeviceId && deviceSensorData.length === 0 && (
                        <div className="text-center py-8 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Chưa có dữ liệu cảm biến trong 24h qua</p>
                        </div>
                    )}

                    {!loadingDeviceData && deviceSensorData.length > 0 && (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {deviceSensorData.map((sensor) => {
                                const sortedData = [...sensor.data].sort(
                                    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
                                );

                                // Format dữ liệu cho chart
                                const chartData = sortedData.slice(-24).map((d) => {
                                    const date = new Date(d.time);
                                    const timeLabel = `${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
                                    return {
                                        time: timeLabel,
                                        "Giá trị TB": d.avg_value || 0,
                                        "Min": d.min_value || 0,
                                        "Max": d.max_value || 0,
                                    };
                                });

                                const unitMap: Record<string, string> = {
                                    rainfall_24h: "mm",
                                    soil_moisture: "%",
                                    vibration_g: "g",
                                    tilt_deg: "°",
                                    slope_deg: "°",
                                };
                                const unit = unitMap[sensor.sensor_type] || "";

                                const colorMap: Record<string, string> = {
                                    rainfall_24h: "hsl(221.2 83.2% 53.3%)",
                                    soil_moisture: "hsl(142.1 76.2% 36.3%)",
                                    vibration_g: "hsl(0 84.2% 60.2%)",
                                    tilt_deg: "hsl(262.1 83.3% 57.8%)",
                                    slope_deg: "hsl(43.3 96.4% 56.3%)",
                                };
                                const lineColor = colorMap[sensor.sensor_type] || "hsl(221.2 83.2% 53.3%)";

                                const chartConfig = {
                                    "Giá trị TB": {
                                        label: "Giá trị TB",
                                        color: lineColor,
                                    },
                                    "Min": {
                                        label: "Min",
                                        color: "hsl(0 0% 70%)",
                                    },
                                    "Max": {
                                        label: "Max",
                                        color: "hsl(0 0% 70%)",
                                    },
                                };

                                return (
                                    <div key={`${sensor.sensor_code}_${sensor.sensor_type}`} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            {sensor.sensor_type === "rainfall_24h" && <CloudRain className="h-5 w-5 text-blue-600" />}
                                            {sensor.sensor_type === "soil_moisture" && <Droplets className="h-5 w-5 text-emerald-600" />}
                                            {sensor.sensor_type === "vibration_g" && <Activity className="h-5 w-5 text-red-600" />}
                                            {sensor.sensor_type === "tilt_deg" && <Cpu className="h-5 w-5 text-indigo-600" />}
                                            {sensor.sensor_type === "slope_deg" && <Gauge className="h-5 w-5 text-amber-600" />}
                                            <div>
                                                <span className="text-base font-semibold text-slate-900">{sensor.sensor_name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">({sensor.sensor_code})</span>
                                            </div>
                                        </div>
                                        {chartData.length === 0 ? (
                                            <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
                                                Chưa có dữ liệu trong khoảng thời gian này
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <ChartContainer config={chartConfig} className="h-64">
                                                    <LineChart data={chartData}>
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
                                                        <Line
                                                            type="monotone"
                                                            dataKey="Giá trị TB"
                                                            stroke={lineColor}
                                                            strokeWidth={2}
                                                            dot={false}
                                                        />
                                                    </LineChart>
                                                </ChartContainer>
                                                <div className="flex items-center justify-between text-xs text-slate-600 px-2">
                                                    <span>
                                                        TB: <span className="font-semibold text-slate-900">
                                                            {(chartData.reduce((sum, d) => sum + (d["Giá trị TB"] || 0), 0) / chartData.length).toFixed(2)} {unit}
                                                        </span>
                                                    </span>
                                                    <span>
                                                        Min: <span className="font-semibold text-slate-900">
                                                            {Math.min(...chartData.map(d => d["Min"] || 0)).toFixed(2)} {unit}
                                                        </span>
                                                    </span>
                                                    <span>
                                                        Max: <span className="font-semibold text-slate-900">
                                                            {Math.max(...chartData.map(d => d["Max"] || 0)).toFixed(2)} {unit}
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

            {/* Mức độ nguy hiểm sự kiện */}
            {/* <Card>
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
            </Card> */}

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
                        {isSuperAdmin && (
                        <Button variant="outline" onClick={() => router.push('/account')} className="h-auto flex-col py-4">
                                <User className="h-5 w-5 mb-2" />
                                <span>Quản lý tài khoản</span>
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => router.push('/map')} className="h-auto flex-col py-4">
                            <MapPin className="h-5 w-5 mb-2" />
                            <span>Xem bản đồ</span>
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/alerts')} className="h-auto flex-col py-4">
                            <AlertTriangle className="h-5 w-5 mb-2" />
                            <span>Quản lý cảnh báo</span>
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/history')} className="h-auto flex-col py-4">
                            <History className="h-5 w-5 mb-2" />
                            <span>Lịch sử hệ thống</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}