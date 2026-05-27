# LandSlide — Hệ thống giám sát sạt lở đất

Dự án gồm lớp phần cứng (node cảm biến + gateway LoRa/MQTT), backend Node.js nhận và lưu dữ liệu, dịch vụ ML phân loại mức rủi ro, và giao diện web Next.js để xem bản đồ, dashboard và quản lý cảnh báo.

Repository: https://github.com/DinhHieu07/Land-Slide

## Tổng quan kiến trúc

```
[Node ESP32] --LoRa 433MHz--> [Gateway ESP32] --MQTT TLS--> [Backend]
                                                                  |
                                    +-----------------------------+-----------------------------+
                                    |                             |                             |
                              PostgreSQL                    ML service (FastAPI)          Socket.io
                                    |                             |                             |
                                    +-----------------------------+-----------------------------+
                                                                  |
                                                          [Frontend Next.js]
```

Luồng chính:

1. Node đọc mưa, độ ẩm đất, độ nghiêng (MPU6050), đếm xung rung, ký gói tin bằng SHA-256 rồi gửi qua LoRa.
2. Gateway nhận LoRa, kiểm tra chữ ký, tính mức cảnh báo cục bộ (1 = an toàn, 2 = cảnh báo, 3 = nguy hiểm), publish JSON lên MQTT.
3. Backend subscribe MQTT, ghi lịch sử cảm biến, cập nhật `devices` / `nodes`, ghi bảng `dataset`, gọi ML để dự đoán nhãn SAFE / WARNING / DANGER.
4. Mức cảnh báo cuối cùng = `max(mức từ gateway, mức từ AI)` (nếu ML timeout thì chỉ dùng mức gateway). Khi mức > 1, hệ thống tạo bản ghi `alerts` và đẩy sự kiện Socket.io.
5. Frontend nhận cập nhật real-time (`sensor_data_update`, `new_alert`, `device_status_updated`).

## Phần cứng

Thư mục firmware Arduino/ESP32:

| Thư mục | File | Vai trò |
|---------|------|---------|
| `Node/` | `Node.ino` | Node thật: cảm biến mưa (GPIO34), ẩm đất (GPIO35), rung (GPIO27), MPU6050 (I2C 21/22), LoRa 433MHz. `nodeID` mặc định `NODE1`. |
| `Node 3/` | `Node3.ino` | Node mô phỏng: sinh số ngẫu nhiên trong vùng “an toàn”, gửi LoRa với `nodeID` `NODE3` (chu kỳ 10 giây). |
| `Gateway/` | `Gateway.ino` | Gateway: nhận LoRa, verify SHA-256, logic cảnh báo giống backend, WiFi + MQTT TLS lên broker. Topic: `landslide/{deviceID}/data`. |

Định dạng gói LoRa (chuỗi, phân tách bằng `|`):

```
{nodeID}|{rainPercent}|{soilPercent}|{tilt}|{vibrationCount}|{sha256_hex}
```

Chuỗi ký: `SHA256(nodeID|rain|soil|tilt|vib + SECRET_KEY)`. `SECRET_KEY` phải trùng giữa node và gateway (trong code hiện tại là `"secret_key"` — nên đổi khi triển khai thật).

Gateway publish MQTT (JSON):

```json
{
  "device": "HG-GW001",
  "node": "NODE1",
  "rain": 25,
  "soil": 30,
  "tilt": 2.5,
  "vibration": 5,
  "alert": 1
}
```

`alert`: 1 an toàn, 2 cảnh báo, 3 nguy hiểm. Logic trên gateway dùng ngưỡng mưa (40/80%), đất (20/80%), nghiêng (5°/10°), rung (<10 / 10–20 / >20), kèm thời gian duy trì mưa vừa (20s) và mưa mạnh (60s).

Trước khi nạp firmware: cấu hình WiFi, MQTT broker, `deviceID` trong `Gateway.ino`; pin LoRa SS=5, RST=14, DIO0=26, tần số 433 MHz.

**Lưu ý:** Gateway phải được khai báo trong database (`devices.device_id` khớp mã gateway, ví dụ `HG-GW001`). Mỗi `node` và `sensor` tương ứng (`NODE1`, loại rain/soil/tilt/vibration) cần có trong DB thì backend mới lưu lịch sử đúng.

## Backend (`backend/`)

