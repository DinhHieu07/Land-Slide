export interface Device {
    id: number;
    device_id: string;
    name: string;
    status: "online" | "offline" | "disconnected" | "maintenance";
    lat: number;
    lon: number;
    last_seen: string;
    latest_data?: Record<string, any>;
    updated_at?: string;
    province_id?: number;
    province_name?: string;
    province_code?: string;
}