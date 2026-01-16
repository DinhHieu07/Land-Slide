# 🎯 KỊCH BẢN BÁO CÁO ĐỒ ÁN - HỆ THỐNG GIÁM SÁT SẠT LỞ ĐẤT

## ⏱️ Tổng thời gian: 15-20 phút

---

## 📋 PHẦN 1: MỞ ĐẦU (2-3 phút)

### 1.1. Giới thiệu vấn đề thực tế
**Câu mở đầu:**
> "Thưa thầy, em xin phép được bắt đầu với một vấn đề thực tế mà chúng ta đang đối mặt: **Sạt lở đất** là một trong những thiên tai nguy hiểm nhất ở Việt Nam, đặc biệt là các khu vực miền núi. Mỗi năm có hàng trăm vụ sạt lở gây thiệt hại về người và tài sản."

**Slide/Ảnh minh họa:**
- Thống kê sạt lở đất ở Việt Nam
- Hình ảnh thiệt hại (nếu có)

### 1.2. Đặt vấn đề
**Câu chuyển:**
> "Vấn đề đặt ra là: **Làm sao để phát hiện sớm nguy cơ sạt lở đất để có thể cảnh báo kịp thời cho người dân?**"

### 1.3. Giới thiệu giải pháp
**Câu kết:**
> "Đó chính là lý do em xây dựng **Hệ thống Giám sát Sạt Lở Đất** - một hệ thống IoT real-time sử dụng cảm biến, bản đồ số và dashboard web để theo dõi và cảnh báo sớm các nguy cơ sạt lở đất."

**Mở trình duyệt:** `https://land-slide.vercel.app/`

---

## 📋 PHẦN 2: TỔNG QUAN HỆ THỐNG (3-4 phút)

### 2.1. Trang chủ - Giới thiệu hệ thống
**Thao tác:**
1. Mở trang chủ, giới thiệu các tính năng chính:
   - ✅ **Quan trắc thời gian thực** - Nhận dữ liệu từ cảm biến IoT
   - ✅ **Bản đồ nguy cơ** - Hiển thị vị trí thiết bị trên bản đồ
   - ✅ **Cảnh báo đa kênh** - WebSocket + Email
   - ✅ **Phân quyền & nhật ký** - Bảo mật và theo dõi

2. **Điểm nhấn:** 
   > "Hệ thống được xây dựng với kiến trúc **Full-stack**: Backend Node.js + Express, Frontend Next.js, Database PostgreSQL, và tích hợp MQTT để nhận dữ liệu từ cảm biến IoT."

### 2.2. Đăng nhập
**Thao tác:**
- Click "Đăng nhập" → Nhập tài khoản admin
- **Giải thích:** "Hệ thống có phân quyền: Super Admin, Admin, và User. Mỗi role có quyền truy cập khác nhau."

---

## 📋 PHẦN 3: DEMO TÍNH NĂNG CHÍNH (8-10 phút)

### 3.1. DASHBOARD - Trái tim của hệ thống ⭐ **QUAN TRỌNG NHẤT**

**Câu dẫn:**
> "Sau khi đăng nhập, chúng ta sẽ thấy **Dashboard** - đây là trái tim của hệ thống, nơi hiển thị toàn bộ thông tin real-time."

**Demo từng phần:**

#### a) **Thống kê thiết bị** (Cards trên cùng)
- Tổng thiết bị, Thiết bị đang hoạt động, Mất kết nối, Bảo trì
- **Điểm nhấn:** "Số liệu này được cập nhật **real-time** qua WebSocket, không cần refresh trang."

#### b) **Tình trạng cảnh báo**
- Đang bị lỗi, Cảnh báo nghiêm trọng, Đã xác nhận, Đã xử lý
- **Điểm nhấn:** "Hệ thống tự động phân loại cảnh báo theo mức độ: Critical, Warning, Info."

#### c) **Biểu đồ cảm biến 24h** ⭐ **TÍNH NĂNG XỊN**
- Số lượng mẫu cảm biến (Bar Chart)
- Giá trị trung bình cảm biến (Area Chart)
- **Điểm nhấn:** 
  > "Đây là dữ liệu **real-time** từ các cảm biến: Lượng mưa, Độ ẩm đất, Cảm biến rung, Độ nghiêng, Độ dốc. Biểu đồ tự động cập nhật khi có dữ liệu mới từ MQTT."

#### d) **Chi tiết theo thiết bị**
- Chọn một thiết bị từ dropdown
- Xem biểu đồ line chart với Min/Max/Avg
- **Điểm nhấn:** "Có thể xem chi tiết dữ liệu của từng thiết bị riêng lẻ."

