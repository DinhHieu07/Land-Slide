"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, use } from "react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@mui/material";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Device = {
    device_id: string;
    name: string;
    lat: number;
    lon: number;
    status?: string;
    updated_at?: string;
    province_name?: string;
};

export default function DeviceMapPage({ params }: { params: Promise<{ deviceId: string }> }) {
    const { deviceId } = use(params);
    const [device, setDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated } = useAuth();
    useEffect(() => {
        const fetchDevice = async () => {
            try {
                const res = await authenticatedFetch(`${API_URL}/api/devices/${deviceId}`, { credentials: "include" });
                const data = await res.json();
                if (res.ok && data.success) {
                    setDevice({
                        device_id: data.data.device_id,
                        name: data.data.name,
                        lat: data.data.lat,
                        lon: data.data.lon,
                        status: data.data.status,
                        updated_at: data.data.updated_at,
                        province_name: data.data.province_name,
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDevice();
    }, [deviceId]);

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

    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center">
                <p>Đang tải vị trí thiết bị...</p>
            </div>
        );
    }

    if (!device) {
        return (
            <div className="w-full h-screen flex items-center justify-center">
                <p>Không tìm thấy thiết bị</p>
            </div>
        );
    }

    return (
        <div className="w-full h-screen">
            <MapComponent focusDevice={device} />
        </div>
    );
}

