// Dịch tên trường (Key)
export const FIELD_NAMES: Record<string, string> = {
    // Thông tin chung
    sensor_id: "ID Cảm biến",
    sensor_code: "Loại cảm biến",
    location: "Vị trí",
    last_seen: "Lần cuối ghi nhận",
    period: "Chu kỳ",
    duration: "Thời gian diễn ra",
    time_span: "Khoảng thời gian",

    // Các chỉ số đo lường
    threshold: "Ngưỡng cảnh báo",
    max_threshold: "Ngưỡng tối đa",
    min_threshold: "Ngưỡng tối thiểu",
    peak_value: "Giá trị đỉnh",
    current_value: "Giá trị hiện tại",
    previous_value: "Giá trị trước đó",
    stabilized_value: "Giá trị ổn định",
    rain_value: "Lượng mưa",
    soil_moisture: "Độ ẩm đất",
    vibration_value: "Độ rung",
    tilt_value: "Độ nghiêng",
    battery_level: "Pin thiết bị",
    signal_strength: "Tín hiệu",

    // Phân tích & Trạng thái
    trend: "Xu hướng",
    risk_level: "Mức độ rủi ro",
    probability: "Xác suất xảy ra",
    current_probability: "Xác suất hiện tại",
    previous_probability: "Xác suất trước đó",
    status: "Trạng thái",
    factors: "Các yếu tố tác động",
    recommended_action: "Hành động đề xuất",
    actions_taken: "Các biện pháp đã thực hiện",
    change_rate: "Tỷ lệ thay đổi",
    change_percent: "Phần trăm thay đổi",
    exceeded_by: "Vượt ngưỡng",
    missing_data_count: "Số bản ghi thiếu",
    expected_interval: "Tần suất kỳ vọng",

    // Hệ thống
    error_code: "Mã lỗi",
    is_system_alert: "Cảnh báo hệ thống",
    affected_devices: "Số thiết bị ảnh hưởng",
    update_type: "Loại cập nhật",
    version: "Phiên bản",
    services_status: "Trạng thái dịch vụ",
    unit: "Đơn vị đo"
};

// Dịch giá trị (Value) - Dùng cho các trường có giá trị cố định
export const VALUE_MAPPINGS: Record<string, Record<string, string>> = {
    risk_level: {
        low: "Thấp",
        medium: "Trung bình",
        high: "Cao",
        critical: "Nghiêm trọng"
    },
    trend: {
        increasing: "Đang tăng ↗",
        decreasing: "Đang giảm ↘",
        stable: "Ổn định"
    },
    status: {
        stable: "Ổn định",
        stabilized: "Đã bình ổn",
        warning: "Cảnh báo",
        critical: "Nguy hiểm"
    },
    sensor_code: {
        VIB: "Cảm biến Rung (Vibration)",
        RAIN: "Cảm biến Mưa (Rainfall)",
        SLOPE: "Cảm biến Độ dốc (Slope)",
        SOIL: "Cảm biến Đất (Soil Moisture)",
        TILT: "Cảm biến Nghiêng (Tilt)"
    },
    factors: {
        moderate_rain: "Mưa vừa",
        heavy_rain: "Mưa lớn",
        increasing_moisture: "Độ ẩm tăng cao",
        minor_tilt: "Nghiêng nhẹ",
        high_vibration: "Rung chấn mạnh",
        high_soil_moisture: "Đất bão hòa nước"
    },
    recommended_action: {
        replace_battery: "Thay pin thiết bị",
        evacuate: "Sơ tán khẩn cấp",
        check_connection: "Kiểm tra kết nối",
        reinforce: "Gia cố khu vực"
    },
    actions_taken: {
        drainage: "Khơi thông dòng chảy",
        reinforcement: "Gia cố kè chắn",
        alert_sent: "Đã gửi cảnh báo dân cư"
    },
    services_status: {
        all_operational: "Hoạt động bình thường",
        partial_outage: "Gián đoạn một phần"
    },
    update_type: {
        automatic: "Tự động",
        manual: "Thủ công"
    }
};