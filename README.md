# LandSlide - Hệ Thống Giám Sát Sạt Lở Đất

[![GitHub](https://img.shields.io/badge/GitHub-DinhHieu07/Land--Slide-blue)](https://github.com/DinhHieu07/Land-Slide)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-green)](https://land-slide.vercel.app/)

> Hệ thống giám sát sạt lở đất thời gian thực sử dụng IoT, bản đồ số và dashboard web để theo dõi và cảnh báo sớm các nguy cơ sạt lở đất.

## Mục Lục

- [Giới Thiệu](#-giới-thiệu)
- [Tính Năng](#-tính-năng)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Cài Đặt](#-cài-đặt)
- [Cấu Hình](#-cấu-hình)
- [Sử Dụng](#-sử-dụng)
- [API Documentation](#-api-documentation)
- [Cấu Trúc Dự Án](#-cấu-trúc-dự-án)
- [Đóng Góp](#-đóng-góp)
- [License](#-license)

## Giới Thiệu

**LandSlide** là hệ thống giám sát sạt lở đất thời gian thực, được thiết kế để hỗ trợ các nhóm kỹ thuật đánh giá và theo dõi nguy cơ sạt lở đất. Hệ thống kết nối với các cảm biến IoT qua MQTT, hiển thị dữ liệu real-time trên dashboard và bản đồ, tự động phát cảnh báo khi phát hiện nguy cơ.

### Phạm Vi Triển Khai

- Phù hợp cho các huyện miền núi
- Khu vực có nguy cơ sạt lở cao
- Hỗ trợ ra quyết định sớm, giảm thiểu thiệt hại cho cộng đồng

## Tính Năng

### Quan Trắc Thời Gian Thực
- Nhận dữ liệu từ cảm biến qua **MQTT/REST API**
- Hiển thị dashboard và bản đồ **ngay lập tức** không cần refresh
- Cập nhật dữ liệu real-time qua **WebSocket**

### Bản Đồ Nguy Cơ
- Hiển thị vị trí thiết bị trên bản đồ tương tác
- Lớp bản đồ cảnh báo, khu vực nguy hiểm
- Hỗ trợ zoom tới điểm chi tiết
- Xem thông tin thiết bị trực tiếp trên bản đồ

### Cảnh Báo Đa Kênh
- Tự động phát hiện và tạo cảnh báo khi vượt ngưỡng
- Phân loại mức độ: **Critical**, **Warning**, **Info**
- Gửi cảnh báo qua **WebSocket**, **Email**
- Quản lý trạng thái: Active → Acknowledged → Resolved

### Dashboard & Thống Kê
- Tổng quan thiết bị: Online, Offline, Disconnected, Maintenance
- Biểu đồ cảm biến 24h: Số lượng mẫu, Giá trị trung bình
- Thống kê cảnh báo theo mức độ
- Phân bổ thiết bị theo tỉnh/thành
- Top thiết bị gửi dữ liệu nhiều nhất

### Phân Quyền & Bảo Mật
- Hệ thống phân quyền: **Super Admin**, **Admin**
- Quản lý tài khoản và phân quyền theo tỉnh/thành
- JWT authentication
- Ghi nhận lịch sử hoạt động

### Quản Lý Thiết Bị
- CRUD thiết bị và cảm biến
- Theo dõi trạng thái kết nối
- Tự động phát hiện thiết bị disconnected
- Xem chi tiết dữ liệu theo từng thiết bị

## Công Nghệ Sử Dụng

### Backend
- **Node.js** + **Express** - RESTful API server
- **PostgreSQL** - Database chính
- **Redis** - Caching (optional)
- **MQTT** - Nhận dữ liệu từ cảm biến IoT
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **Node-cron** - Scheduled tasks (device monitoring)
- **SendGrid** - Email notifications

### Frontend
- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Leaflet** - Interactive maps
- **Socket.io Client** - Real-time updates
- **Radix UI** - UI components
- **Lucide React** - Icons

### Infrastructure
- **Vercel** - Frontend deployment
- **PostgreSQL** - Database hosting
- **MQTT Broker** - IoT message broker

## Cài Đặt

### Yêu Cầu
- Node.js >= 18.x
- PostgreSQL >= 14.x
- Redis 
- MQTT Broker (hoặc sử dụng cloud MQTT service)

### Clone Repository
```bash
git clone https://github.com/DinhHieu07/Land-Slide.git
cd Land-Slide
```

### Backend Setup

```bash
cd backend
npm install
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Cấu Hình

### Backend Environment Variables

Tạo file `.env` trong thư mục `backend/`:

```env
# Server
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=landslide_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# MQTT
MQTT_HOST=your_mqtt_broker_host
MQTT_PORT=8883
MQTT_PROTOCOL=mqtts
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
MQTT_TOPIC=sensor/data

# Email SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_DOMAIN=landslide-monitoring.com
ALERT_EMAIL_RECIPIENT=admin@example.com

# Device Monitoring
DEVICE_OFFLINE_TIMEOUT_MINUTES=5
DEVICE_OFFLINE_CREATE_ALERT=true
DEVICE_MONITOR_SCHEDULE=*/5 * * * *
```

### Frontend Environment Variables

Tạo file `.env` trong thư mục `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Sử Dụng

### Chạy Backend

```bash
cd backend
npm run dev  
npm start  
```

Backend sẽ chạy tại: `http://localhost:5000`

### Chạy Frontend

```bash
cd frontend
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:3000`

### Truy Cập Hệ Thống

1. Mở trình duyệt và truy cập: `http://localhost:3000`
2. Đăng nhập với tài khoản admin
3. Truy cập các trang:
   - **Dashboard**: Tổng quan hệ thống
   - **Thiết bị**: Quản lý thiết bị và cảm biến
   - **Bản đồ**: Xem vị trí thiết bị trên bản đồ
   - **Cảnh báo**: Quản lý và xử lý cảnh báo
   - **Lịch sử**: Xem lịch sử dữ liệu và sự kiện

## API Documentation

### Authentication
```
POST   /api/auth/login          - Đăng nhập
POST   /api/auth/register       - Đăng ký (nếu cho phép)
POST   /api/auth/logout         - Đăng xuất
GET    /api/auth/me             - Lấy thông tin user hiện tại
```

### Dashboard
```
GET    /api/dashboard/stats                    - Thống kê tổng quan
GET    /api/dashboard/sensor-stats              - Thống kê cảm biến
GET    /api/dashboard/sensor-stats-by-device   - Thống kê theo thiết bị
```

### Devices
```
GET    /api/devices              - Danh sách thiết bị
GET    /api/devices/:id          - Chi tiết thiết bị
POST   /api/devices              - Tạo thiết bị mới
PUT    /api/devices/:id          - Cập nhật thiết bị
DELETE /api/devices/:id          - Xóa thiết bị
```

### Sensors
```
GET    /api/sensors              - Danh sách cảm biến
GET    /api/sensors/:id          - Chi tiết cảm biến
POST   /api/sensors              - Tạo cảm biến mới
PUT    /api/sensors/:id          - Cập nhật cảm biến
DELETE /api/sensors/:id          - Xóa cảm biến
```

### Alerts
```
GET    /api/alerts               - Danh sách cảnh báo
GET    /api/alerts/stats         - Thống kê cảnh báo
GET    /api/alerts/:id           - Chi tiết cảnh báo
PUT    /api/alerts/:id/status    - Cập nhật trạng thái cảnh báo
```

### History
```
GET    /api/history              - Lịch sử dữ liệu cảm biến
GET    /api/alerts               - Danh sách cảnh báo
```

### Accounts (Super Admin only)
```
GET    /api/accounts             - Danh sách tài khoản
POST   /api/accounts              - Tạo tài khoản
PUT    /api/accounts/:id         - Cập nhật tài khoản
DELETE /api/accounts/:id         - Xóa tài khoản
```

## Cấu Trúc Dự Án

```
Land-Slide/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis config
│   │   ├── controllers/     # API controllers
│   │   ├── middleware/      # Auth, Role middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # MQTT, Email, Device Monitor
│   │   └── server.js         # Entry point
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── app/                 # Next.js app router pages
│   ├── components/          # React components
│   ├── contexts/            # React contexts (Socket, Alert)
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Utilities, auth
│   ├── types/               # TypeScript types
│   ├── utils/               # Helper functions
│   ├── package.json
│   └── .env.local
│
└── README.md
```

## MQTT Data Format

Hệ thống nhận dữ liệu từ MQTT với format:

```json
{
  "device_id": "DEVICE_001",
  "timestamp": "2024-01-15T10:30:00Z",
  "readings": [
    {
      "sensor_id": "RAIN_001",
      "value": 25.5
    },
    {
      "sensor_id": "VIB_001",
      "value": 0.8
    }
  ]
}
```

## Links

- **GitHub Repository**: [https://github.com/DinhHieu07/Land-Slide](https://github.com/DinhHieu07/Land-Slide)
- **Live Demo**: [https://land-slide.vercel.app/](https://land-slide.vercel.app/)

## Tác Giả

**DinhHieu07**

- GitHub: [@DinhHieu07](https://github.com/DinhHieu07)

---

Nếu dự án này hữu ích, hãy cho một star!