#### e) **Top thiết bị gửi dữ liệu nhiều nhất**
- Hiển thị top 5 thiết bị

#### f) **Thiết bị theo tỉnh/thành**
- Phân bổ địa lý
- **Điểm nhấn:** "Hệ thống hỗ trợ quản lý thiết bị theo từng tỉnh/thành, phù hợp với mô hình quản lý thực tế."

---

### 3.2. QUẢN LÝ THIẾT BỊ - Quản trị hệ thống

**Câu dẫn:**
> "Tiếp theo, chúng ta sẽ xem cách **quản lý thiết bị và cảm biến** - đây là phần admin để cấu hình hệ thống."

**Demo:**
1. **Danh sách thiết bị:**
   - Filter theo status, tỉnh/thành
   - Search thiết bị
   - Xem chi tiết từng thiết bị

2. **Tạo thiết bị mới:**
   - Click "Thêm thiết bị"
   - Điền thông tin: Tên, ID, Tỉnh/thành, Tọa độ (có bản đồ picker)
   - **Điểm nhấn:** "Có thể chọn vị trí trực tiếp trên bản đồ."

3. **Quản lý cảm biến:**
   - Xem danh sách cảm biến của thiết bị
   - Thêm/sửa/xóa cảm biến
   - Cấu hình ngưỡng (min_threshold, max_threshold)
   - **Điểm nhấn:** 
     > "Khi giá trị cảm biến vượt ngưỡng, hệ thống sẽ **tự động tạo cảnh báo**. Đây là cơ chế tự động hóa quan trọng."

4. **Trạng thái real-time:**
   - Badge màu sắc: Online (xanh), Offline (xám), Disconnected (đỏ), Maintenance (xanh dương)
   - **Điểm nhấn:** "Trạng thái được cập nhật real-time. Nếu thiết bị không gửi dữ liệu trong 5 phút, hệ thống tự động chuyển sang 'Disconnected' và tạo cảnh báo."

---

### 3.3. BẢN ĐỒ - Trực quan hóa địa lý ⭐ **ẤN TƯỢNG**

**Câu dẫn:**
> "Một trong những tính năng quan trọng nhất là **Bản đồ** - giúp trực quan hóa vị trí thiết bị và cảnh báo trên bản đồ thực tế."

**Demo:**
1. **Bản đồ tổng quan:**
   - Hiển thị tất cả thiết bị dưới dạng markers
   - Màu sắc theo trạng thái
   - Click vào marker → Xem thông tin thiết bị

2. **Chi tiết thiết bị trên bản đồ:**
   - Click vào một thiết bị
   - Xem thông tin chi tiết: Tên, Status, Cảm biến, Dữ liệu mới nhất
   - **Điểm nhấn:** "Có thể xem dữ liệu cảm biến mới nhất ngay trên bản đồ."

3. **Tính năng bản đồ:**
   - Zoom in/out
   - Pan (kéo thả)
   - **Điểm nhấn:** "Sử dụng Leaflet - một thư viện bản đồ mã nguồn mở mạnh mẽ."

---

### 3.4. QUẢN LÝ CẢNH BÁO - Xử lý sự cố ⭐ **TÍNH NĂNG XỊN**

**Câu dẫn:**
> "Khi có nguy cơ, hệ thống sẽ tự động tạo **Cảnh báo**. Đây là phần quản lý và xử lý cảnh báo."

**Demo:**
1. **Danh sách cảnh báo:**
   - Filter theo: Severity (Critical/Warning/Info), Status (Active/Acknowledged/Resolved), Category
   - Search cảnh báo
   - **Điểm nhấn:** "Cảnh báo được phân loại rõ ràng theo mức độ nghiêm trọng."

2. **Xem chi tiết cảnh báo:**
   - Click vào một cảnh báo
   - Xem: Thông tin thiết bị, Cảm biến, Giá trị trigger, Evidence data
   - **Điểm nhấn:** 
     > "Mỗi cảnh báo đều có **Evidence data** - dữ liệu chứng cứ đầy đủ để phân tích sau này."

3. **Xử lý cảnh báo (Workflow):**
   - **Active** → Click "Xác nhận" → Chuyển sang **Acknowledged**
   - **Acknowledged** → Click "Xử lý" → Nhập ghi chú → Chuyển sang **Resolved**
   - **Điểm nhấn:** 
     > "Đây là quy trình xử lý cảnh báo chuẩn: Active → Acknowledged → Resolved. Mỗi bước đều được ghi nhận lịch sử."

