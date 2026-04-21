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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
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
        topProvincesLast30Days?: Array<{ province_code: string; province_name: string; count: number }>;
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
    warning_threshold?: number | null;
    danger_threshold?: number | null;
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

type ProvinceArea = {
    province_code: string;
    province_name: string;
    count: number;
};

type DeviceListItem = {
    device_id: string;
    name: string | null;
    area_id?: number | null;
    area_name?: string | null;
    province_code?: string | null;
    province_name?: string | null;
    status?: string | null;
    last_seen?: string | null;
    latest_data?: Record<string, unknown> | null;
};

type AreaNodeData = {
    node_key: string;
    node_id: string;
    device_id: string;
    device_name: string;
    node_status?: string | null;
    current_alert_level?: number;
    total_alert_count?: number;
    area_id: number | null;
    area_name: string;
    province_code: string | null;
    province_name: string;
    sensors: DeviceSensorData[];
};

type AreaOption = {
    id: number;
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
    const [allDevices, setAllDevices] = useState<DeviceListItem[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [deviceSensorData, setDeviceSensorData] = useState<DeviceSensorData[]>([]);
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [loadingDeviceData, setLoadingDeviceData] = useState(false);
    const deviceDetailRef = useRef<HTMLDivElement | null>(null);

    // State cho popup khu vực (theo tỉnh/thành)
    const [areaDialogOpen, setAreaDialogOpen] = useState(false);
    const [selectedArea, setSelectedArea] = useState<ProvinceArea | null>(null);
    const [areaDevices, setAreaDevices] = useState<DeviceOption[]>([]);
    const [selectedAreaDeviceId, setSelectedAreaDeviceId] = useState<string>("");
    const [areaDeviceSensorData, setAreaDeviceSensorData] = useState<DeviceSensorData[]>([]);
    const [areaDeviceInfo, setAreaDeviceInfo] = useState<DeviceInfo | null>(null);
    const [loadingAreaDeviceData, setLoadingAreaDeviceData] = useState(false);
    const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>("all");
    const [selectedAreaId, setSelectedAreaId] = useState<string>("all");
    const [areaOptions, setAreaOptions] = useState<AreaOption[]>([]);
    const [areaNodeData, setAreaNodeData] = useState<AreaNodeData[]>([]);
    const [loadingAreaNodes, setLoadingAreaNodes] = useState(false);
    const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
    const [isNodeSelected, setIsNodeSelected] = useState(false);

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
                setAllDevices((data.data || []) as DeviceListItem[]);
                const deviceOptions = (data.data || []).map((d: { device_id: string; name: string }) => ({
                    device_id: d.device_id,
                    name: d.name || d.device_id,
                }));
                setDevices(deviceOptions);
            } else {
                setAllDevices([]);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách thiết bị:", error);
            setAllDevices([]);
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

    const fetchDevicesByProvinceCode = async (provinceCode: string) => {
        try {
            const params = new URLSearchParams();
            params.append("limit", "200");
            params.append("offset", "0");
            params.append("provinceCode", provinceCode);
            if (username) params.append("username", username);

            const res = await authenticatedFetch(`${API_URL}/api/devices?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const deviceOptions = (data.data || []).map((d: DeviceListItem) => ({
                    device_id: d.device_id,
                    name: d.name || d.device_id,
                }));
                setAreaDevices(deviceOptions);
                // Chọn tự động thiết bị đầu tiên để hiện cảm biến
                const firstId = deviceOptions[0]?.device_id || "";
                setSelectedAreaDeviceId(firstId);
                if (!firstId) {
                    setAreaDeviceSensorData([]);
                    setAreaDeviceInfo(null);
                }
            } else {
                setAreaDevices([]);
                setSelectedAreaDeviceId("");
                setAreaDeviceSensorData([]);
                setAreaDeviceInfo(null);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách thiết bị theo khu vực:", error);
            setAreaDevices([]);
            setSelectedAreaDeviceId("");
            setAreaDeviceSensorData([]);
            setAreaDeviceInfo(null);
        }
    };

    const fetchAreaDeviceSensorData = async (deviceId: string) => {
        try {
            setLoadingAreaDeviceData(true);
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
                setAreaDeviceSensorData(data.sensors || []);
                setAreaDeviceInfo(data.device || null);
            } else {
                setAreaDeviceSensorData([]);
                setAreaDeviceInfo(null);
            }
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu cảm biến thiết bị (popup khu vực):", error);
            setAreaDeviceSensorData([]);
            setAreaDeviceInfo(null);
        } finally {
            setLoadingAreaDeviceData(false);
        }
    };

    const fetchAreaNodeSensorData = async () => {
        try {
            setLoadingAreaNodes(true);
            const params = new URLSearchParams();
            params.append("hours", "24");
            params.append("interval", "hour");
            if (selectedProvinceCode !== "all") params.append("province_code", selectedProvinceCode);
            if (selectedAreaId !== "all") params.append("area_id", selectedAreaId);
            if (username) params.append("username", username);

            const res = await authenticatedFetch(`${API_URL}/api/dashboard/sensor-stats-by-area?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            console.log(data);
            if (res.ok && data.success) {
                setAreaNodeData(data.nodes || []);
                setCurrentNodeIndex(0);
                setIsNodeSelected(false);
            } else {
                setAreaNodeData([]);
            }
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu cảm biến theo khu vực:", error);
            setAreaNodeData([]);
        } finally {
            setLoadingAreaNodes(false);
        }
    };

    useEffect(() => {
        if (areaDialogOpen && selectedArea?.province_code) {
            fetchDevicesByProvinceCode(selectedArea.province_code);
        } else {
            setAreaDevices([]);
            setSelectedAreaDeviceId("");
            setAreaDeviceSensorData([]);
            setAreaDeviceInfo(null);
            setLoadingAreaDeviceData(false);
        }
    }, [areaDialogOpen, selectedArea?.province_code]);

    useEffect(() => {
        if (areaDialogOpen && selectedAreaDeviceId) {
            fetchAreaDeviceSensorData(selectedAreaDeviceId);
        } else {
            setAreaDeviceSensorData([]);
            setAreaDeviceInfo(null);
        }
    }, [areaDialogOpen, selectedAreaDeviceId]);

    const provinceOptions = useMemo(() => {
        const map = new Map<string, string>();
        for (const d of allDevices) {
            if (d.province_code) {
                map.set(d.province_code, d.province_name || d.province_code);
            }
        }
        return Array.from(map.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }, [allDevices]);

    const fetchAreasByProvince = async (provinceCode: string) => {
        try {
            const params = new URLSearchParams();
            if (provinceCode !== "all") params.append("provinceCode", provinceCode);
            const res = await authenticatedFetch(`${API_URL}/api/areas/list-areas?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && Array.isArray(data.data)) {
                const options = data.data
                    .map((a: { id: number; name: string | null }) => ({
                        id: a.id,
                        name: a.name || `Khu vực #${a.id}`,
                    }))
                    .sort((a: AreaOption, b: AreaOption) => a.name.localeCompare(b.name, "vi"));
                setAreaOptions(options);
            } else {
                setAreaOptions([]);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách khu vực:", error);
            setAreaOptions([]);
        }
    };

    useEffect(() => {
        if (selectedProvinceCode !== "all") {
            const exists = provinceOptions.some((p) => p.code === selectedProvinceCode);
            if (!exists) {
                setSelectedProvinceCode("all");
            }
        }
    }, [provinceOptions, selectedProvinceCode]);

    useEffect(() => {
        if (selectedAreaId !== "all") {
            const areaIdNum = Number(selectedAreaId);
            const exists = areaOptions.some((a) => a.id === areaIdNum);
            if (!exists) {
                setSelectedAreaId("all");
            }
        }
    }, [areaOptions, selectedAreaId]);

    useEffect(() => {
        fetchAreasByProvince(selectedProvinceCode);
        setSelectedAreaId("all");
    }, [selectedProvinceCode]);

    useEffect(() => {
        if (!isAuthenticated || !isAdmin) return;
        fetchAreaNodeSensorData();
    }, [isAuthenticated, isAdmin, username, selectedProvinceCode, selectedAreaId]);

    const currentNode = areaNodeData[currentNodeIndex] || null;

    const getNodeLatestTime = (node: AreaNodeData): string | null => {
        let latestMs = -1;
        for (const sensor of node.sensors) {
            for (const r of sensor.data || []) {
                const t = new Date(r.time).getTime();
                if (Number.isFinite(t) && t > latestMs) {
                    latestMs = t;
                }
            }
        }
        return latestMs > 0 ? new Date(latestMs).toLocaleString("vi-VN") : null;
    };

    const getSensorWithDataCount = (node: AreaNodeData): number =>
        node.sensors.filter((s) => (s.data || []).some((d) => d.count > 0)).length;

    const areaNodeOverview = useMemo(() => {
        const total = areaNodeData.length;
        const active = areaNodeData.filter((n) => n.node_status === "online").length;
        const maintenance = areaNodeData.filter((n) => n.node_status === "maintenance").length;
        const disconnected = areaNodeData.filter((n) => n.node_status === "disconnected").length;
        return { total, active, maintenance, disconnected };
    }, [areaNodeData]);

    if (!isAuthenticated) {
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

    if (!isAdmin && !isSuperAdmin) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-red-600 font-semibold">Bạn cần quyền Admin hoặc SuperAdmin để truy cập trang này.</p>
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
            <div className="text-gray-800 flex items-center gap-2">
                <Server size={20} /> Giám sát thiết bị (Gateway)
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

            </div>

            <h2 className="text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle size={20} /> Tình trạng cảnh báo
            </h2>

            {/* Thống kê cảnh báo chi tiết */}
            {alertStats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Chưa xử lý</CardDescription>
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

            {/* Khu vực (dạng thẻ) */}
            <Card>
                <CardHeader>
                    <CardTitle>Khu vực giám sát</CardTitle>
                </CardHeader>
                <CardContent>
                    {(!stats.devices.byProvince || stats.devices.byProvince.length === 0) ? (
                        <div className="text-sm text-muted-foreground">Chưa có khu vực.</div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {stats.devices.byProvince.map((p) => (
                                <button
                                    key={p.province_code}
                                    type="button"
                                    onClick={() => {
                                        setSelectedArea(p);
                                        setAreaDialogOpen(true);
                                    }}
                                    className={cn(
                                        "text-left rounded-xl border bg-white p-4 shadow-sm transition-all",
                                        "hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 hover:cursor-pointer"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 truncate">
                                                {p.province_name || "Không rõ"}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="bg-slate-50">
                                            {p.count} thiết bị
                                        </Badge>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Top khu vực có nhiều cảnh báo nhất trong 30 ngày */}
            <Card>
                <CardHeader>
                    <CardTitle>Top khu vực có nhiều cảnh báo (30 ngày)</CardTitle>
                    <CardDescription>Dựa trên số cảnh báo ghi nhận theo tỉnh/thành trong 30 ngày gần nhất</CardDescription>
                </CardHeader>
                <CardContent>
                    {!stats.alerts.topProvincesLast30Days || stats.alerts.topProvincesLast30Days.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                            Chưa có cảnh báo nào trong 30 ngày gần đây.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.alerts.topProvincesLast30Days.map((item, index) => {
                                const totalAlerts = stats.alerts.total || 0;
                                const ratio =
                                    totalAlerts > 0 ? Math.min(100, (item.count / totalAlerts) * 100) : 0;

                                return (
                                    <div
                                        key={item.province_code || index}
                                        className="rounded-lg border p-3 flex flex-col gap-2 bg-slate-50"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
                                                    #{index + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                                        {item.province_name || "Không rõ"}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="bg-white">
                                                {item.count} cảnh báo
                                            </Badge>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                <span>Tỷ lệ trong tổng cảnh báo</span>
                                                <span className="font-semibold text-slate-900">
                                                    {totalAlerts > 0
                                                        ? `${((item.count / totalAlerts) * 100).toFixed(1)}%`
                                                        : "—"}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-700"
                                                    style={{ width: `${ratio}%` }}
                                                />
                                            </div>
                                        </div>
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

            {/* Chi tiết dữ liệu theo khu vực / node */}
            <Card ref={deviceDetailRef}>
                <CardHeader>
                    <CardTitle>Chi tiết dữ liệu cảm biến theo khu vực</CardTitle>
                    <CardDescription>Chọn tỉnh và khu vực, sau đó duyệt từng Node để xem 4 biểu đồ cảm biến</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Tỉnh / Thành</Label>
                            <Select value={selectedProvinceCode} onValueChange={setSelectedProvinceCode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn tỉnh thành" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả tỉnh thành</SelectItem>
                                    {provinceOptions.map((p) => (
                                        <SelectItem key={p.code} value={p.code}>
                                            {p.name} ({p.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Khu vực theo dõi</Label>
                            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn khu vực" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả khu vực</SelectItem>
                                    {areaOptions.map((a) => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            {a.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {loadingAreaNodes && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Đang tải dữ liệu theo khu vực...</p>
                        </div>
                    )}

                    {!loadingAreaNodes && areaNodeData.length === 0 && (
                        <div className="text-center py-8 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Không có dữ liệu node trong khu vực đã chọn</p>
                        </div>
                    )}

                    {!loadingAreaNodes && areaNodeData.length > 0 && (
                        <div className="space-y-4">
                            {/* Tổng quan */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card className="border-l-4 border-l-slate-500">
                                    <CardHeader className="pb-4">
                                        <CardDescription>Tổng node</CardDescription>
                                        <CardTitle className="text-3xl font-bold">{areaNodeOverview.total}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-l-4 border-l-emerald-500">
                                    <CardHeader className="pb-2">
                                        <CardDescription>Hoạt động</CardDescription>
                                        <CardTitle className="text-3xl font-bold text-emerald-600">{areaNodeOverview.active}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-l-4 border-l-blue-500">
                                    <CardHeader className="pb-2">
                                        <CardDescription>Bảo trì</CardDescription>
                                        <CardTitle className="text-3xl font-bold text-blue-600">{areaNodeOverview.maintenance}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-l-4 border-l-red-500">
                                    <CardHeader className="pb-2">
                                        <CardDescription>Mất kết nối</CardDescription>
                                        <CardTitle className="text-3xl font-bold text-red-600">{areaNodeOverview.disconnected}</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            {/* GRID NODE */}
                            <div>
                                <p className="text-sm font-semibold text-slate-900 mb-2">GRID NODE (Click vào Node để xem chi tiết từng cảm biến)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                                    {areaNodeData.map((n, idx) => {
                                        const latestTime = getNodeLatestTime(n);
                                        const sensorsWithData = getSensorWithDataCount(n);
                                        const isSelected = idx === currentNodeIndex && isNodeSelected;

                                        return (
                                            <button
                                                key={`${n.node_key}_${n.node_id}`}
                                                type="button"
                                                onClick={() => {
                                                    setCurrentNodeIndex(idx);
                                                    setIsNodeSelected(true);
                                                }}
                                                className={cn(
                                                    "rounded-lg border p-3 text-left bg-white hover:bg-slate-50 transition cursor-pointer",
                                                    isSelected && "border-blue-500 bg-blue-50"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                                            Node {n.node_id}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {n.device_name} • {n.province_name}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="bg-white">
                                                            Số cảm biến: {n.sensors.length}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="mt-2 space-y-2">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                                                        n.node_status === "online"
                                                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                                            : n.node_status === "disconnected"
                                                                ? "border-red-100 bg-red-50 text-red-700"
                                                                : n.node_status === "maintenance"
                                                                    ? "border-blue-100 bg-blue-50 text-blue-700"
                                                                    : "border-gray-100 bg-gray-50 text-gray-700"
                                                    )}>
                                                        <Radio className="size-3" />
                                                        {n.node_status === "online"
                                                            ? "Hoạt động"
                                                            : n.node_status === "disconnected"
                                                                ? "Mất kết nối"
                                                                : n.node_status === "maintenance"
                                                                    ? "Bảo trì"
                                                                    : "Không xác định"}
                                                    </span>

                                                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                                                        <Clock className="size-3" />
                                                        {latestTime ? `Dữ liệu gần nhất: ${latestTime}` : "Chưa có dữ liệu 24h"}
                                                    </span>

                                                    <span className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">
                                                        <Info className="size-3" />
                                                        {sensorsWithData}/{n.sensors.length} cảm biến có dữ liệu trong 24h
                                                    </span>

                                                    <div>
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                                                            (n.current_alert_level || 0) >= 3
                                                                ? "border-red-100 bg-red-50 text-red-700"
                                                                : (n.current_alert_level || 0) >= 2
                                                                    ? "border-amber-100 bg-amber-50 text-amber-700"
                                                                    : (n.current_alert_level || 0) >= 1
                                                                        ? "border-blue-100 bg-blue-50 text-blue-700"
                                                                        : "border-emerald-100 bg-emerald-50 text-emerald-700"
                                                        )}>
                                                            <AlertTriangle className="size-3" />
                                                            Mức cảnh báo: {(n.current_alert_level || 0) >= 3
                                                                ? "Nguy hiểm"
                                                                : (n.current_alert_level || 0) >= 2
                                                                    ? "Cảnh báo"
                                                                    : (n.current_alert_level || 0) >= 1
                                                                        ? "Thông tin"
                                                                        : "Bình thường"}
                                                        </span>

                                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                                                            <History className="size-3" />
                                                            Tổng cảnh báo quá khứ: {n.total_alert_count || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Drawer bên phải */}
                            <Sheet
                                open={isNodeSelected}
                                onOpenChange={(open) => {
                                    setIsNodeSelected(open);
                                }}
                            >
                                <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
                                    <SheetHeader>
                                        <SheetTitle>
                                            {currentNode ? `Node ${currentNode.node_id}` : "Node"}
                                        </SheetTitle>
                                        <SheetDescription>
                                            {currentNode
                                                ? `${currentNode.device_name} • ${currentNode.province_name} / ${currentNode.area_name}`
                                                : "Chưa có Node được chọn"}
                                        </SheetDescription>
                                    </SheetHeader>

                                    {currentNode ? (
                                        <div className="space-y-6">
                                            <div className="text-sm text-muted-foreground ml-4">
                                                4 biểu đồ cảm biến trong 24h
                                            </div>
                                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 ml-4 mr-4">
                                                {currentNode.sensors.map((sensor) => {
                                                    const sortedData = [...sensor.data].sort(
                                                        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
                                                    );
                                                    const chartData = sortedData.slice(-24).map((d) => {
                                                        const date = new Date(d.time);
                                                        return {
                                                            time: `${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`,
                                                            "Giá trị TB": d.avg_value || 0,
                                                            Min: d.min_value || 0,
                                                            Max: d.max_value || 0,
                                                        };
                                                    });

                                                    let max24: number | null = null;
                                                    sortedData.forEach((d) => {
                                                        if (d.max_value !== null && d.max_value !== undefined) {
                                                            const v = Number(d.max_value);
                                                            if (Number.isFinite(v)) {
                                                                max24 = max24 === null ? v : Math.max(max24, v);
                                                            }
                                                        }
                                                    });

                                                    const unitMap: Record<string, string> = {
                                                        rainfall: "%",
                                                        soil_moisture: "%",
                                                        vibration: "lần trong 2s",
                                                        tilt: "°"
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
                                                        "Giá trị TB": { label: "Giá trị TB", color: lineColor },
                                                        Min: { label: "Min", color: "hsl(0 0% 70%)" },
                                                        Max: { label: "Max", color: "hsl(0 0% 70%)" },
                                                    };

                                                    return (
                                                        <div
                                                            key={`${currentNode.node_key}_${sensor.sensor_code}_${sensor.sensor_type}`}
                                                            className="space-y-3 rounded-lg border p-3"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {sensor.sensor_type === "rainfall_24h" && <CloudRain className="h-5 w-5 text-blue-600" />}
                                                                {sensor.sensor_type === "soil_moisture" && <Droplets className="h-5 w-5 text-emerald-600" />}
                                                                {sensor.sensor_type === "vibration_g" && <Activity className="h-5 w-5 text-red-600" />}
                                                                {sensor.sensor_type === "tilt_deg" && <Cpu className="h-5 w-5 text-indigo-600" />}
                                                                {sensor.sensor_type === "slope_deg" && <Gauge className="h-5 w-5 text-amber-600" />}
                                                                <div>
                                                                    <span className="text-base font-semibold text-slate-900">
                                                                        {sensor.sensor_name}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        ({sensor.sensor_code})
                                                                    </span>
                                                                    <div className="mt-1 space-x-2 text-[11px] text-muted-foreground">
                                                                        <span>
                                                                            Max trong 24h:{" "}
                                                                            {max24 === null
                                                                                ? "—"
                                                                                : `${(max24 as number).toFixed(2)} ${unit}`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="max-h-[80vh] overflow-y-auto">
                                                                {chartData.length === 0 ? (
                                                                    <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
                                                                        Chưa có dữ liệu trong 24h
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        <ChartContainer config={chartConfig} className="h-72 w-full">
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
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Chưa có dữ liệu.</div>
                                    )}
                                </SheetContent>
                            </Sheet>
                        </div>
                    )}
                </CardContent>
            </Card>

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

            {/* Popup sơ đồ khu vực */}
            <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedArea?.province_name ? `Khu vực: ${selectedArea.province_name}` : "Chi tiết khu vực"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                <span className="font-semibold">
                                    {selectedArea?.count !== undefined ? `${selectedArea.count} thiết bị` : ""}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <Label htmlFor="area-device-select" className="text-sm font-medium">
                                    Thiết bị:
                                </Label>
                                <Select value={selectedAreaDeviceId} onValueChange={setSelectedAreaDeviceId}>
                                    <SelectTrigger id="area-device-select" className="w-full sm:w-[380px]">
                                        <SelectValue placeholder="Chọn thiết bị trong khu vực" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areaDevices.length === 0 ? (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                Không có thiết bị
                                            </div>
                                        ) : (
                                            areaDevices.map((d) => (
                                                <SelectItem key={d.device_id} value={d.device_id}>
                                                    {d.name} ({d.device_id})
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingAreaDeviceData && (
                            <div className="text-center py-10">
                                <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                <p className="text-sm text-muted-foreground">Đang tải dữ liệu cảm biến...</p>
                            </div>
                        )}

                        {!loadingAreaDeviceData && !selectedAreaDeviceId && (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                Khu vực này chưa có thiết bị để hiển thị cảm biến.
                            </div>
                        )}

                        {!loadingAreaDeviceData && selectedAreaDeviceId && (
                            <div className="grid gap-4 lg:grid-cols-3">
                                {/* Sơ đồ (trái) */}
                                <div className="lg:col-span-2 rounded-xl border bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-semibold text-slate-900">Sơ đồ cảm biến</p>
                                            <p className="text-xs text-muted-foreground">
                                                {areaDeviceInfo?.name ? `Thiết bị: ${areaDeviceInfo.name}` : `Thiết bị: ${selectedAreaDeviceId}`}
                                            </p>
                                        </div>
                                        {areaDeviceInfo?.status && (
                                            <Badge variant="outline"
                                                className={
                                                    areaDeviceInfo.status === "online"
                                                        ? "bg-green-100 text-green-800"
                                                        : areaDeviceInfo.status === "offline"
                                                            ? "bg-gray-100 text-gray-700"
                                                            : areaDeviceInfo.status === "disconnected"
                                                                ? "bg-red-100 text-red-800"
                                                                : "bg-blue-100 text-blue-800"
                                                }
                                            >
                                                {areaDeviceInfo.status === "online"
                                                    ? "Đang hoạt động"
                                                    : areaDeviceInfo.status === "offline"
                                                        ? "Offline"
                                                        : areaDeviceInfo.status === "disconnected"
                                                            ? "Mất kết nối"
                                                            : "Bảo trì"}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {(areaDeviceSensorData || []).slice(0, 5).map((sensor) => {
                                            const last = [...(sensor.data || [])]
                                                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                                                .slice(-1)[0];

                                            const unitMap: Record<string, string> = {
                                                rainfall_24h: "mm",
                                                soil_moisture: "%",
                                                vibration_g: "g",
                                                tilt_deg: "°",
                                                slope_deg: "°",
                                            };
                                            const unit = unitMap[sensor.sensor_type] || "";
                                            const value = last?.avg_value ?? null;
                                            const timeText = last?.time ? new Date(last.time).toLocaleString("vi-VN") : "—";

                                            const SensorIcon =
                                                sensor.sensor_type === "rainfall_24h"
                                                    ? CloudRain
                                                    : sensor.sensor_type === "soil_moisture"
                                                        ? Droplets
                                                        : sensor.sensor_type === "vibration_g"
                                                            ? Activity
                                                            : sensor.sensor_type === "tilt_deg"
                                                                ? Cpu
                                                                : sensor.sensor_type === "slope_deg"
                                                                    ? Gauge
                                                                    : Radio;

                                            return (
                                                <div
                                                    key={`${sensor.sensor_code}_${sensor.sensor_type}`}
                                                    className="rounded-xl border bg-white p-3 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-slate-900 truncate">{sensor.sensor_name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {sensor.sensor_code} • {sensor.sensor_type}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-md bg-slate-50 p-2">
                                                            <SensorIcon className="size-4 text-blue-700" />
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex items-end justify-between">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Giá trị gần nhất</p>
                                                            <p className="text-lg font-bold text-slate-900">
                                                                {value === null ? "—" : `${Number(value).toFixed(2)} ${unit}`}
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline" className="bg-slate-50">
                                                            24h
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                                        Cập nhật: {timeText}
                                                    </p>
                                                </div>
                                            );
                                        })}

                                        {areaDeviceSensorData.length === 0 && (
                                            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border bg-white p-6 text-sm text-muted-foreground">
                                                Chưa có dữ liệu cảm biến trong 24h qua.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Cột phải: ghi chú/nhanh */}
                                <div className="rounded-xl border bg-white p-4 space-y-3">
                                    {areaDeviceInfo?.last_seen && (
                                        <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                                            <p className="font-medium">Thiết bị cập nhật gần nhất</p>
                                            <p className="text-muted-foreground mt-1">
                                                {new Date(areaDeviceInfo.last_seen).toLocaleString("vi-VN")}
                                            </p>
                                        </div>
                                    )}
                                    <Button
                                        className="w-full mt-2"
                                        onClick={() => {
                                            if (selectedAreaDeviceId) {
                                                setSelectedDeviceId(selectedAreaDeviceId);
                                                setAreaDialogOpen(false);
                                                setTimeout(() => {
                                                    deviceDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                                }, 0);
                                            }
                                        }}
                                        disabled={!selectedAreaDeviceId}
                                    >
                                        Xem biểu đồ chi tiết thiết bị
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}