"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import Header from "./Header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type AlertHistory = {
    id: number;
    event_id: number | null;
    alert_level: string;
    message: string;
    created_at: string;
    event_name: string | null;
    event_severity: number | null;
};

type SensorDataHistory = {
    id: number;
    device_id: string;
    device_name: string;
    sensor_type: string;
    data: Record<string, any>;
    recorded_at: string;
    created_at: string;
};

const dataLabels: Record<string, string> = {
    slope_deg: "Độ dốc (°)",
    vibration_g: "Rung (g)",
    rainfall_24h: "Lượng mưa (mm)",
    soil_moisture: "Độ ẩm (%)",
    displacement_mm: "Vị trí (mm)",
};

export default function HistoryView() {
    const { isAuthenticated, isAdmin, loading } = useAuth();
    const [activeTab, setActiveTab] = useState("alerts");

    // Alert filters
    const [alertStartDate, setAlertStartDate] = useState("");
    const [alertEndDate, setAlertEndDate] = useState("");
    const [alertLevel, setAlertLevel] = useState("all");
    const [alertQuery, setAlertQuery] = useState("");
    const [debouncedAlertQuery, setDebouncedAlertQuery] = useState("");
    const [alerts, setAlerts] = useState<AlertHistory[]>([]);
    const [alertPage, setAlertPage] = useState(1);
    const [alertTotalPages, setAlertTotalPages] = useState(1);
    const [alertTotal, setAlertTotal] = useState(0);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [alertError, setAlertError] = useState<string | null>(null);
    const [alertQuickRange, setAlertQuickRange] = useState<"24h" | "7d" | "30d">("24h");
    const [alertStartPicker, setAlertStartPicker] = useState<Date | undefined>(undefined);
    const [alertStartOpen, setAlertStartOpen] = useState(false);
    const [alertEndPicker, setAlertEndPicker] = useState<Date | undefined>(undefined);
    const [alertEndOpen, setAlertEndOpen] = useState(false);

    // Sensor data filters
    const [sensorDeviceId, setSensorDeviceId] = useState("all");
    const [sensorStartDate, setSensorStartDate] = useState("");
    const [sensorEndDate, setSensorEndDate] = useState("");
    const [sensorQuery, setSensorQuery] = useState("");
    const [debouncedSensorQuery, setDebouncedSensorQuery] = useState("");
    const [sensorData, setSensorData] = useState<SensorDataHistory[]>([]);
    const [devices, setDevices] = useState<Array<{ device_id: string; name: string }>>([]);
    const [sensorPage, setSensorPage] = useState(1);
    const [sensorTotalPages, setSensorTotalPages] = useState(1);
    const [sensorTotal, setSensorTotal] = useState(0);
    const [loadingSensorData, setLoadingSensorData] = useState(false);
    const [sensorError, setSensorError] = useState<string | null>(null);

    const [sensorQuickRange, setSensorQuickRange] = useState<"24h" | "7d" | "30d">("24h");
    const [sensorStartPicker, setSensorStartPicker] = useState<Date | undefined>(undefined);
    const [sensorStartOpen, setSensorStartOpen] = useState(false);
    const [sensorEndPicker, setSensorEndPicker] = useState<Date | undefined>(undefined);
    const [sensorEndOpen, setSensorEndOpen] = useState(false);

    const pageSize = 10;

    const formatDateInput = (d: dayjs.Dayjs) => d.format("YYYY-MM-DDTHH:mm");

    const applyQuickRange = (
        range: "24h" | "7d" | "30d",
        setRangeState: (v: any) => void,
        setStart: (v: string) => void,
        setEnd: (v: string) => void
    ) => {
        setRangeState(range);
        const now = dayjs();
        const start =
            range === "24h"
                ? now.subtract(24, "hour")
                : range === "7d"
                    ? now.subtract(7, "day")
                    : now.subtract(30, "day");
        setStart(formatDateInput(start));
        setEnd(formatDateInput(now));
    };

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            // Áp dụng preset mặc định cho cả hai tab khi đăng nhập
            if (!alertStartDate) {
                applyQuickRange(alertQuickRange, setAlertQuickRange, setAlertStartDate, setAlertEndDate);
            }
            if (!sensorStartDate) {
                applyQuickRange(sensorQuickRange, setSensorQuickRange, setSensorStartDate, setSensorEndDate);
            }
            fetchDevices();
            // Gọi API lần đầu khi mount
            if (activeTab === "alerts") {
                fetchAlertHistory();
            } else {
                fetchSensorDataHistory();
            }
        }
    }, [isAuthenticated, isAdmin]);

    // Debounce search cho alertQuery
    useEffect(() => {
        const t = setTimeout(() => setDebouncedAlertQuery(alertQuery), 500);
        return () => clearTimeout(t);
    }, [alertQuery]);

    // Debounce search cho sensorQuery
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSensorQuery(sensorQuery), 500);
        return () => clearTimeout(t);
    }, [sensorQuery]);

    // Chỉ gọi API khi đổi tab hoặc đổi trang hoặc filter đã debounce
    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            if (activeTab === "alerts") {
                fetchAlertHistory();
            } else {
                fetchSensorDataHistory();
            }
        }
    }, [
        isAuthenticated,
        isAdmin,
        activeTab,
        alertPage,
        sensorPage,
        alertStartDate,
        alertEndDate,
        alertLevel,
        debouncedAlertQuery,
        alertQuickRange,
        sensorStartDate,
        sensorEndDate,
        sensorDeviceId,
        debouncedSensorQuery,
        sensorQuickRange,
    ]);

    // Reset về trang 1 khi đổi filter
    useEffect(() => {
        setAlertPage(1);
    }, [alertStartDate, alertEndDate, alertLevel, debouncedAlertQuery, alertQuickRange]);

    useEffect(() => {
        setSensorPage(1);
    }, [sensorStartDate, sensorEndDate, sensorDeviceId, debouncedSensorQuery, sensorQuickRange]);

    const fetchDevices = async () => {
        try {
            const res = await authenticatedFetch(`${API_URL}/api/devices`, { method: "GET" });
            const data = await res.json();
            if (data?.success) {
                setDevices(data.data.map((d: any) => ({ device_id: d.device_id, name: d.name })));
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách thiết bị:", error);
        }
    };

    const fetchAlertHistory = async () => {
        try {
            setLoadingAlerts(true);
            setAlertError(null);
            const params = new URLSearchParams();
            if (alertStartDate) params.append("start_date", alertStartDate);
            if (alertEndDate) params.append("end_date", alertEndDate);
            if (alertLevel !== "all") params.append("alert_level", alertLevel);
            if (debouncedAlertQuery) params.append("q", debouncedAlertQuery);
            params.append("limit", pageSize.toString());
            params.append("offset", ((alertPage - 1) * pageSize).toString());

            const res = await authenticatedFetch(`${API_URL}/api/history/alerts?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setAlerts(data.data || []);
                setAlertTotalPages(data.pagination?.totalPages || 1);
                setAlertTotal(data.pagination?.total || data.data?.length || 0);
            } else {
                setAlerts([]);
                setAlertTotal(0);
                setAlertTotalPages(1);
                setAlertError(data?.message || "Không thể tải dữ liệu lịch sử cảnh báo.");
            }
        } catch (error) {
            console.error("Lỗi khi lấy lịch sử cảnh báo:", error);
            setAlerts([]);
            setAlertTotal(0);
            setAlertTotalPages(1);
            setAlertError("Không thể tải dữ liệu lịch sử cảnh báo.");
        } finally {
            setLoadingAlerts(false);
        }
    };

    const fetchSensorDataHistory = async () => {
        try {
            setLoadingSensorData(true);
            setSensorError(null);
            const params = new URLSearchParams();
            if (sensorDeviceId !== "all") params.append("device_id", sensorDeviceId);
            if (sensorStartDate) params.append("start_date", sensorStartDate);
            if (sensorEndDate) params.append("end_date", sensorEndDate);
            if (debouncedSensorQuery) params.append("q", debouncedSensorQuery);
            params.append("limit", pageSize.toString());
            params.append("offset", ((sensorPage - 1) * pageSize).toString());

            const res = await authenticatedFetch(`${API_URL}/api/history/sensor-data?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            console.log(data);
            if (res.ok && data.success) {
                setSensorData(data.data || []);
                setSensorTotalPages(data.pagination?.totalPages || 1);
                setSensorTotal(data.pagination?.total || data.data?.length || 0);
            } else {
                setSensorData([]);
                setSensorTotal(0);
                setSensorTotalPages(1);
                setSensorError(data?.message || "Không thể tải dữ liệu lịch sử cảm biến.");
            }
        } catch (error) {
            console.error("Lỗi khi lấy lịch sử dữ liệu cảm biến:", error);
            setSensorData([]);
            setSensorTotal(0);
            setSensorTotalPages(1);
            setSensorError("Không thể tải dữ liệu lịch sử cảm biến.");
        } finally {
            setLoadingSensorData(false);
        }
    };

    // const exportToCSV = (data: any[], filename: string) => {
    //     if (data.length === 0) return;

    //     const headers = Object.keys(data[0]);
    //     const csvContent = [
    //         headers.join(","),
    //         ...data.map((row) =>
    //             headers
    //                 .map((header) => {
    //                     const value = row[header];
    //                     if (value === null || value === undefined) return "";
    //                     if (typeof value === "object") return JSON.stringify(value);
    //                     return String(value).replace(/"/g, '""');
    //                 })
    //                 .map((v) => `"${v}"`)
    //                 .join(",")
    //         ),
    //     ].join("\n");

    //     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    //     const link = document.createElement("a");
    //     link.href = URL.createObjectURL(blob);
    //     link.download = filename;
    //     link.click();
    // };

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

    // Loading giống Dashboard: spinner toàn màn hình
    if (loading || loadingAlerts || loadingSensorData) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    const alertLevelColors: Record<string, string> = {
        low: "bg-blue-100 text-blue-800",
        medium: "bg-yellow-100 text-yellow-800",
        high: "bg-orange-100 text-orange-800",
        critical: "bg-red-100 text-red-800",
    };

    const typeLabels: Record<string, string> = {
        vibration: "Cảm biến rung",
        rainfall: "Lượng mưa",
        humidity: "Độ ẩm",
        position: "Vị trí",
        slope: "Độ dốc",
    };

    if (activeTab === "alerts" && alertError) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-gray-600">Không thể tải dữ liệu lịch sử cảnh báo.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (activeTab === "sensor-data" && sensorError) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-gray-600">Không thể tải dữ liệu lịch sử cảm biến.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Lịch sử hệ thống</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Quản lý lịch sử cảnh báo và dữ liệu cảm biến
                    </p>
                </div>
                <Header />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Cảnh báo (theo bộ lọc)</CardDescription>
                        <CardTitle className="text-2xl">{alertTotal}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Trang {alertPage}/{alertTotalPages} · {pageSize} mục/trang
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Dữ liệu cảm biến (theo bộ lọc)</CardDescription>
                        <CardTitle className="text-2xl">{sensorTotal}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Trang {sensorPage}/{sensorTotalPages} · {pageSize} mục/trang
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Phạm vi thời gian</CardDescription>
                        <CardTitle className="text-lg">
                            Alert: {alertQuickRange.toUpperCase()} · Sensor: {sensorQuickRange.toUpperCase()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Dùng preset 24h/7d/30d để lọc nhanh.
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="alerts">Lịch sử cảnh báo</TabsTrigger>
                    <TabsTrigger value="sensor-data">Lịch sử dữ liệu cảm biến</TabsTrigger>
                </TabsList>

                {/* Tab Lịch sử cảnh báo */}
                <TabsContent value="alerts" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bộ lọc</CardTitle>
                            <CardDescription>Lọc lịch sử cảnh báo theo tiêu chí</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-5">
                                <div className="md:col-span-2">
                                    <Label>Từ khóa (thông điệp / sự kiện)</Label>
                                    <Input
                                        value={alertQuery}
                                        onChange={(e) => setAlertQuery(e.target.value)}
                                        placeholder="Nhập từ khóa"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="dateFrom1">Từ ngày</Label>
                                    <Popover open={alertStartOpen} onOpenChange={setAlertStartOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                id="dateFrom1"
                                                className="w-full justify-between font-normal"
                                            >
                                                {alertStartPicker
                                                    ? dayjs(alertStartPicker).format("DD/MM/YYYY")
                                                    : "Chọn ngày"}
                                                <ChevronDownIcon className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={alertStartPicker}
                                                captionLayout="dropdown"
                                                onSelect={(date: Date | undefined) => {
                                                    setAlertStartPicker(date || undefined);
                                                    if (date) {
                                                        setAlertStartDate(formatDateInput(dayjs(date)));
                                                    } else {
                                                        setAlertStartDate("");
                                                    }
                                                    setAlertStartOpen(false);
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label htmlFor="dateTo1">Đến ngày</Label>
                                    <Popover open={alertEndOpen} onOpenChange={setAlertEndOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                id="dateTo1"
                                                className="w-full justify-between font-normal"
                                            >
                                                {alertEndPicker
                                                    ? dayjs(alertEndPicker).format("DD/MM/YYYY")
                                                    : "Chọn ngày"}
                                                <ChevronDownIcon className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={alertEndPicker}
                                                captionLayout="dropdown"
                                                onSelect={(date: Date | undefined) => {
                                                    setAlertEndPicker(date || undefined);
                                                    if (date) {
                                                        setAlertEndDate(formatDateInput(dayjs(date)));
                                                    } else {
                                                        setAlertEndDate("");
                                                    }
                                                    setAlertEndOpen(false);
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label>Mức độ</Label>
                                    <Select value={alertLevel} onValueChange={setAlertLevel}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tất cả" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            <SelectItem value="low">Thấp</SelectItem>
                                            <SelectItem value="medium">Trung bình</SelectItem>
                                            <SelectItem value="high">Cao</SelectItem>
                                            <SelectItem value="critical">Nghiêm trọng</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex gap-2 w-full">
                                        {(["24h", "7d", "30d"] as const).map((preset) => (
                                            <Button
                                                key={preset}
                                                variant={alertQuickRange === preset ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() =>
                                                    applyQuickRange(
                                                        preset,
                                                        setAlertQuickRange,
                                                        setAlertStartDate,
                                                        setAlertEndDate
                                                    )
                                                }
                                            >
                                                {preset}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                                <div className="flex gap-2">
                                    <Button onClick={fetchAlertHistory}>
                                        <Filter className="size-4 mr-2" />
                                        Lọc
                                    </Button>
                                    {/* <Button
                                        variant="outline"
                                        onClick={() =>
                                            exportToCSV(alerts, `alerts_${new Date().toISOString().split("T")[0]}.csv`)
                                        }
                                    >
                                        <Download className="size-4" />
                                    </Button> */}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Tổng: <span className="font-semibold text-foreground">{alertTotal}</span> cảnh báo
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Danh sách cảnh báo</CardTitle>
                            <CardDescription>
                                {loadingAlerts ? "Đang tải..." : `${alerts.length} cảnh báo`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">ID</th>
                                            <th className="px-4 py-3 text-left font-semibold">Mức độ</th>
                                            <th className="px-4 py-3 text-left font-semibold">Thông điệp</th>
                                            <th className="px-4 py-3 text-left font-semibold">Sự kiện</th>
                                            <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alerts.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                                    Không lấy được dữ liệu
                                                </td>
                                            </tr>
                                        ) : (
                                            alerts.map((alert) => (
                                                <tr key={alert.id} className="border-t">
                                                    <td className="px-4 py-3">#{alert.id}</td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                                                                alertLevelColors[alert.alert_level] || "bg-gray-100 text-gray-800"
                                                            )}
                                                        >
                                                            {alert.alert_level}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">{alert.message}</td>
                                                    <td className="px-4 py-3">
                                                        {alert.event_name ? (
                                                            <span>
                                                                {alert.event_name}
                                                                {alert.event_severity && (
                                                                    <span className="text-xs text-muted-foreground ml-1">
                                                                        (Mức {alert.event_severity})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {new Date(alert.created_at).toLocaleString("vi-VN")}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <p className="text-sm text-muted-foreground">
                                    Hiển thị {alerts.length === 0 ? 0 : (alertPage - 1) * pageSize + 1}-
                                    {Math.min(alertPage * pageSize, alertTotal)} / {alertTotal} cảnh báo
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAlertPage(1)}
                                        disabled={alertPage === 1}
                                    >
                                        Đầu
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAlertPage((p) => Math.max(1, p - 1))}
                                        disabled={alertPage === 1}
                                    >
                                        Trước
                                    </Button>
                                    <div className={cn("px-3 py-1 rounded-md border text-sm", "bg-white")}>
                                        Trang {alertPage} / {alertTotalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAlertPage((p) => Math.min(alertTotalPages, p + 1))}
                                        disabled={alertPage === alertTotalPages}
                                    >
                                        Tiếp
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAlertPage(alertTotalPages)}
                                        disabled={alertPage === alertTotalPages}
                                    >
                                        Cuối
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab Lịch sử dữ liệu cảm biến */}
                <TabsContent value="sensor-data" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bộ lọc</CardTitle>
                            <CardDescription>Lọc dữ liệu cảm biến theo tiêu chí</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-6">
                                <div className="md:col-span-2">
                                    <Label>Tìm kiếm (thiết bị / ID)</Label>
                                    <Input
                                        value={sensorQuery}
                                        onChange={(e) => setSensorQuery(e.target.value)}
                                        placeholder="Nhập tên hoặc ID thiết bị"
                                    />
                                </div>
                                <div>
                                    <Label>Thiết bị</Label>
                                    <Select value={sensorDeviceId} onValueChange={setSensorDeviceId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tất cả" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            {devices.map((d) => (
                                                <SelectItem key={d.device_id} value={d.device_id}>
                                                    {d.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="dateFrom2">Từ ngày</Label>
                                    <Popover open={sensorStartOpen} onOpenChange={setSensorStartOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                id="dateFrom2"
                                                className="w-full justify-between font-normal"
                                            >
                                                {sensorStartPicker
                                                    ? dayjs(sensorStartPicker).format("DD/MM/YYYY")
                                                    : "Chọn ngày"}
                                                <ChevronDownIcon className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={sensorStartPicker}
                                                captionLayout="dropdown"
                                                onSelect={(date: Date | undefined) => {
                                                    setSensorStartPicker(date || undefined);
                                                    if (date) {
                                                        setSensorStartDate(formatDateInput(dayjs(date)));
                                                    } else {
                                                        setSensorStartDate("");
                                                    }
                                                    setSensorStartOpen(false);
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label htmlFor="dateTo2">Đến ngày</Label>
                                    <Popover open={sensorEndOpen} onOpenChange={setSensorEndOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                id="dateTo2"
                                                className="w-full justify-between font-normal"
                                            >
                                                {sensorEndPicker
                                                    ? dayjs(sensorEndPicker).format("DD/MM/YYYY")
                                                    : "Chọn ngày"}
                                                <ChevronDownIcon className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={sensorEndPicker}
                                                captionLayout="dropdown"
                                                onSelect={(date: Date | undefined) => {
                                                    setSensorEndPicker(date || undefined);
                                                    if (date) {
                                                        setSensorEndDate(formatDateInput(dayjs(date)));
                                                    } else {
                                                        setSensorEndDate("");
                                                    }
                                                    setSensorEndOpen(false);
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex gap-2 w-full">
                                        {(["24h", "7d", "30d"] as const).map((preset) => (
                                            <Button
                                                key={preset}
                                                variant={sensorQuickRange === preset ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() =>
                                                    applyQuickRange(
                                                        preset,
                                                        setSensorQuickRange,
                                                        setSensorStartDate,
                                                        setSensorEndDate
                                                    )
                                                }
                                            >
                                                {preset}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                                <div className="flex gap-2">
                                    <Button onClick={fetchSensorDataHistory}>
                                        <Filter className="size-4 mr-2" />
                                        Lọc
                                    </Button>
                                    {/* <Button
                                        variant="outline"
                                        onClick={() =>
                                            exportToCSV(
                                                sensorData,
                                                `sensor_data_${new Date().toISOString().split("T")[0]}.csv`
                                            )
                                        }
                                    >
                                        <Download className="size-4" />
                                    </Button> */}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Tổng: <span className="font-semibold text-foreground">{sensorTotal}</span> bản ghi
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Danh sách dữ liệu cảm biến</CardTitle>
                            <CardDescription>
                                {loadingSensorData ? "Đang tải..." : `${sensorData.length} bản ghi`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">ID thiết bị</th>
                                            <th className="px-4 py-3 text-left font-semibold">Thiết bị</th>
                                            <th className="px-4 py-3 text-left font-semibold">Dữ liệu</th>
                                            <th className="px-4 py-3 text-left font-semibold">Thời gian ghi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sensorData.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                                                    Không lấy được dữ liệu
                                                </td>
                                            </tr>
                                        ) : (
                                            sensorData.map((data) => (
                                                <tr key={data.id} className="border-t">
                                                    <td className="px-4 py-3">{data.device_id}</td>
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <div className="font-medium">{data.device_name}</div>
                                                            <div className="text-xs text-muted-foreground">{data.device_id}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1">
                                                            {Object.entries(data.data).map(([key, value]) => (
                                                                <div key={key} className="text-xs">
                                                                    <span className="font-medium">{dataLabels[key] || key}:</span>{" "}
                                                                    <span className="text-muted-foreground">
                                                                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {new Date(data.recorded_at).toLocaleString("vi-VN")}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <p className="text-sm text-muted-foreground">
                                    Hiển thị {sensorData.length === 0 ? 0 : (sensorPage - 1) * pageSize + 1}-
                                    {Math.min(sensorPage * pageSize, sensorTotal)} / {sensorTotal} bản ghi
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSensorPage(1)}
                                        disabled={sensorPage === 1}
                                    >
                                        Đầu
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSensorPage((p) => Math.max(1, p - 1))}
                                        disabled={sensorPage === 1}
                                    >
                                        Trước
                                    </Button>
                                    <div className={cn("px-3 py-1 rounded-md border text-sm", "bg-white")}>
                                        Trang {sensorPage} / {sensorTotalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSensorPage((p) => Math.min(sensorTotalPages, p + 1))}
                                        disabled={sensorPage === sensorTotalPages}
                                    >
                                        Tiếp
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSensorPage(sensorTotalPages)}
                                        disabled={sensorPage === sensorTotalPages}
                                    >
                                        Cuối
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}