4. **Real-time notification:**
   - Mở DevTools → Network → WS (WebSocket)
   - **Điểm nhấn:** 
     > "Khi có cảnh báo mới, hệ thống gửi qua **WebSocket** và hiển thị toast notification ngay lập tức. Không cần refresh trang."

---

### 3.5. LỊCH SỬ - Phân tích dữ liệu

**Câu dẫn:**
> "Để phân tích xu hướng và lịch sử, chúng ta có trang **Lịch sử**."

**Demo:**
1. **Lịch sử dữ liệu cảm biến:**
   - Chọn thiết bị, cảm biến, khoảng thời gian
   - Xem biểu đồ lịch sử
   - Export dữ liệu (nếu có)

2. **Lịch sử sự kiện:**
   - Xem các sự kiện đã xảy ra
   - Filter theo thời gian

---

### 3.6. QUẢN LÝ TÀI KHOẢN (Nếu là Super Admin)

**Câu dẫn:**
> "Cuối cùng, với quyền Super Admin, có thể **quản lý tài khoản** và phân quyền."

**Demo:**
1. **Danh sách tài khoản:**
   - Xem tất cả user
   - Filter theo role

2. **Tạo/Sửa tài khoản:**
   - Tạo user mới
   - Phân quyền theo tỉnh/thành
   - **Điểm nhấn:** 
     > "Có thể cấu hình user chỉ quản lý thiết bị ở một số tỉnh/thành cụ thể - phù hợp với mô hình phân cấp quản lý."

---

## 📋 PHẦN 4: DEMO TÍNH NĂNG REAL-TIME (2-3 phút) ⭐ **ẤN TƯỢNG NHẤT**

### 4.1. Mở Terminal Backend
**Câu dẫn:**
> "Bây giờ em sẽ demo tính năng **real-time** - đây là điểm mạnh của hệ thống."

**Thao tác:**
1. Mở terminal backend, show logs:
   ```
   Server is running on port 5000
   Đã kết nối MQTT broker thành công!
   Socket.io is ready
   ```

2. **Giải thích:**
   > "Backend đang chạy, đã kết nối MQTT broker và Socket.io sẵn sàng nhận dữ liệu."

### 4.2. Gửi dữ liệu test qua MQTT
**Thao tác:**
1. Mở simulator hoặc MQTT client
2. Gửi dữ liệu test (hoặc đã có sẵn)
3. Quan sát:
   - **Terminal:** Logs nhận dữ liệu MQTT
   - **Browser DevTools → Network → WS:** WebSocket messages
   - **Dashboard:** Biểu đồ tự động cập nhật

**Điểm nhấn:**
> "Như các bạn thấy, khi có dữ liệu mới từ MQTT, **Dashboard tự động cập nhật ngay lập tức** mà không cần refresh. Đây là sức mạnh của WebSocket real-time."

### 4.3. Demo cảnh báo tự động
**Thao tác:**
1. Gửi dữ liệu vượt ngưỡng
2. Quan sát:
   - Terminal: Log tạo cảnh báo
   - Dashboard: Số cảnh báo tăng
   - Toast notification xuất hiện
   - Trang Alerts: Cảnh báo mới xuất hiện

**Điểm nhấn:**
> "Hệ thống **tự động phát hiện** khi giá trị vượt ngưỡng và **tự động tạo cảnh báo**, gửi email, và thông báo real-time qua WebSocket. Tất cả đều tự động hóa."

---

## 📋 PHẦN 5: KIẾN TRÚC & CÔNG NGHỆ (2-3 phút)

### 5.1. Kiến trúc hệ thống
**Slide/Diagram:**
```
IoT Sensors → MQTT Broker → Backend (Node.js)
                              ↓
                         PostgreSQL
                              ↓
                    Socket.io (WebSocket)
                              ↓
                    Frontend (Next.js)
```

**Giải thích:**
- **MQTT:** Giao thức nhẹ cho IoT, nhận dữ liệu từ cảm biến
- **Backend:** Xử lý logic, lưu database, emit WebSocket
- **Frontend:** Hiển thị real-time, tương tác người dùng

### 5.2. Công nghệ sử dụng
**Backend:**
- Node.js + Express
- PostgreSQL
- MQTT client
- Socket.io
- JWT authentication

**Frontend:**
- Next.js 16 (React framework)
- TypeScript
- Tailwind CSS
- Recharts (biểu đồ)
- Leaflet (bản đồ)
- Socket.io Client

