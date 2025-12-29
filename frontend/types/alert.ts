export interface Alert {
    id: number;
    device_id: number;
    sensor_id: number | null;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    triggered_value: number | null;
    status: 'active' | 'acknowledged' | 'resolved';
    resolved_by: number | null;
    resolved_at: string | null;
    resolved_note: string | null;
    category: 'threshold' | 'hardware' | 'prediction' | 'system';
    evidence_data: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    
    // Joined data
    device_code?: string;
    device_name?: string;
    province_id?: number;
    province_name?: string;
    province_code?: string;
    resolved_by_username?: string;
    sensor_code?: string;
    sensor_name?: string;
    sensor_type?: string;
}

export interface AlertStats {
    active_count: number;
    acknowledged_count: number;
    resolved_count: number;
    critical_count: number;
    warning_count: number;
    info_count: number;
    total_count: number;
}

