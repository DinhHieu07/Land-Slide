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
import { Map, Trash, Pencil, Filter, MoreHorizontal, Info, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Device } from "@/types/device";
import { Toast, ToastSeverity } from "@/components/Toast";
import { cn } from "@/lib/utils";
import Header from "./Header";
import { Province } from "@/types/province";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarGroup } from "./AvatarGroup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

// Dynamic import cho map component để tránh lỗi SSR
const LocationPickerMap = dynamic(
    () => import("./LocationPickerMap").then((mod) => mod.LocationPickerMap),
    { ssr: false }
);

type Sensor = {
    id: number;
    code: string;
    name: string | null;
    type: string;
    model: string | null;
    unit: string | null;
    min_threshold: number | null;
    max_threshold: number | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const statusColor: Record<Device["status"], string> = {
    online: "bg-emerald-100 text-emerald-800",
    offline: "bg-gray-100 text-gray-700",
    disconnected: "bg-red-100 text-red-800",
    maintenance: "bg-blue-100 text-blue-800",
};

export default function DeviceManager() {
    const router = useRouter();
    const { isAuthenticated, isAdmin, loading, isSuperAdmin } = useAuth();
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
        province_id: "",
        status: "online",
        lat: "",
        lon: "",
    });
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("success");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmDeviceId, setConfirmDeviceId] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailDevice, setDetailDevice] = useState<Device | null>(null);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loadingSensors, setLoadingSensors] = useState(false);
    const [sensorsError, setSensorsError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [totalDevices, setTotalDevices] = useState(0);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [devicesError, setDevicesError] = useState<string | null>(null);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [locationMode, setLocationMode] = useState<"manual" | "map">("manual");
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lon: number } | null>(null);

    const getUsername = () => {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            return user?.username || null;
        } catch {
            return null;
        }
    };
    const username = getUsername();
    
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
            const res = await authenticatedFetch(`${API_URL}/api/devices?username=${username}&${params.toString()}`, {
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

    const fetchSensors = async (deviceId: string) => {
        setLoadingSensors(true);
        setSensorsError(null);
        try {
            const res = await authenticatedFetch(`${API_URL}/api/sensors/by-device/${deviceId}`, { method: "GET" });
            const data = await res.json();
            if (res.ok && data?.success) {
                setSensors(data.data || []);
            } else {
                setSensors([]);
                setSensorsError(data?.message || "Không thể tải danh sách cảm biến.");
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách cảm biến:", error);
            setSensors([]);
            setSensorsError("Không thể tải danh sách cảm biến.");
        } finally {
            setLoadingSensors(false);
        }
    };

    useEffect(() => {
        const fetchProvinces = async () => {
            try {
                const res = await authenticatedFetch(`${API_URL}/api/provinces/list-provinces/${username}`, { method: "GET" });
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
                province_id: form.province_id ? Number(form.province_id) : null,
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
            console.log(data);
            if (res.ok && data.success) {
                setOpenDialog(false);
                setEditing(null);
                const newDevice = {
                    id: data.data.id,
                    device_id: data.data.device_id,
                    name: data.data.name,
                    province_id: data.data.province_id,
                    province_code: data.data.province_code,
                    province_name: data.data.province_name,
                    status: data.data.status,
                    lat: data.data.lat,
                    lon: data.data.lon,
                    last_seen: data.data.last_seen,
                    updated_at: data.data.updated_at,
                    managers: data.data.managers || [username],
                };
                if (editing) {
                    setDevices(devices.map((d) => d.device_id === editing.device_id ? newDevice : d));
                } else {
                    setDevices([...devices, newDevice]);
                }
                setForm({
                    device_id: "",
                    name: "",
                    province_id: "",
                    status: "online",
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
            province_id: device.province_id ? String(device.province_id) : "",
            status: device.status,
            lat: String(device.lat),
            lon: String(device.lon),
        });
        setLocationMode("manual");
        setSelectedLocation(null);
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
    // if (loading || loadingDevices) {
    //     return (
    //         <div className="p-6 flex items-center justify-center min-h-screen">
    //             <div className="text-center">
    //                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
    //                 <p className="text-gray-600">Đang tải dữ liệu...</p>
    //             </div>
    //         </div>
    //     );
    // }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="w-full md:w-40 space-y-1.5">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="w-full md:w-40 space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-20" />
                    </div>
                </div>

                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <th key={i} className="px-4 py-3">
                                            <Skeleton className="h-4 w-24" />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 2, 3, 4, 5].map((row) => (
                                    <tr key={row} className="border-t">
                                        {[1, 2, 3, 4, 5, 6].map((col) => (
                                            <td key={col} className="px-4 py-3">
                                                <Skeleton className="h-4 w-full" />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold">Quản lý thiết bị</h1>
                    <p className="text-sm text-muted-foreground">Theo dõi trạng thái, vị trí, dữ liệu cập nhật.</p>
                </div>
            </div>
            <div className="flex justify-end">
                <Dialog 
                    open={openDialog} 
                    onOpenChange={(open) => {
                        setOpenDialog(open);
                        if (!open) {
                            setLocationMode("manual");
                            setSelectedLocation(null);
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button
                            className="self-end"
                            onClick={() => {
                                setEditing(null);
                                setForm({
                                    device_id: "",
                                    name: "",
                                    province_id: "",
                                    status: "online",
                                    lat: "",
                                    lon: "",
                                });
                                setLocationMode("manual");
                                setSelectedLocation(null);
                            }}
                        >
                            Thêm thiết bị
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                                    <Label>Tỉnh/Thành</Label>
                                    <Select
                                        value={form.province_id}
                                        onValueChange={(value) => setForm({ ...form, province_id: value })}
                                        disabled={!!editing && !isSuperAdmin}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Chọn tỉnh/thành" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {provinces.map((p) => (
                                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Trạng thái</Label>
                                    <Select
                                        value={form.status}
                                        onValueChange={(value) => setForm({ ...form, status: value })}
                                        disabled={!!editing}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Chọn trạng thái" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="online">Hoạt động</SelectItem>
                                            <SelectItem value="disconnected">Mất kết nối</SelectItem>
                                            <SelectItem value="maintenance">Bảo trì</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <Label>Vị trí (Vĩ độ / Kinh độ)</Label>
                                    <Tabs value={locationMode} onValueChange={(v) => setLocationMode(v as "manual" | "map")} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="manual">
                                                <MapPin className="size-4 mr-2" />
                                                Nhập tay
                                            </TabsTrigger>
                                            <TabsTrigger value="map">
                                                <Map className="size-4 mr-2" />
                                                Chọn trên Map
                                            </TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="manual" className="space-y-0 mt-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Vĩ độ (lat)</Label>
                                                    <Input
                                                        value={form.lat}
                                                        onChange={(e) => setForm({ ...form, lat: e.target.value })}
                                                        placeholder="Nhập vĩ độ"
                                                        type="number"
                                                        step="any"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Kinh độ (lon)</Label>
                                                    <Input
                                                        value={form.lon}
                                                        onChange={(e) => setForm({ ...form, lon: e.target.value })}
                                                        placeholder="Nhập kinh độ"
                                                        type="number"
                                                        step="any"
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="map" className="space-y-0 mt-3">
                                            <div className="space-y-2">
                                                <LocationPickerMap
                                                    onLocationSelect={(lat, lon) => {
                                                        setForm({
                                                            ...form,
                                                            lat: lat.toFixed(6),
                                                            lon: lon.toFixed(6),
                                                        });
                                                        setSelectedLocation({ lat, lon });
                                                    }}
                                                    initialLat={form.lat ? Number(form.lat) : undefined}
                                                    initialLon={form.lon ? Number(form.lon) : undefined}
                                                />
                                                {selectedLocation && (
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <MapPin className="size-3" />
                                                        <span>
                                                            Đã chọn: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lon.toFixed(6)}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* {form.lat && form.lon && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Vĩ độ: {form.lat} | Kinh độ: {form.lon}
                                                    </div>
                                                )} */}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
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
                                <SelectItem value="online">Họat động</SelectItem>
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
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Tài khoản quản lý</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Trạng thái</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Lần cập nhật gần nhất</th>
                                {/* <th className="px-4 py-3 text-left font-semibold text-gray-700">Vị trí</th> */}
                                <th className="px-6 py-3 text-left font-semibold text-gray-700">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingDevices && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                            <p className="text-gray-600">Đang tải danh sách thiết bị...</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loadingDevices && paginated.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <p className="text-gray-600">Không có thiết bị nào</p>
                                    </td>
                                </tr>
                            )}
                            {paginated.map((d) => (
                                <tr key={d.device_id} className="border-t">
                                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.device_id}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.province_name || "—"}</td>
                                    <td className="px-4 py-3">
                                        <AvatarGroup managers={d.managers || []} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex text-center items-center rounded-full px-2 py-1 text-xs font-semibold ${statusColor[d.status]}`}>
                                            {d.status === "disconnected" ? "Mất kết nối" : d.status === "maintenance" ? "Bảo trì" : d.status === "online" ? "Hoạt động" : d.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {d.updated_at
                                            ? new Date(d.updated_at).toLocaleString("vi-VN")
                                            : "N/A"}
                                    </td>
                                    {/* <td className="px-4 py-3 text-gray-700">
                                        {d.lat.toFixed(4)}, {d.lon.toFixed(4)}
                                    </td> */}
                                    <td className="px-4 py-3 text-left">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="cursor-pointer hover:bg-gray-100"
                                                    onClick={() => {
                                                        setDetailDevice(d);
                                                        setDetailOpen(true);
                                                        fetchSensors(d.device_id);
                                                    }}
                                                >
                                                    <Info className="mr-2 size-4" />
                                                    <span>Chi tiết</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-pointer hover:bg-gray-100"
                                                    onClick={() => router.push(`/map/${d.device_id}`)}
                                                >
                                                    <Map className="mr-2 size-4" />
                                                    <span>Xem map</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleEdit(d)}
                                                >
                                                    <Pencil className="mr-2 size-4" />
                                                    <span>Sửa</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600 cursor-pointer hover:bg-gray-100"
                                                    onClick={() => {
                                                        setConfirmDeviceId(d.device_id);
                                                        setConfirmOpen(true);
                                                    }}
                                                >
                                                    <Trash className="mr-2 size-4" />
                                                    <span>Xóa</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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

            {/* Dialog chi tiết thiết bị + cảm biến */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Chi tiết thiết bị</DialogTitle>
                        <DialogDescription>
                            {detailDevice
                                ? `${detailDevice.name} (${detailDevice.device_id}) — ${detailDevice.province_name || "Chưa rõ"}`
                                : "Thông tin thiết bị và cảm biến"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border p-3 bg-slate-50">
                            <div className="text-sm text-gray-700">
                                <div className="flex flex-wrap gap-3">
                                    <span><strong>Trạng thái:</strong> {detailDevice?.status}</span>
                                    <span><strong>Lat/Lon:</strong> {detailDevice?.lat}, {detailDevice?.lon}</span>
                                    <span><strong>Cập nhật gần nhất:</strong> {detailDevice?.updated_at ? new Date(detailDevice.updated_at).toLocaleString("vi-VN") : "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 font-semibold">Danh sách cảm biến</div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Mã</th>
                                            <th className="px-4 py-3 text-left">Tên</th>
                                            <th className="px-4 py-3 text-left">Loại</th>
                                            <th className="px-4 py-3 text-left">Model</th>
                                            <th className="px-4 py-3 text-left">Đơn vị</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingSensors && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-6 text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                                                        <p className="text-gray-600">Đang tải cảm biến...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {!loadingSensors && sensorsError && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-4 text-center text-red-600">
                                                    {sensorsError}
                                                </td>
                                            </tr>
                                        )}
                                        {!loadingSensors && !sensorsError && sensors.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-4 text-center text-gray-600">
                                                    Không có cảm biến nào
                                                </td>
                                            </tr>
                                        )}
                                        {!loadingSensors && !sensorsError && sensors.map((s) => (
                                            <tr key={s.id} className="border-t">
                                                <td className="px-4 py-3 font-medium text-gray-900">{s.code}</td>
                                                <td className="px-4 py-3 text-gray-700">{s.name || "—"}</td>
                                                <td className="px-4 py-3 text-gray-700">{s.type}</td>
                                                <td className="px-4 py-3 text-gray-700">{s.model || "—"}</td>
                                                <td className="px-4 py-3 text-gray-700">{s.unit || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