- **Runtime:** Node.js, Express 5, `server.js` gắn HTTP + Socket.io.
- **Database:** PostgreSQL qua `DATABASE_URL` (file `src/config/db.js`).
- **Cache / phiên:** Redis lưu refresh token (`src/config/redis.js`).
- **MQTT:** `src/services/mqttSubscriber.js` — subscribe danh sách topic từ biến `MQTT_TOPIC` (có thể nhiều topic, phân tách bằng dấu phẩy). Topic gateway: `landslide/{gateway_id}/data`.
- **Giám sát thiết bị:** cron (`node-cron`) đánh dấu gateway `disconnected` nếu `last_seen` quá hạn; có thể tạo alert mất kết nối (`src/services/deviceMonitor.js`).
- **Dataset + ML:** `src/services/insertDataset.js` ghi `public.dataset`, tính `rain_warning_elapsed_sec` / `rain_danger_elapsed_sec` (cùng logic thời gian mưa như firmware), gọi `src/services/mlClient.js`.
- **Cảnh báo:** `src/services/createGatewayAlert.js` — severity `warning` (level 2) hoặc `critical` (level 3), category `threshold`, cooldown cấu hình qua `ALERT_COOLDOWN_MINUTES` (mặc định 30 phút; tăng mức thì vẫn tạo ngay).

### Phân quyền

| Role | Mô tả ngắn |
|------|------------|
| `user` | Xem bản đồ, cảnh báo, thiết bị; gửi yêu cầu gắn tỉnh/thành, chờ admin duyệt. |
| `admin` | Dashboard, quản lý thiết bị/node/sensor, xử lý cảnh báo, lịch sử, duyệt yêu cầu tỉnh (theo tỉnh được gán). |
| `superAdmin` | Toàn quyền admin + quản lý tài khoản, gán tỉnh cho admin. |

JWT access token + refresh token (cookie httpOnly). API `/api/auth/*`.

### API chính (prefix `/api`)

| Nhóm | Route | Ghi chú |
|------|-------|---------|
| Auth | `/auth/login`, `/register`, `/refresh-token`, `/logout`, `/me`, đổi/quên mật khẩu, yêu cầu tỉnh | |
| Dashboard | `/dashboard/stats`, `/sensor-stats`, `/sensor-stats-by-device`, `/sensor-stats-by-area` | Admin+ |
| Devices | `/devices` CRUD | User xem; admin sửa |
| Nodes | `/nodes/map`, `/nodes/by-gateway/:id`, CRUD | |
| Sensors | `/sensors/by-device/:id`, `/sensors/by-node/:id`, `/sensors/:id/threshold` | |
| Alerts | `/alerts`, `/alerts/stats`, `/alerts/heatmap`, `/alerts/:id/status` | |
| History | `/history/alerts`, `/history/sensor-data` | Admin+ |
| Accounts | `/accounts/*`, duyệt `province-requests` | Super admin / admin |
| Events | `/events/*` | Sự kiện sạt lở (bản đồ, lịch sử) |
| Areas | `/areas/*` | Khu vực |
| Provinces | `/provinces/public`, `/provinces/list-provinces/:username` | |

### Socket.io events

- `sensor_data_update` — sau mỗi reading lưu DB
- `new_alert` — cảnh báo mới
- `device_status_updated` — gateway offline/disconnected

### Script hỗ trợ dev

```bash
cd backend
npm run dev          # API + MQTT subscriber + device monitor
npm run simulator    # node src/simulatorGateway2.js — gửi MQTT giả (HG-GW002 / NODE2)
```

`src/simulatorDataset.js` — nạp dữ liệu synthetic vào bảng `dataset` để train ML (chạy trực tiếp bằng `node src/simulatorDataset.js`).

### Biến môi trường backend (`.env`)

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname

JWT_SECRET=...
JWT_REFRESH_SECRET=...

REDIS_URL=redis://localhost:6379

MQTT_HOST=...
MQTT_PORT=8883
MQTT_PROTOCOL=mqtts
MQTT_USERNAME=...
MQTT_PASSWORD=...
MQTT_TOPIC=landslide/+/data

ML_SERVICE_URL=http://127.0.0.1:8000
ML_PREDICT_ENABLED=1
ML_SERVICE_TIMEOUT_MS=5000
INSERT_DATASET_FROM_MQTT=1

DEVICE_OFFLINE_TIMEOUT_MINUTES=5
DEVICE_OFFLINE_CREATE_ALERT=true
DEVICE_MONITOR_SCHEDULE=*/5 * * * *
ALERT_COOLDOWN_MINUTES=30

SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
ALERT_EMAIL_RECIPIENT=...
```

Gửi email cảnh báo qua SendGrid đã có `emailService.js`; lời gọi gửi mail trong `createGatewayAlert.js` hiện đang comment — bật lại khi cần.

## Machine learning (`ml/`)

- **Huấn luyện:** `train_alert_rf.py` — Random Forest, đọc `public.dataset` từ PostgreSQL (`DATABASE_URL` trong `ml/.env`).
- **Nhãn:** SAFE, WARNING, DANGER (map từ `alert` gateway: 1/2/3).
- **Đặc trưng:** `rain_percent`, `soil_moisture`, `tilt_angle`, `vibration_count`, và tùy chọn `rain_warning_elapsed_sec`, `rain_danger_elapsed_sec`.
- **Artifact:** `ml/artifacts/alert_rf.joblib`, `label_map.json`, `training_report.json`.
- **Inference:** `server.py` (FastAPI) — `GET /health`, `POST /predict`.

Chạy dịch vụ ML:

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Huấn luyện lại:

```bash
cd ml
python train_alert_rf.py --include-rain-elapsed
```

Backend gọi `POST {ML_SERVICE_URL}/predict` sau mỗi gói MQTT hợp lệ. Kết quả AI quy ra level 1–3 rồi so với `alert` từ gateway.

## Frontend (`frontend/`)

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI, Leaflet, Recharts, Socket.io client.
- **Biến môi trường:** `NEXT_PUBLIC_API_URL` trỏ backend (mặc định `http://localhost:5000`).

### Trang

| Đường dẫn | Nội dung |
|-----------|----------|
| `/` | Trang tổng quan, đăng nhập/đăng ký |
| `/dashboard` | Thống kê thiết bị, cảm biến, cảnh báo (admin) |
| `/map` | Bản đồ gateway/node, heatmap cảnh báo |
| `/map/[deviceId]` | Chi tiết theo gateway |
| `/devices` | CRUD gateway, node, ngưỡng sensor |
| `/alerts` | Danh sách và xử lý cảnh báo |
| `/history` | Lịch sử cảnh báo và dữ liệu sensor |
| `/account` | Quản lý tài khoản (superAdmin) |
| `/province-requests` | Duyệt yêu cầu gắn tỉnh của user |

Socket chỉ kết nối khi user đã đăng nhập (`SocketContext`). Toast cảnh báo qua `AlertNotificationContext` + Sonner.

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

## Cài đặt nhanh (local)

Yêu cầu: Node.js 18+, PostgreSQL 14+, Redis, MQTT broker (TLS), Python 3.10+ cho ML.

1. Tạo database, import schema/migration (thư mục `backend/migrations/` nếu có trong môi trường của bạn — không commit trong repo).
2. Khai báo gateway, node, sensor trong DB khớp firmware.
3. Chạy Redis, PostgreSQL, ML service, backend, frontend.
4. Nạp firmware node + gateway; hoặc dùng `npm run simulator` ở backend khi chưa có phần cứng.

Thứ tự gợi ý khi develop:

```
PostgreSQL + Redis  →  uvicorn ml/server  →  backend npm run dev  →  frontend npm run dev
```

## Cấu trúc thư mục

```
LandSlide/
├── Gateway/              # Firmware gateway LoRa → MQTT
├── Node/                 # Firmware node cảm biến thật
├── Node 3/               # Firmware node mô phỏng
├── backend/
│   └── src/
│       ├── config/       # db, redis
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/     # mqtt, ml client, alerts, email, device monitor
│       ├── simulatorGateway2.js
│       └── simulatorDataset.js
├── frontend/
│   ├── app/              # pages (App Router)
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   └── types/
├── ml/
│   ├── artifacts/        # model đã train
│   ├── server.py
│   └── train_alert_rf.py
└── README.md
```

## Ghi chú vận hành

- Demo frontend có thể deploy Vercel; backend và ML cần host riêng cùng PostgreSQL, Redis, MQTT.
- Không commit file `.env` (đã có trong `.gitignore`). Firmware mẫu có chỗ điền WiFi/MQTT — thay bằng credential thật trước khi đưa vào git công khai.
- Mức cảnh báo trên gateway và trong `simulatorGateway2.js` dùng cùng bộ quy tắc; ML bổ sung lớp học từ dữ liệu lịch sử trong `dataset`.
- User thường chỉ thấy dữ liệu thuộc tỉnh đã được admin duyệt (`user_provinces` / `user_province_requests`).

## Tác giả

DinhHieu07 — https://github.com/DinhHieu07
