"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { authenticatedFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Filter,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    Eye,
    Clock,
    CheckCircle,
    RefreshCw,
    Activity,
    Radio,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { Alert, AlertStats } from "@/types/alert";
import { Toast, ToastSeverity } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const severityColors: Record<Alert["severity"], string> = {
    info: "bg-blue-100 text-blue-800 border-blue-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    critical: "bg-red-100 text-red-800 border-red-200",
};

const statusColors: Record<Alert["status"], string> = {
    active: "bg-red-100 text-red-800",
    acknowledged: "bg-yellow-100 text-yellow-800",
    resolved: "bg-green-100 text-green-800",
};

const categoryLabels: Record<Alert["category"], string> = {
    threshold: "Vượt ngưỡng",
    hardware: "Phần cứng",
    prediction: "Dự đoán",
    system: "Hệ thống",
};

export default function AlertManagement() {
    const { isAuthenticated, isAdmin, loading } = useAuth();
    const { socket, isConnected } = useSocket();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [stats, setStats] = useState<AlertStats | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [severity, setSeverity] = useState("all");
    const [status, setStatus] = useState("all");
    const [category, setCategory] = useState("all");
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [totalAlerts, setTotalAlerts] = useState(0);
    const [loadingAlerts, setLoadingAlerts] = useState(true);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
    const [updateStatusOpen, setUpdateStatusOpen] = useState(false);
    const [updatingAlert, setUpdatingAlert] = useState<Alert | null>(null);
    const [newStatus, setNewStatus] = useState<Alert["status"]>("active");
    const [resolvedNote, setResolvedNote] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("success");

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
        const timeoutId = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [search]);

    const fetchAlerts = async () => {
        setLoadingAlerts(true);
        const params = new URLSearchParams();
        if (debouncedSearch) params.append("search", debouncedSearch);
        if (severity !== "all") params.append("severity", severity);
        if (status !== "all") params.append("status", status);
        if (category !== "all") params.append("category", category);
        if (username) params.append("username", username);
        params.append("limit", String(pageSize));
        params.append("offset", String((page - 1) * pageSize));

        try {
            const res = await authenticatedFetch(`${API_URL}/api/alerts?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setAlerts(data.data || []);
                setTotalAlerts(data.pagination?.total ?? 0);
            } else {
                console.error("Lỗi khi lấy danh sách cảnh báo", data);
                setAlerts([]);
                setTotalAlerts(0);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách cảnh báo", error);
            setAlerts([]);
            setTotalAlerts(0);
        } finally {
            setLoadingAlerts(false);
        }
    };

    const fetchStats = async () => {
        try {
            const params = new URLSearchParams();
            if (username) params.append("username", username);
            const res = await authenticatedFetch(`${API_URL}/api/alerts/stats?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error("Lỗi khi lấy thống kê", error);
        }
    };


    const fetchAlertDetail = async (id: number) => {
        try {
            const res = await authenticatedFetch(`${API_URL}/api/alerts/${id}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setDetailAlert(data.data);
                setDetailOpen(true);
            }
        } catch (error) {
            console.error("Lỗi khi lấy chi tiết cảnh báo", error);
        }
    };

    const handleUpdateStatus = async () => {
        if (!updatingAlert) return;
        setIsUpdating(true);
        try {
            const res = await authenticatedFetch(
                `${API_URL}/api/alerts/${updatingAlert.id}/status`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        status: newStatus,
                        resolved_note: resolvedNote || null,
                    }),
                }
            );
            const data = await res.json();
            if (res.ok && data?.success) {
                setToastMessage("Cập nhật trạng thái thành công");
                setToastSeverity("success");
                setToastOpen(true);
                setUpdateStatusOpen(false);
                setUpdatingAlert(null);
                setResolvedNote("");
                fetchAlerts();
                fetchStats();
            } else {
                setToastMessage(data?.message || "Cập nhật thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Lỗi khi cập nhật trạng thái", error);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchAlerts();
            fetchStats();
        }
    }, [isAuthenticated, isAdmin, debouncedSearch, page, severity, status, category]);

    useEffect(() => {
        setPage(1);
    }, [search, severity, status, category]);

    // Socket.io event listeners
    const handlersRef = useRef<{
        handleNewAlert: ((alert: Alert) => void) | null;
        handleAlertUpdated: ((alert: Alert) => void) | null;
    }>({ handleNewAlert: null, handleAlertUpdated: null });

    useEffect(() => {
        if (!socket || !isConnected) {
            return;
        }

        // Tạo handlers mới
        const handleNewAlert = (alert: Alert) => {
            setToastMessage(`Cảnh báo mới: ${alert.title}`);
            setToastSeverity("warning");
            setToastOpen(true);
            fetchAlerts();
            fetchStats();
        };

        const handleAlertUpdated = (alert: Alert) => {
            setAlerts((prev) =>
                prev.map((a) => (a.id === alert.id ? alert : a))
            );
            fetchStats();
        };

        // Lưu handlers vào ref để cleanup
        handlersRef.current = { handleNewAlert, handleAlertUpdated };

        // Xóa listeners cũ trước khi đăng ký mới (tránh duplicate)
        socket.off("new_alert");
        socket.off("alert_updated");

        // Đăng ký listeners mới
        socket.on("new_alert", handleNewAlert);
        socket.on("alert_updated", handleAlertUpdated);

        // Cleanup listeners khi component unmount hoặc socket thay đổi
        return () => {
            if (socket) {
                socket.off("new_alert", handleNewAlert);
                socket.off("alert_updated", handleAlertUpdated);
            }
        };
    }, [socket, isConnected]);

    const totalPages = Math.max(1, Math.ceil(totalAlerts / pageSize));

    // Nhóm cảnh báo nghiêm trọng và đang bị lỗi
    const criticalAlerts = useMemo(() =>
        alerts.filter(a => a.severity === 'critical' && a.status === 'active').slice(0, 5),
        [alerts]
    );

    // Sắp xếp alerts theo mức độ ưu tiên: Critical active → Warning active → Info active → Acknowledged → Resolved
    const sortedAlerts = useMemo(() => {
        const priorityOrder = (alert: Alert) => {
            if (alert.status === 'active') {
                if (alert.severity === 'critical') return 1;
                if (alert.severity === 'warning') return 2;
                if (alert.severity === 'info') return 3;
            }
            if (alert.status === 'acknowledged') return 4;
            if (alert.status === 'resolved') return 5;
            return 6;
        };
        return [...alerts].sort((a, b) => priorityOrder(a) - priorityOrder(b));
    }, [alerts]);

    if (loading) {
        return (
            <div className="space-y-4 p-6">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <p className="text-red-600 font-semibold">
                        Bạn cần đăng nhập để truy cập trang này.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Activity className="size-8 text-blue-600" />
                        Giám sát cảnh báo
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Hệ thống giám sát real-time cho cảnh báo sạt lở
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchAlerts();
                            fetchStats();
                        }}
                    >
                        <RefreshCw className="size-4 mr-2" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Bộ đếm trạng thái */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border-l-4 border-l-red-500 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Chưa xử lý</p>
                                <p className="text-2xl font-bold text-red-600">{stats.active_count}</p>
                            </div>
                            <AlertTriangle className="size-6 text-red-400" />
                        </div>
                    </div>
                    <div className="rounded-lg border-l-4 border-l-amber-500 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Nghiêm trọng</p>
                                <p className="text-2xl font-bold text-amber-600">{stats.critical_count}</p>
                            </div>
                            <XCircle className="size-6 text-amber-400" />
                        </div>
                    </div>
                    <div className="rounded-lg border-l-4 border-l-yellow-500 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Đã xác nhận</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.acknowledged_count}</p>
                            </div>
                            <Clock className="size-6 text-yellow-400" />
                        </div>
                    </div>
                    <div className="rounded-lg border-l-4 border-l-green-500 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Đã xử lý</p>
                                <p className="text-2xl font-bold text-green-600">{stats.resolved_count}</p>
                            </div>
                            <CheckCircle className="size-6 text-green-400" />
                        </div>
                    </div>
                </div>
            )}

            {/* Khu vực Cần xử lý ngay */}
            {criticalAlerts.length > 0 && (
                <Card className="border-2 border-red-300 bg-red-50/50 shadow-lg">
                    <CardHeader className="bg-red-100/50 border-b border-red-200">
                        <CardTitle className="flex items-center gap-2 text-red-700 text-xl">
                            <XCircle className="size-6" />
                            Cần xử lý ngay
                        </CardTitle>
                        <CardDescription className="text-red-600 font-medium">
                            {criticalAlerts.length} cảnh báo nghiêm trọng - Cần xử lý khẩn cấp
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            {criticalAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-start justify-between p-4 bg-white rounded-lg border-2 border-red-200 hover:border-red-400 hover:shadow-md transition-all"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="inline-flex items-center rounded-full border-2 px-3 py-1 text-sm font-bold cursor-default bg-red-100 text-red-800 border-red-300">
                                                <XCircle className="size-4 mr-1.5" />
                                                Nghiêm trọng
                                            </span>
                                            <span className="text-base font-bold text-gray-900">{alert.title}</span>
                                        </div>
                                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">{alert.message}</p>
                                        <div className="flex items-center gap-4 text-xs text-gray-600">
                                            <span className="font-medium">{alert.device_name || alert.device_code || "—"}</span>
                                            <span>•</span>
                                            <span>{categoryLabels[alert.category]}</span>
                                            <span>•</span>
                                            <span>{new Date(alert.created_at).toLocaleString("vi-VN")}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fetchAlertDetail(alert.id)}
                                            className="border-gray-300"
                                        >
                                            <Eye className="size-4 mr-1" />
                                            Chi tiết
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => {
                                                setUpdatingAlert(alert);
                                                setNewStatus("acknowledged");
                                                setUpdateStatusOpen(true);
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                                        >
                                            Xử lý ngay
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                        <Label>Tìm kiếm theo tiêu đề</Label>
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nhập từ khóa tìm kiếm..."
                        />
                    </div>
                    <div className="w-full md:w-40 space-y-1.5">
                        <Label>Mức độ</Label>
                        <Select value={severity} onValueChange={setSeverity}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tất cả" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="info">Thông tin</SelectItem>
                                <SelectItem value="warning">Cảnh báo</SelectItem>
                                <SelectItem value="critical">Nghiêm trọng</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-40 space-y-1.5">
                        <Label>Trạng thái</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tất cả" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="active">Chưa xử lý</SelectItem>
                                <SelectItem value="acknowledged">Đã xác nhận</SelectItem>
                                <SelectItem value="resolved">Đã xử lý</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-40 space-y-1.5">
                        <Label>Loại</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tất cả" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="threshold">Vượt ngưỡng</SelectItem>
                                <SelectItem value="hardware">Phần cứng</SelectItem>
                                <SelectItem value="prediction">Dự đoán</SelectItem>
                                <SelectItem value="system">Hệ thống</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={fetchAlerts}>
                        <Filter className="size-4 mr-2" />
                        Lọc
                    </Button>
                </div>
            </div>

            {/* Alerts Card List - Tập trung vào xử lý */}
            <div className="space-y-3">
                {loadingAlerts && (
                    <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600">Đang tải danh sách cảnh báo...</p>
                    </div>
                )}
                {!loadingAlerts && sortedAlerts.length === 0 && (
                    <div className="bg-white rounded-lg border p-12 text-center">
                        <p className="text-gray-600">Không có cảnh báo nào</p>
                    </div>
                )}
                {!loadingAlerts &&
                    sortedAlerts.map((alert) => {
                        // Xác định border color dựa trên mức độ ưu tiên
                        const borderColor =
                            alert.status === 'active' && alert.severity === 'critical' ? 'border-l-4 border-l-red-500 bg-red-50/30' :
                                alert.status === 'active' && alert.severity === 'warning' ? 'border-l-4 border-l-amber-500 bg-amber-50/30' :
                                    alert.status === 'active' && alert.severity === 'info' ? 'border-l-4 border-l-blue-500 bg-blue-50/30' :
                                        alert.status === 'acknowledged' ? 'border-l-4 border-l-yellow-500 bg-yellow-50/20' :
                                            'border-l-4 border-l-gray-300 bg-gray-50/20';

                        return (
                            <div
                                key={alert.id}
                                className={cn(
                                    "rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-all",
                                    borderColor
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <span className="text-xs font-mono text-gray-500">#{alert.id}</span>
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default",
                                                    severityColors[alert.severity]
                                                )}
                                            >
                                                {alert.severity === "info" ? (
                                                    <Info className="size-3 mr-1" />
                                                ) : alert.severity === "warning" ? (
                                                    <AlertTriangle className="size-3 mr-1" />
                                                ) : (
                                                    <XCircle className="size-3 mr-1" />
                                                )}
                                                {alert.severity === "info"
                                                    ? "Thông tin"
                                                    : alert.severity === "warning"
                                                        ? "Cảnh báo"
                                                        : "Nghiêm trọng"}
                                            </span>
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default",
                                                    statusColors[alert.status]
                                                )}
                                            >
                                                {alert.status === "active"
                                                    ? "Chưa xử lý"
                                                    : alert.status === "acknowledged"
                                                        ? "Đã xác nhận"
                                                        : "Đã xử lý"}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{alert.title}</h3>
                                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{alert.message}</p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Radio className="size-3" />
                                                {alert.device_name || alert.device_code || "—"}
                                            </span>
                                            <span>•</span>
                                            <span>{categoryLabels[alert.category]}</span>
                                            <span>•</span>
                                            <span>{new Date(alert.created_at).toLocaleString("vi-VN")}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fetchAlertDetail(alert.id)}
                                            className="border-gray-300"
                                        >
                                            <Eye className="size-4 mr-1" />
                                            Chi tiết
                                        </Button>
                                        {alert.status !== "resolved" && (
                                            <Button
                                                variant={alert.status === "active" ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => {
                                                    setUpdatingAlert(alert);
                                                    setNewStatus(
                                                        alert.status === "active"
                                                            ? "acknowledged"
                                                            : "resolved"
                                                    );
                                                    setUpdateStatusOpen(true);
                                                }}
                                                className={alert.status === "active" ? "bg-red-600 hover:bg-red-700" : "text-white bg-blue-500 hover:text-white hover:bg-blue-600"}
                                            >
                                                <CheckCircle2 className="size-4 mr-1" />
                                                {alert.status === "active" ? "Xử lý" : "Hoàn thành"}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Hiển thị {alerts.length === 0 ? 0 : (page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, totalAlerts)} / {totalAlerts} cảnh báo
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                    >
                        Đầu
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Trước
                    </Button>
                    <div className="px-3 py-1 rounded-md border text-sm bg-white">
                        Trang {page} / {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Tiếp
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                    >
                        Cuối
                    </Button>
                </div>
            </div>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Chi tiết cảnh báo</DialogTitle>
                        <DialogDescription>
                            {detailAlert?.title}
                        </DialogDescription>
                    </DialogHeader>
                    {detailAlert && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Mức độ: </Label>
                                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default mt-1", severityColors[detailAlert.severity])}>
                                        {detailAlert.severity === "info"
                                            ? "Thông tin"
                                            : detailAlert.severity === "warning"
                                                ? "Cảnh báo"
                                                : "Nghiêm trọng"}
                                    </span>
                                </div>
                                <div>
                                    <Label>Trạng thái: </Label>
                                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default mt-1", statusColors[detailAlert.status])}>
                                        {detailAlert.status === "active"
                                            ? "Chưa xử lý"
                                            : detailAlert.status === "acknowledged"
                                                ? "Đã xác nhận"
                                                : "Đã xử lý"}
                                    </span>
                                </div>
                                <div>
                                    <Label>Loại</Label>
                                    <p className="mt-1 text-sm">{categoryLabels[detailAlert.category]}</p>
                                </div>
                                <div>
                                    <Label>Thiết bị</Label>
                                    <p className="mt-1 text-sm">{detailAlert.device_name || detailAlert.device_code || "—"}</p>
                                </div>
                                {detailAlert.sensor_name && (
                                    <div>
                                        <Label>Cảm biến</Label>
                                        <p className="mt-1 text-sm">{detailAlert.sensor_name} ({detailAlert.sensor_code})</p>
                                    </div>
                                )}
                                {detailAlert.triggered_value !== null && (
                                    <div>
                                        <Label>Giá trị kích hoạt</Label>
                                        <p className="mt-1 text-sm font-semibold">{detailAlert.triggered_value}</p>
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label>Nội dung</Label>
                                <p className="mt-1 text-sm text-gray-700">{detailAlert.message}</p>
                            </div>
                            {detailAlert.resolved_note && (
                                <div>
                                    <Label>Ghi chú xử lý</Label>
                                    <p className="mt-1 text-sm text-gray-700">{detailAlert.resolved_note}</p>
                                </div>
                            )}
                            {detailAlert.resolved_by_username && (
                                <div>
                                    <Label>Người xử lý</Label>
                                    <p className="mt-1 text-sm">{detailAlert.resolved_by_username}</p>
                                </div>
                            )}
                            {detailAlert.evidence_data && (
                                <div>
                                    <Label>Dữ liệu bằng chứng</Label>
                                    <pre className="mt-1 text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-40">
                                        {JSON.stringify(detailAlert.evidence_data, null, 2)}
                                    </pre>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                                <div>
                                    <Label>Tạo lúc</Label>
                                    <p>{new Date(detailAlert.created_at).toLocaleString("vi-VN")}</p>
                                </div>
                                {detailAlert.resolved_at && (
                                    <div>
                                        <Label>Xử lý lúc</Label>
                                        <p>{new Date(detailAlert.resolved_at).toLocaleString("vi-VN")}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Update Status Dialog */}
            <Dialog open={updateStatusOpen} onOpenChange={setUpdateStatusOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cập nhật trạng thái</DialogTitle>
                        <DialogDescription>
                            Cập nhật trạng thái cho cảnh báo: {updatingAlert?.title}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Trạng thái mới</Label>
                            <Select
                                value={newStatus}
                                onValueChange={(value) => setNewStatus(value as Alert["status"])}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Chưa xử lý</SelectItem>
                                    <SelectItem value="acknowledged">Đã xác nhận</SelectItem>
                                    <SelectItem value="resolved">Đã xử lý</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newStatus === "resolved" && (
                            <div>
                                <Label>Ghi chú xử lý</Label>
                                <Textarea
                                    value={resolvedNote}
                                    onChange={(e) => setResolvedNote(e.target.value)}
                                    placeholder="Nhập ghi chú về cách xử lý..."
                                    rows={4}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUpdateStatusOpen(false)}>
                            Hủy
                        </Button>
                        <Button onClick={handleUpdateStatus} disabled={isUpdating}>
                            {isUpdating ? "Đang cập nhật..." : "Cập nhật"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toast
                open={toastOpen}
                message={toastMessage}
                severity={toastSeverity}
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}

