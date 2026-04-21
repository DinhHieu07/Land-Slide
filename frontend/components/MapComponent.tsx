"use client";

import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';  //Css cho leaflet 
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@mui/material';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetOverlay,
} from '@/components/ui/sheet';
import { List, MapPin, Flame, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Province } from '@/types/province';

type FocusDevice = {
    device_id: string;
    name: string;
    lat: number;
    lon: number;
    status?: string;
    updated_at?: string;
    province_name?: string;
};

type DeviceMarker = {
    device_id: string;
    name: string;
    lat: number;
    lon: number;
    status?: string;
    updated_at?: string;
    province_name?: string;
    province_code?: string;
};

/** Node trên bản đồ + liên kết Gateway */
type NodeMarker = {
    id: number;
    node_id: string;
    name: string | null;
    lat: number;
    lon: number;
    status?: string | null;
    gateway_device_id: string;
    gateway_name: string | null;
    gateway_lat: number | null;
    gateway_lon: number | null;
    province_name?: string | null;
};

/** Đường nối Node–Gateway */
const NODE_GATEWAY_LINE_COLOR = '#3b82f6';

type AlertHeatPoint = {
    lat: number;
    lon: number;
    weight: number;
    count: number;
    max_level: number;
    latest_at: string;
    device_code?: string;
    node_id?: string | null;
    alert_types?: string[];
};

function heatLevelColor(maxLevel: number) {
    if (maxLevel >= 3) return '#ef4444';
    if (maxLevel >= 2) return '#f59e0b';
    return '#3b82f6';
}

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Đường kính heatmap */
const HEATMAP_CIRCLE_PX = 100;

