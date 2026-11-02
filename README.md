# 🚀 TaskFlow AI — Hệ thống Quản lý Công việc & Đánh giá Hiệu suất Nhân sự Tích hợp AI

> **Đồ án Tốt nghiệp CNTT** — Sinh viên: **Dương Chí Du** — MSSV: **2310900022**  
> Lớp: **K23CNT2** | Ngành: **Công nghệ Thông tin**

---

## 📋 Tổng quan Dự án

**TaskFlow AI** là nền tảng quản trị công việc và hiệu suất doanh nghiệp (Enterprise Work Management & KPI), cung cấp giải pháp chuyển đổi số toàn diện:

* 📌 **Quản lý công việc chuẩn Enterprise WBS & Kanban Board**: Hỗ trợ phân rã cấu trúc công việc (Parent Task & Sub-tasks), quản lý tiến độ trực quan, kéo thả thời gian thực.
* 🔒 **Ràng buộc phụ thuộc liên đới (Task Dependencies)**: Kiểm soát thứ tự thực thi (Blocks, Blocked By), tự động khóa và cảnh báo khi task tiền đề chưa hoàn tất.
* ✅ **Tiêu chí nghiệm thu (Definition of Done - DoD) & Quy trình QA/Reviewer**: Kiểm soát chất lượng 2 bước trước khi chuyển trạng thái Done.
* 📊 **Đánh giá KPI & Thuật toán Lương 3P chuẩn hóa**:
  * Tự động tính điểm KPI đa tiêu chí ($40\%$ Task hoàn thành, $40\%$ Đúng hạn Deadline, $20\%$ Điểm quản lý).
  * Hạch toán quỹ giờ công theo cơ chế 3 nhóm: Dự án cốt lõi (hệ số 1:3), Nghiên cứu & Phát triển (R&D trần 500h), Vận hành (chuẩn 660h).
  * Cơ chế khóa kỳ lương (Snapshot Persistence) và hỗ trợ mở khóa kỳ (Unlock Period) cho Quản trị viên.
* 🤖 **AI Copilot & AI Voice Assistant**:
  * Tích hợp **Google Gemini AI** phân tích câu lệnh tự nhiên, bóc tách thực thể JSON tạo công việc tức thì.
  * Tự động phân rã cây công việc WBS thông minh kèm tiêu chí DoD chuẩn chuyên môn kỹ thuật.
* 🛡️ **Bảo mật & Phân quyền RBAC 2 lớp**: Phân tách rành mạch giao diện và quyền truy cập dữ liệu giữa **Admin**, **Manager**, và **Employee**.
* ⚡ **Đồng bộ thời gian thực (Real-time)**: Sử dụng Socket.IO truyền nhận trạng thái kéo thả Kanban, cập nhật thông báo và nhật ký kiểm vết (Activity Log).

---

## 🛠️ Tech Stack

### Backend
* **Runtime**: Node.js & Express (TypeScript)
* **Database & ORM**: MySQL & Prisma ORM
* **Realtime**: Socket.IO
* **AI Engine**: Google Gemini API SDK (`@google/genai` / `@google/generative-ai`)
* **Bảo mật**: JWT, bcrypt, RBAC Middleware

### Frontend
* **Core**: React 18, Vite (TypeScript)
* **Styling**: TailwindCSS, Lucide React
* **Speech Processing**: HTML5 Web Speech API
* **State & Networking**: Axios, Socket.io-client

---

## 🚀 Tiến độ Dự án (Project Progress)

- [x] **Xác thực & Phân quyền (RBAC)**: Đăng nhập JWT, phân quyền Admin / Manager / Employee chặt chẽ.
- [x] **Kanban Board & WBS Đa tầng**:
  - [x] Kéo thả trạng thái công việc thời gian thực qua Socket.IO.
  - [x] Cấu trúc phân cấp Công việc lớn (Parent Task) & Công việc con (Sub-tasks).
  - [x] Quản lý mối quan hệ phụ thuộc công việc (Dependencies: `BLOCKS`, `BLOCKED_BY`).
  - [x] Tiêu chí nghiệm thu bắt buộc (Definition of Done - DoD Checklists).
  - [x] Quy trình phê duyệt kiểm thử 2 bước (Review / QA Sign-off & Reject Reason).
- [x] **Phân hệ Đánh giá KPI & Lương 3P**:
  - [x] Thuật toán tính điểm KPI tự động $40\% - 40\% - 20\%$.
  - [x] Cơ chế quy đổi giờ công định mức $660h - 500h - 1:3$.
  - [x] Khóa kỳ lương (Lock Payroll) lưu snapshot vào MySQL, hỗ trợ Mở khóa kỳ (Unlock Period).
  - [x] Phân quyền hiển thị: Nhân viên bảo mật phiếu lương cá nhân, Quản lý xem phòng ban, Admin toàn quyền.
- [x] **Trợ lý Trí tuệ Nhân tạo (AI Copilot)**:
  - [x] AI Voice Command: Nhận diện giọng nói tiếng Việt bóc tách thông tin tạo Task.
  - [x] Gemini Task Decomposition: Tự động phân rã WBS và gợi ý checklist tiêu chí hoàn thành.
- [ ] **Báo cáo & Xuất dữ liệu**: Xuất phiếu lương cá nhân (PDF) và bảng tổng hợp quỹ công (Excel).

---

## 💻 Cài đặt & Khởi chạy Môi trường Phát triển

### 1. Yêu cầu môi trường
* Node.js >= 18.x
* MySQL Server >= 8.0

### 2. Cấu hình biến môi trường
Tạo file `.env` tại thư mục `server/`:
```env
DATABASE_URL="mysql://root:password@localhost:3306/chat_ai_kpi_db"
JWT_SECRET="your_jwt_secret_key"
GEMINI_API_KEY="your_google_gemini_api_key"
PORT=5000
