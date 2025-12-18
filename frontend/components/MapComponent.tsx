"use client";

import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
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
import { List, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    const { isAuthenticated } = useAuth();
    const [center, setCenter] = useState<[number, number]>([21.0285, 105.8542]);
    const [zoom, setZoom] = useState(8);
    const [devices, setDevices] = useState<DeviceMarker[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const focusMarkerRef = useRef<any>(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
                const response = await authenticatedFetch(`${API_URL}/api/devices?limit=1000&offset=0`, { method: "GET" });
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

    // Nhóm thiết bị theo tỉnh
    const devicesByProvince = useMemo(() => {
        const grouped: Record<string, DeviceMarker[]> = {};
        devices.forEach(device => {
            const provinceKey = device.province_name || 'Chưa xác định';
            if (!grouped[provinceKey]) {
                grouped[provinceKey] = [];
            }
            grouped[provinceKey].push(device);
        });
        return grouped;
    }, [devices]);

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
        online: 'Online',
        offline: 'Offline',
        disconnected: 'Mất kết nối',
        maintenance: 'Bảo trì',
    };

    const getDeviceIcon = useMemo(() => {
        return (status?: string, active?: boolean) => {
            const color = status ? (statusColors[status] || '#2563eb') : '#2563eb';
            const size = active ? 40 : 30;
            const border = active ? 3 : 2;
            const shadow = active ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.35)';
            const fontSize = active ? 16 : 13;
            return L.divIcon({
                className: 'device-marker',
                html: `<div style="
                    background-color: ${color};
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
                    ">D</div>
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
            <div className="absolute left-16 top-4 z-[1000] pointer-events-auto">
                <PageBreadcrumb />
            </div>

            {/* Nút mở Sheet quản lý thiết bị */}
            <div className="absolute right-4 top-4 z-[1000] pointer-events-auto">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-white shadow-md">
                            <List className="h-4 w-4 mr-2" />
                            Danh sách thiết bị
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto z-[1000]">
                        <SheetHeader>
                            <SheetTitle>Danh sách thiết bị</SheetTitle>
                            <SheetDescription>
                                Nhấn vào thiết bị để xem vị trí trên bản đồ
                            </SheetDescription>
                        </SheetHeader>

                        <div className="mt-6 space-y-6">
                            {Object.keys(devicesByProvince).length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Không có thiết bị nào
                                </p>
                            ) : (
                                Object.entries(devicesByProvince).map(([province, provinceDevices]) => (
                                    <div key={province} className="space-y-2">
                                        <h3 className="ml-2 text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b">
                                            <MapPin className="h-4 w-4" />
                                            {province}
                                            <Badge variant="secondary" className="ml-auto">
                                                {provinceDevices.length}
                                            </Badge>
                                        </h3>
                                        <div className="space-y-1 pl-2">
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
                                    </div>
                                ))
                            )}
                        </div>
                    </SheetContent>
                    <SheetOverlay className="fixed inset-0 z-[9000] bg-black/40" />
                </Sheet>
            </div>

            <div className={cn(
                "relative z-0 w-full h-full",
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
                    {devices.map((d) => {
                        // Kiểm tra xem thiết bị này có phải là focusDevice không
                        const isFocused = currentFocusDevice?.device_id === d.device_id;
                        
                        // Nếu là focusDevice thì không render ở đây (sẽ render riêng với active=true)
                        if (isFocused) return null;

                        return (
                            <Marker
                                key={`device-${d.device_id}`}
                                position={[d.lat, d.lon]}
                                // @ts-expect-error
                                icon={getDeviceIcon(d.status, false)}
                            >
                                <Popup>
                                    <div className="min-w-[200px] space-y-1">
                                        <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                                        <p className="text-xs text-gray-600">ID: {d.device_id}</p>
                                        <p className="text-xs text-gray-600">Vĩ độ: {d.lat}</p>
                                        <p className="text-xs text-gray-600">Kinh độ: {d.lon}</p>
                                        {d.status && (
                                            <p className="text-xs text-gray-600">
                                                Trạng thái kết nối: {d.status === "disconnected" ? "Mất kết nối" : d.status === "maintenance" ? "Bảo trì" : d.status === "offline" ? "Offline" : d.status === "online" ? "Online" : d.status}
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
                            icon={getDeviceIcon(currentFocusDevice.status, true)}
                        >
                            <Popup>
                                <div className="min-w-[200px]">
                                    <p className="text-sm font-semibold text-gray-900">{currentFocusDevice.name}</p>
                                    <p className="text-xs text-gray-600">ID: {currentFocusDevice.device_id}</p>
                                    <p className="text-xs text-gray-600 mt-1">Vĩ độ: {currentFocusDevice.lat}</p>
                                    <p className="text-xs text-gray-600">Kinh độ: {currentFocusDevice.lon}</p>
                                    {currentFocusDevice.status && (
                                        <p className="text-xs text-gray-600">
                                            Trạng thái kết nối: {currentFocusDevice.status === "disconnected" ? "Mất kết nối" : currentFocusDevice.status === "maintenance" ? "Bảo trì" : currentFocusDevice.status === "offline" ? "Offline" : currentFocusDevice.status === "online" ? "Online" : currentFocusDevice.status}
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
            </div>
        </div>
    );
}