/** Heatmap */
function buildHeatmapDivIcon(p: AlertHeatPoint, opacityScale: number) {
    const hex = heatLevelColor(p.max_level);
    const [r, g, b] = hexToRgb(hex);
    const size = HEATMAP_CIRCLE_PX;
    const peak = Math.min(0.96, 0.82 + opacityScale * 0.12);
    const grad = `radial-gradient(circle at center,
        rgba(${r},${g},${b},${peak}) 0%,
        rgba(${r},${g},${b},${peak * 0.95}) 28%,
        rgba(${r},${g},${b},${peak * 0.88}) 52%,
        rgba(${r},${g},${b},${peak * 0.55}) 72%,
        rgba(${r},${g},${b},${peak * 0.22}) 88%,
        rgba(${r},${g},${b},0) 100%)`;
    return L.divIcon({
        className: 'heatmap-alert-dot',
        html: `<div style="
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            background:${grad};
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

// Component để control map zoom và center
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();

    useEffect(() => {
        // Tính toán lại kích thước map trước khi setView
        map.invalidateSize();
        const timer = setTimeout(() => {
            map.setView(center, zoom, {
                animate: true,
            });
        }, 50);
        return () => clearTimeout(timer);
    }, [map, center, zoom]);

    return null;
}

export default function MapComponent({ focusDevice, onDeviceFocus }: { focusDevice?: FocusDevice; onDeviceFocus?: (device: FocusDevice) => void }) {
    const { isAuthenticated, user } = useAuth();
    const [center, setCenter] = useState<[number, number]>([21.0285, 105.8542]);
    const [zoom, setZoom] = useState(8);
    const [devices, setDevices] = useState<DeviceMarker[]>([]);
    const [nodes, setNodes] = useState<NodeMarker[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<string>("all");
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [heatPoints, setHeatPoints] = useState<AlertHeatPoint[]>([]);
    const [heatmapOpen, setHeatmapOpen] = useState(true);
    const [heatmapHours, setHeatmapHours] = useState<string>("24");
    const [heatmapType, setHeatmapType] = useState<"all" | "threshold" | "disconnect">("all");
    const focusMarkerRef = useRef<any>(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const username = user?.username;

    const heatOpacityScale = 0.72;

    // Sử dụng focusDevice từ prop hoặc localFocusDevice
    const [currentFocusDevice, setCurrentFocusDevice] = useState<FocusDevice | undefined>(focusDevice || undefined);

    // Đồng bộ currentFocusDevice với focusDevice prop khi prop thay đổi
    useEffect(() => {
        if (focusDevice) {
            setCurrentFocusDevice(focusDevice);
        }
    }, [focusDevice]);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await authenticatedFetch(`${API_URL}/api/devices?username=${username}&limit=1000&offset=0`, { method: "GET" });
                const data = await response.json();
                if (response.ok && data.success) {
                    setDevices(data.data || []);
                } else {
                    console.error('Lỗi khi lấy danh sách thiết bị:', data.message);
                }
            } catch (error) {
                console.error('Lỗi khi lấy danh sách thiết bị:', error);
            }
        };
        fetchDevices();
    }, []);

    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const q = username ? `?username=${encodeURIComponent(username)}` : '';
                const response = await authenticatedFetch(`${API_URL}/api/nodes/map${q}`, { method: 'GET' });
                const data = await response.json();
                if (response.ok && data.success) {
                    setNodes(data.data || []);
                } else {
                    setNodes([]);
                }
            } catch (error) {
                console.error('Lỗi khi lấy danh sách node:', error);
                setNodes([]);
            }
        };
        fetchNodes();
    }, [username]);

    useEffect(() => {
        const fetchProvinces = async () => {
            try {
                const res = await authenticatedFetch(`${API_URL}/api/provinces/list-provinces/${username}`);
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

    const fetchHeatmap = async () => {
        if (!isAuthenticated) return;
        try {
            const params = new URLSearchParams();
            if (username) params.append("username", username);
            params.append("hours", heatmapHours);
            params.append("type", heatmapType);
            const res = await authenticatedFetch(`${API_URL}/api/alerts/heatmap?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setHeatPoints(data.points || []);
            } else {
                setHeatPoints([]);
            }
        } catch (e) {
            console.error("Lỗi heatmap:", e);
            setHeatPoints([]);
        } finally {
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        if (!heatmapOpen) {
            setHeatPoints([]);
            return;
        }
        void fetchHeatmap();
    }, [heatmapOpen, heatmapHours, heatmapType, username, isAuthenticated]);

    // Filter devices theo tỉnh được chọn
    const filteredDevices = useMemo(() => {
        if (selectedProvince === "all") {
            return devices;
        }
        return devices.filter(device => device.province_name === selectedProvince);
    }, [devices, selectedProvince]);

    const filteredNodes = useMemo(() => {
        if (selectedProvince === "all") {
            return nodes;
        }
        return nodes.filter((n) => n.province_name === selectedProvince);
    }, [nodes, selectedProvince]);

    // Nhóm thiết bị theo tỉnh (sau khi filter)
    const devicesByProvince = useMemo(() => {
        const grouped: Record<string, DeviceMarker[]> = {};
        filteredDevices.forEach(device => {
            const provinceKey = device.province_name || 'Chưa xác định';
            if (!grouped[provinceKey]) {
                grouped[provinceKey] = [];
            }
            grouped[provinceKey].push(device);
        });
        return grouped;
    }, [filteredDevices]);

    const handleDeviceClick = (device: DeviceMarker) => {
        const focusDeviceData: FocusDevice = {
            device_id: device.device_id,
            name: device.name,
            lat: device.lat,
            lon: device.lon,
            status: device.status,
            updated_at: device.updated_at,
            province_name: device.province_name,
        };

        if (onDeviceFocus) {
            onDeviceFocus(focusDeviceData);
        } else {
            setCurrentFocusDevice(focusDeviceData);
        }

        setSheetOpen(false);
    };

    useEffect(() => {
        if (currentFocusDevice) {
            setCenter([currentFocusDevice.lat, currentFocusDevice.lon]);
            setZoom(14);
            setTimeout(() => {
                if (focusMarkerRef.current) {
                    focusMarkerRef.current.openPopup();
                }
            }, 300);
        }
    }, [currentFocusDevice]);

    const statusColors: Record<string, string> = {
        online: '#10b981',        // green
        offline: '#9ca3af',       // gray
        disconnected: '#ef4444',  // red
        maintenance: '#3b82f6',   // blue
    };

    const statusLabels: Record<string, string> = {
        online: 'Hoạt động',
        offline: 'Không hoạt động',
        disconnected: 'Mất kết nối',
        maintenance: 'Bảo trì',
    };

    /* Nền marker */
    const getMarkerIcon = useMemo(() => {
        return (letter: 'G' | 'N', status?: string, active?: boolean) => {
            const isNode = letter === 'N';
            const bg = status ? (statusColors[status] || '#9ca3af') : '#9ca3af';
            const size = active ? 40 : isNode ? 28 : 30;
            const border = active ? 3 : 2;
            const shadow = active ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.35)';
            const fontSize = active ? 16 : isNode ? 12 : 13;
            return L.divIcon({
                className: 'map-marker-gn',
                html: `<div style="
                    background-color: ${bg};
                    width: ${size}px;
                    height: ${size}px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: ${border}px solid white;
                    box-shadow: ${shadow};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                ">
                    <div style="
                        transform: rotate(45deg);
                        color: white;
                        font-weight: bold;
                        font-size: ${fontSize}px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                    ">${letter}</div>
                </div>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            });
        };
    }, []);

    if (!isAuthenticated) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-red-600 font-semibold">Bạn cần đăng nhập để xem bản đồ.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <div className="absolute left-16 top-4 z-[1100] pointer-events-auto">
                <PageBreadcrumb />
            </div>

            <div className="absolute right-4 top-4 z-[1100] flex flex-col items-end gap-2 pointer-events-auto w-[min(100vw-2rem,20rem)]">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-white shadow-md w-full sm:w-auto shrink-0">
                            <List className="h-4 w-4 mr-2" />
                            Danh sách thiết bị (Gateway)
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto z-[9050]">
                        <SheetHeader>
                            <SheetTitle>Danh sách thiết bị (Gateway)</SheetTitle>
                            <SheetDescription>
                                Nhấn vào thiết bị để xem vị trí trên bản đồ
                            </SheetDescription>
                        </SheetHeader>

                        <div className="ml-1 mr-1 space-y-4">
                            <div className="space-y-1.5">
                                <Label>Tỉnh / Thành</Label>
                                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Tất cả" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[400px] z-[10050] left-1">
                                        <SelectItem value="all">Tất cả</SelectItem>
                                        {provinces.map((p) => (
                                            <SelectItem key={p.id} value={p.name}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="mt-4">
                            {Object.keys(devicesByProvince).length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Không có thiết bị nào
                                </p>
                            ) : (
                                <Accordion type="single" collapsible className="w-full">
                                    {Object.entries(devicesByProvince).map(([province, provinceDevices]) => (
                                        <AccordionItem key={province} value={province}>
                                            <AccordionTrigger className="hover:no-underline">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">{province}</span>
                                                    <Badge variant="secondary" className="ml-auto">
                                                        {provinceDevices.length}
                                                    </Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-2 pt-2">
                                                    {provinceDevices.map((device) => (
                                                        <div
                                                            key={device.device_id}
                                                            onClick={() => handleDeviceClick(device)}
                                                            className="p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                                                        >
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-foreground truncate">
                                                                        {device.name}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        ID: {device.device_id}
                                                                    </p>
                                                                </div>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="ml-2 shrink-0"
                                                                    style={{
                                                                        backgroundColor: device.status
                                                                            ? `${statusColors[device.status]}20`
                                                                            : undefined,
                                                                        borderColor: device.status
                                                                            ? statusColors[device.status]
                                                                            : undefined,
                                                                        color: device.status
                                                                            ? statusColors[device.status]
                                                                            : undefined,
                                                                    }}
                                                                >
                                                                    {device.status ? statusLabels[device.status] : 'N/A'}
                                                                </Badge>
                                                            </div>
                                                            {device.updated_at && (
                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                    Cập nhật: {new Date(device.updated_at).toLocaleString('vi-VN', {
                                                                        day: '2-digit',
                                                                        month: '2-digit',
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </div>
                    </SheetContent>
                    <SheetOverlay className="fixed inset-0 z-[9000] bg-black/40" />
                </Sheet>

                <div className="w-full rounded-lg border bg-white shadow-lg ring-1 ring-orange-100 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                            Heatmap cảnh báo
                        </span>
                        <Button
                            type="button"
                            variant={heatmapOpen ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-[11px] shrink-0"
                            onClick={() => setHeatmapOpen((v) => !v)}
                        >
                            {heatmapOpen ? "Tắt" : "Bật"}
                        </Button>
                    </div>
                    {heatmapOpen && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-[11px]">Khung thời gian</Label>
                                <Select value={heatmapHours} onValueChange={setHeatmapHours}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[10050] max-h-[min(60vh,320px)]">
                                        <SelectItem value="1">1 giờ</SelectItem>
                                        <SelectItem value="6">6 giờ</SelectItem>
                                        <SelectItem value="24">24 giờ</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px]">Loại</Label>
                                <Select
                                    value={heatmapType}
                                    onValueChange={(v) => setHeatmapType(v as "all" | "threshold" | "disconnect")}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[10050] max-h-[min(60vh,320px)]">
                                        <SelectItem value="all">Tất cả</SelectItem>
                                        <SelectItem value="threshold">Vượt ngưỡng</SelectItem>
                                        <SelectItem value="disconnect">Mất kết nối</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className={cn(
                "relative z-0 w-full h-full isolate",
                sheetOpen && "pointer-events-none"
            )}>
                <MapContainer
                    // @ts-expect-error
                    center={center} //Tọa độ mặc định Hà Nội
                    zoom={zoom}
                    className="w-full h-full"
                >
                    <MapController center={center} zoom={zoom} />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        // @ts-expect-error
                        attribution='&copy; OpenStreetMap contributors' // Attribution để tuân thủ quyền sở hữu
                    />
                    {heatmapOpen &&
                        heatPoints.map((p, idx) => (
                            <Marker
                                key={`heat-${idx}-${p.lat}-${p.lon}`}
                                position={[p.lat, p.lon]}
                                // @ts-expect-error leaflet divIcon
                                icon={buildHeatmapDivIcon(p, heatOpacityScale)}
                                zIndexOffset={-50}
                            >
                                <Popup>
                                    <div className="text-xs space-y-1 min-w-[180px]">
                                        <p className="font-semibold text-slate-900">Điểm nóng cảnh báo</p>
                                        <p>
                                            Mức cao nhất:{" "}
                                            {p.max_level >= 3
                                                ? "Nguy hiểm"
                                                : p.max_level >= 2
                                                  ? "Cảnh báo"
                                                  : "Thông tin"}
                                        </p>
                                        <p>Số cảnh báo: {p.count}</p>
                                        {p.device_code && <p>Gateway: {p.device_code}</p>}
                                        {p.node_id && <p>Node: {p.node_id}</p>}
                                        <p className="text-muted-foreground">
                                            Cập nhật: {new Date(p.latest_at).toLocaleString("vi-VN")}
                                        </p>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    {filteredNodes.map((n) => {
                        const gwLat = n.gateway_lat;
                        const gwLon = n.gateway_lon;
                        if (
                            gwLat != null &&
                            gwLon != null &&
                            !Number.isNaN(Number(gwLat)) &&
                            !Number.isNaN(Number(gwLon))
                        ) {
                            return (
                                <Polyline
                                    key={`link-${n.id}`}
                                    positions={[
                                        [n.lat, n.lon],
                                        [Number(gwLat), Number(gwLon)],
                                    ]}
                                    pathOptions={{
                                        color: NODE_GATEWAY_LINE_COLOR,
                                        weight: 2,
                                        opacity: 0.85,
                                        dashArray: '8 6',
                                    }}
                                />
                            );
                        }
                        return null;
                    })}
                    {filteredNodes.map((n) => (
                        <Marker
                            key={`node-${n.id}`}
                            position={[n.lat, n.lon]}
                            // @ts-expect-error
                            icon={getMarkerIcon('N', n.status || undefined, false)}
                        >
                            <Popup>
                                <div className="min-w-[200px] space-y-1">
                                    <p className="text-xs font-semibold text-blue-800">Node</p>
                                    <p className="text-sm font-semibold text-gray-900">{n.name || n.node_id}</p>
                                    <p className="text-xs text-gray-600">Node ID: {n.node_id}</p>
                                    <p className="text-xs text-gray-600 border-t pt-1 mt-1">
                                        Thuộc Gateway: <span className="font-medium">{n.gateway_name || n.gateway_device_id}</span>
                                    </p>
                                    <p className="text-xs text-gray-500">({n.gateway_device_id})</p>
                                    {n.status && (
                                        <p className="text-xs text-gray-600">Trạng thái: {n.status}</p>
                                    )}
                                    <p className="text-xs text-gray-600">Tỉnh: {n.province_name || '—'}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                    {filteredDevices.map((d) => {
                        const isFocused = currentFocusDevice?.device_id === d.device_id;
                        
                        // Nếu là focusDevice thì không render ở đây
                        if (isFocused) return null;

                        return (
                            <Marker
                                key={`device-${d.device_id}`}
                                position={[d.lat, d.lon]}
                                // @ts-expect-error
                                icon={getMarkerIcon('G', d.status, false)}
                            >
                                <Popup>
                                    <div className="min-w-[200px] space-y-1">
                                        <p className="text-xs font-semibold text-emerald-800">Gateway</p>
                                        <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                                        <p className="text-xs text-gray-600">ID: {d.device_id}</p>
                                        <p className="text-xs text-gray-600">Vĩ độ: {d.lat}</p>
                                        <p className="text-xs text-gray-600">Kinh độ: {d.lon}</p>
                                        {d.status && (
                                            <p className="text-xs text-gray-600">
                                                Trạng thái kết nối: {d.status === "disconnected" ? "Mất kết nối" : d.status === "maintenance" ? "Bảo trì" : d.status === "online" ? "Hoạt động" : d.status}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-600">Lần cập nhật gần nhất:
                                            {d.updated_at ? new Date(d.updated_at).toLocaleString('vi-VN', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : 'N/A'}
                                        </p>
                                        <p className="text-xs text-gray-600">Tỉnh: {d.province_name}</p>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                    {currentFocusDevice && (
                        <Marker
                            ref={focusMarkerRef}
                            position={[currentFocusDevice.lat, currentFocusDevice.lon]}
                            // @ts-expect-error
                            icon={getMarkerIcon('G', currentFocusDevice.status, true)}
                        >
                            <Popup>
                                <div className="min-w-[200px]">
                                    <p className="text-xs font-semibold text-emerald-800">Gateway</p>
                                    <p className="text-sm font-semibold text-gray-900">{currentFocusDevice.name}</p>
                                    <p className="text-xs text-gray-600">ID: {currentFocusDevice.device_id}</p>
                                    <p className="text-xs text-gray-600 mt-1">Vĩ độ: {currentFocusDevice.lat}</p>
                                    <p className="text-xs text-gray-600">Kinh độ: {currentFocusDevice.lon}</p>
                                    {currentFocusDevice.status && (
                                        <p className="text-xs text-gray-600">
                                            Trạng thái kết nối: {currentFocusDevice.status === "disconnected" ? "Mất kết nối" : currentFocusDevice.status === "maintenance" ? "Bảo trì" : currentFocusDevice.status === "online" ? "Hoạt động" : currentFocusDevice.status}
                                        </p>
                                    )}
                                    {currentFocusDevice.updated_at && (
                                        <p className="text-xs text-gray-600">Lần cập nhật gần nhất:
                                            {new Date(currentFocusDevice.updated_at).toLocaleString('vi-VN', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-600">Tỉnh quản lý: {currentFocusDevice.province_name}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>

                {/* Chú thích Gateway / Node + trạng thái */}
                <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] max-w-[220px]">
                    <div className="pointer-events-auto rounded-md bg-white/95 shadow-md border px-3 py-2 text-xs text-gray-700 space-y-2">
                        <div className="font-semibold text-gray-800 border-b pb-1">Ký hiệu bản đồ</div>
                        <div className="space-y-1.5">
                            <div className="font-semibold text-gray-800 text-[11px]">Màu nền marker (Gateway và Node)</div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: statusColors.online }} />
                                <span>Hoạt động</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: statusColors.disconnected }} />
                                <span>Mất kết nối</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: statusColors.maintenance }} />
                                <span>Bảo trì</span>
                            </div>
                        </div>
                        <div className="border-t pt-1.5 space-y-1.5">
                            <div className="font-semibold text-gray-800 text-[11px]">Phân loại trên marker</div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-gray-500 text-[11px] font-bold text-white">G</span>
                                <span>Gateway (thiết bị trung tâm)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-gray-500 text-[11px] font-bold text-white">N</span>
                                <span>Node (cảm biến qua LoRa)</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                            Đường nét đứt: liên kết Node với Gateway tương ứng.
                        </p>
                        {heatmapOpen && (
                            <div className="border-t pt-2 space-y-1.5">
                                <div className="font-semibold text-gray-800 text-[11px]">Heatmap (cảnh báo chưa xử lý)</div>
                                <div className="h-2 w-full rounded-full overflow-hidden flex">
                                    <span className="flex-1 bg-blue-500/90" title="Thông tin" />
                                    <span className="flex-1 bg-amber-500/90" title="Cảnh báo" />
                                    <span className="flex-1 bg-red-500/90" title="Nguy hiểm" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}