**Điểm nhấn:**
> "Tất cả đều là công nghệ **modern, phổ biến** và có cộng đồng hỗ trợ lớn."

---

## 📋 PHẦN 6: KẾT LUẬN (1-2 phút)

### 6.1. Tóm tắt tính năng
**Liệt kê:**
- ✅ Real-time monitoring qua MQTT + WebSocket
- ✅ Dashboard với biểu đồ thống kê đầy đủ
- ✅ Bản đồ tương tác hiển thị thiết bị
- ✅ Hệ thống cảnh báo tự động đa kênh
- ✅ Quản lý thiết bị và cảm biến
- ✅ Phân quyền và bảo mật
- ✅ Lịch sử và phân tích dữ liệu

### 6.2. Điểm mạnh
- **Real-time:** Cập nhật ngay lập tức, không cần refresh
- **Tự động hóa:** Tự động phát hiện và cảnh báo
- **Trực quan:** Bản đồ và biểu đồ dễ hiểu
- **Mở rộng:** Dễ dàng thêm thiết bị và cảm biến mới
- **Bảo mật:** Phân quyền rõ ràng, JWT authentication

### 6.3. Hướng phát triển
- Machine Learning để dự đoán sạt lở
- Mobile app (React Native)
- Tích hợp thêm loại cảm biến khác
- Báo cáo tự động định kỳ

### 6.4. Kết thúc
> "Em xin cảm ơn thầy đã lắng nghe. Em sẵn sàng trả lời các câu hỏi."

---

## 🎯 TIPS QUAN TRỌNG KHI TRÌNH BÀY

### 1. **Tốc độ nói:**
- Nói chậm, rõ ràng
- Dừng lại ở các điểm quan trọng
- Để thầy có thời gian quan sát

### 2. **Tương tác:**
- Hỏi thầy: "Thầy có muốn em demo thêm phần nào không?"
- Quan sát phản ứng của thầy
- Điều chỉnh tốc độ nếu thầy muốn xem kỹ hơn

### 3. **Nhấn mạnh điểm mạnh:**
- **Real-time** - nhắc lại nhiều lần
- **Tự động hóa** - đây là điểm khác biệt
- **Trực quan** - bản đồ và biểu đồ

### 4. **Chuẩn bị trước:**
- ✅ Có sẵn dữ liệu test trong database
- ✅ Backend đang chạy
- ✅ MQTT simulator sẵn sàng (hoặc có dữ liệu real)
- ✅ Mở sẵn DevTools (Network tab)
- ✅ Terminal backend visible

### 5. **Xử lý lỗi:**
- Nếu có lỗi, bình tĩnh giải thích: "Đây là môi trường demo, trong thực tế sẽ có xử lý lỗi tốt hơn"
- Nếu không có dữ liệu: "Em có thể demo với dữ liệu mẫu"

### 6. **Câu hỏi thường gặp:**
- **"Làm sao đảm bảo dữ liệu chính xác?"** → Có validation, kiểm tra threshold, lưu lịch sử
- **"Nếu MQTT broker down thì sao?"** → Có retry mechanism, log lỗi
- **"Bảo mật như thế nào?"** → JWT, phân quyền, HTTPS
- **"Có thể mở rộng không?"** → Kiến trúc modular, dễ thêm tính năng

---

## 📊 THỜI GIAN PHÂN BỔ

| Phần | Thời gian | Tỷ lệ |
|------|-----------|-------|
| Mở đầu | 2-3 phút | 15% |
| Tổng quan | 3-4 phút | 20% |
| Demo tính năng | 8-10 phút | 50% |
| Real-time demo | 2-3 phút | 10% |
| Kiến trúc | 2-3 phút | 10% |
| Kết luận | 1-2 phút | 5% |
| **TỔNG** | **18-25 phút** | **100%** |

---

## ✅ CHECKLIST TRƯỚC KHI BÁO CÁO

- [ ] Backend đang chạy, không có lỗi
- [ ] Frontend deploy và hoạt động tốt
- [ ] Có dữ liệu test trong database
- [ ] MQTT simulator/test client sẵn sàng
- [ ] Terminal backend mở sẵn
- [ ] Browser DevTools mở sẵn (Network tab)
- [ ] Đã test tất cả tính năng trước
- [ ] Chuẩn bị slide/diagram (nếu cần)
- [ ] Đã đọc kỹ kịch bản này

---

**Chúc bạn báo cáo thành công! 🎉**
