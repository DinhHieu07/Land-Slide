"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Map, Trash, Pencil, Filter } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Device } from "@/types/device";
import { Toast, ToastSeverity } from "@/components/Toast";
import { cn } from "@/lib/utils";
import Header from "./Header";
import { Province } from "@/types/province";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const statusColor: Record<Device["status"], string> = {
    online: "bg-emerald-100 text-emerald-800",
    offline: "bg-gray-100 text-gray-700",
    disconnected: "bg-red-100 text-red-800",
    maintenance: "bg-blue-100 text-blue-800",
};

export default function DeviceManager() {
    const router = useRouter();
    const { isAuthenticated, isAdmin, loading } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [province, setProvince] = useState("all");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [editing, setEditing] = useState<Device | null>(null);
    const [form, setForm] = useState({
        device_id: "",
        name: "",
        province_code: "",
        status: "offline",
        lat: "",
        lon: "",
    });
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("success");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmDeviceId, setConfirmDeviceId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [totalDevices, setTotalDevices] = useState(0);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [devicesError, setDevicesError] = useState<string | null>(null);
    const [provinces, setProvinces] = useState<Province[]>([]);

    const fetchDevices = async () => {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append("search", debouncedSearch);
        if (status && status !== "all") params.append("status", status);
        if (province && province !== "all") params.append("provinceCode", province);
        params.append("limit", String(pageSize));
        params.append("offset", String((page - 1) * pageSize));

        setLoadingDevices(true);
        setDevicesError(null);

        try {
            const res = await authenticatedFetch(`${API_URL}/api/devices?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setDevices(data.data || []);
                setTotalDevices(data.pagination?.total ?? data.data?.length ?? 0);
            } else {
                console.warn("Lỗi khi lấy danh sách thiết bị", data);
                setDevices([]);
                setTotalDevices(0);
                setDevicesError(data?.message || "Không thể tải dữ liệu thiết bị.");
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách thiết bị", error);
            setDevices([]);
            setTotalDevices(0);
            setDevicesError("Không thể tải dữ liệu thiết bị.");
        } finally {
            setLoadingDevices(false);
        }
    };

    useEffect(() => {
        const fetchProvinces = async () => {
            try {
                const res = await fetch(`${API_URL}/api/provinces/list-provinces`);
                const data = await res.json();
                if (res.ok && data?.success) {
                    setProvinces(data.data || []);
                } else {
                    console.error("Lỗi khi lấy danh sách tỉnh/thành", data);
                    setProvinces([]);
                }
            } catch (error) {
                console.error("Lỗi khi lấy danh sách tỉnh/thành", error);
                setProvinces([]);
            }
        };
        fetchProvinces();
    }, []);

    // Debounce search đợi 500ms sau khi ngừng nhập
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);

        // Cleanup: hủy timeout nếu search thay đổi trước khi hết 500ms
        return () => clearTimeout(timeoutId);
    }, [search]);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchDevices();
        }
    }, [isAuthenticated, isAdmin, debouncedSearch, page, status, province]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                device_id: form.device_id,
                name: form.name,
                province_code: form.province_code,
                status: form.status,
                lat: Number(form.lat),
                lon: Number(form.lon),
            };

            const url = editing
                ? `${API_URL}/api/devices/${editing.device_id}`
                : `${API_URL}/api/devices`;
            const method = editing ? "PUT" : "POST";

            const res = await authenticatedFetch(url, {
                method,
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setOpenDialog(false);
                setEditing(null);
                const newDevice = {
                    id: data.data.id,
                    device_id: data.data.device_id,
                    name: data.data.name,
                    province_code: data.data.province_code,
                    status: data.data.status,
                    lat: data.data.lat,
                    lon: data.data.lon,
                    last_seen: data.data.last_seen,
                    updated_at: data.data.updated_at,
                };
                if (editing) {
                    setDevices(devices.map((d) => d.device_id === editing.device_id ? newDevice : d));
                } else {
                    setDevices([...devices, newDevice]);
                }
                setForm({
                    device_id: "",
                    name: "",
                    province_code: "",
                    status: "offline",
                    lat: "",
                    lon: "",
                });
                setToastMessage("Lưu thành công");
                setToastSeverity("success");
                setToastOpen(true);
            } else {
                setToastMessage(data?.message || "Lỗi lưu thiết bị");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (err) {
            console.error(err);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (device: Device) => {
        setEditing(device);
        setForm({
            device_id: device.device_id,
            name: device.name,
            province_code: device.province_code || "",
            status: device.status,
            lat: String(device.lat),
            lon: String(device.lon),
        });
        setOpenDialog(true);
    };

    const handleDelete = async (deviceId: string) => {
        const res = await authenticatedFetch(`${API_URL}/api/devices/${deviceId}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if (res.ok && data.success) {
            setDevices(devices.filter((d) => d.device_id !== deviceId));
            setToastMessage("Xóa thành công");
            setToastSeverity("success");
            setToastOpen(true);
            setConfirmOpen(false);
            setConfirmDeviceId(null);
        } else {
            setToastMessage(data?.message || "Xóa thất bại");
            setToastSeverity("error");
            setToastOpen(true);
            setConfirmOpen(false);
            setConfirmDeviceId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil((totalDevices || 0) / pageSize));
    const paginated = devices; // server đã phân trang

    useEffect(() => {
        setPage(1);
    }, [search, status, province]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    // Trạng thái loading spinner 
    if (loading || loadingDevices) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <p className="text-red-600 font-semibold">Bạn cần đăng nhập để truy cập trang này.</p>
                </div>
            </div>
        );
    }

    // Không thể tải dữ liệu 
    if (!loadingDevices && devicesError) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <p className="text-gray-600">Không thể tải dữ liệu thiết bị.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold">Quản lý thiết bị</h1>
                    <p className="text-sm text-muted-foreground">Theo dõi trạng thái, vị trí, dữ liệu cập nhật.</p>
                </div>
                <Header />
            </div>
            <div className="flex justify-end">
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogTrigger asChild>
                        <Button
                            className="self-end"
                            onClick={() => {
                                setEditing(null);
                                setForm({
                                    device_id: "",
                                    name: "",
                                    province_code: "",
                                    status: "offline",
                                    lat: "",
                                    lon: "",
                                });
                            }}
                        >
                            Thêm thiết bị
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Chỉnh sửa thiết bị" : "Thêm thiết bị"}</DialogTitle>
                            <DialogDescription>Nhập thông tin thiết bị.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div>
                                <Label>Mã thiết bị</Label>
                                <Input
                                    value={form.device_id}
                                    onChange={(e) => setForm({ ...form, device_id: e.target.value })}
                                    disabled={!!editing}
                                    placeholder="Nhập mã thiết bị"
                                />
                            </div>
                            <div>
                                <Label>Tên thiết bị</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Nhập tên thiết bị"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Loại</Label>
                                    <Select
                                        value={form.province_code}
                                        onValueChange={(value) => setForm({ ...form, province_code: value })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Tỉnh/Thành" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {provinces.map((p) => (
                                                <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Trạng thái</Label>
                                    <Input
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        disabled={!!editing}
                                        placeholder="Nhập trạng thái"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Vĩ độ (lat)</Label>
                                    <Input
                                        value={form.lat}
                                        onChange={(e) => setForm({ ...form, lat: e.target.value })}
                                        placeholder="Nhập vĩ độ"
                                    />
                                </div>
                                <div>
                                    <Label>Kinh độ (lon)</Label>
                                    <Input
                                        value={form.lon}
                                        onChange={(e) => setForm({ ...form, lon: e.target.value })}
                                        placeholder="Nhập kinh độ"
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Đang lưu..." : "Lưu"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                        <Label>Tìm kiếm (ID hoặc tên)</Label>
                        <Input 
                            value={search} 
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1); // Reset về trang 1 khi search thay đổi
                            }} 
                            placeholder="Nhập tên hoặc ID thiết bị" 
                        />
                    </div>
                    <div className="w-full md:w-40 space-y-1.5">
                        <Label>Trạng thái</Label>
                        <Select value={status} onValueChange={(value) => setStatus(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tất cả" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="online">Online</SelectItem>
                                <SelectItem value="offline">Offline</SelectItem>
                                <SelectItem value="disconnected">Mất kết nối</SelectItem>
                                <SelectItem value="maintenance">Bảo trì</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-40 space-y-1.5">
                        <Label>Tỉnh / Thành</Label>
                        <Select value={province} onValueChange={(value) => setProvince(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tất cả" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                {provinces.map((p) => (
                                    <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={fetchDevices}>
                        <Filter className="size-4 mr-2" />
                        Lọc
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Tên</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Mã (ID)</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Tỉnh / Thành</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Trạng thái</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Lần cập nhật gần nhất</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Vị trí</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                                        Không lấy được dữ liệu
                                    </td>
                                </tr>
                            )}
                            {paginated.map((d) => (
                                <tr key={d.device_id} className="border-t">
                                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.device_id}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.province_name || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${statusColor[d.status]}`}>
                                            {d.status === "disconnected" ? "Mất kết nối" : d.status === "maintenance" ? "Bảo trì" : d.status === "offline" ? "Offline" : d.status === "online" ? "Online" : d.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {d.updated_at
                                            ? new Date(d.updated_at).toLocaleString("vi-VN")
                                            : "N/A"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {d.lat.toFixed(4)}, {d.lon.toFixed(4)}
                                    </td>
                                    <td className="px-4 py-3 text-left space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => router.push(`/map/${d.device_id}`)}>
                                            <Map className="size-4" />
                                            Xem map
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(d)}>
                                            <Pencil className="size-4" />
                                            Sửa
                                        </Button>
                                        <Separator orientation="vertical" className="inline-block h-4 align-middle" />
                                        <Button variant="destructive" size="sm" onClick={() => { setConfirmDeviceId(d.device_id); setConfirmOpen(true); }}>
                                            <Trash className="size-4" />
                                            Xóa
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Hiển thị {paginated.length === 0 ? 0 : (page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, totalDevices)} / {totalDevices} thiết bị
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
                    <div className={cn("px-3 py-1 rounded-md border text-sm", "bg-white")}>
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
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xóa thiết bị</DialogTitle>
                        <DialogDescription>Bạn có chắc chắn muốn xóa thiết bị này không?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>Hủy</Button>
                        <Button variant="destructive" onClick={() => handleDelete(confirmDeviceId || "")}>Xóa</Button>
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

