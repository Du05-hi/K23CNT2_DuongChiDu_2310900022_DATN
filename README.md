# 🚀 TaskFlow AI — Hệ thống Quản lý Công việc & Đánh giá Hiệu suất Nhân sự Tích hợp AI

> **Đồ án Tốt nghiệp CNTT** — Sinh viên: Dương Chí Dư — MSSV: 2310900022  
> Lớp: K23CNT2 | Ngành: Công nghệ Thông tin

---

## 📋 Tổng quan Dự án

**TaskFlow AI** là hệ thống Web ERP dành cho doanh nghiệp vừa và nhỏ, cung cấp:

- 📌 **Quản lý công việc** theo dạng Kanban Board kéo thả mượt mà
- 📊 **Đánh giá KPI** tự động tính điểm hiệu suất nhân sự hàng tháng
- 🤖 **AI Assistant** tích hợp Google Gemini — phân tách task, tóm tắt tiến độ, cảnh báo rủi ro
- 🔔 **Thông báo Realtime** qua Socket.io với Activity Feed trực tiếp
- 🎉 **Gamification** — hiệu ứng pháo hoa khi hoàn thành task

---

## 🛠 Tech Stack

### Backend
| Công nghệ | Mục đích |
|-----------|----------|
| Node.js + TypeScript | Runtime & ngôn ngữ |
| Express.js | REST API Framework |
| Prisma ORM | Database access layer |
| MySQL | Cơ sở dữ liệu chính |
| Socket.io | Realtime communication |
| Passport.js | Google OAuth 2.0 |
| Nodemailer | Email OTP via Gmail SMTP |
| JWT (Access + Refresh) | Authentication |
| Bcrypt | Password hashing |
| Google Gemini API | AI Integration |
| ExcelJS | Xuất báo cáo Excel |

### Frontend
| Công nghệ | Mục đích |
|-----------|----------|
| React 18 + TypeScript | UI Framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| Framer Motion | Animations |
| Redux Toolkit | State management |
| TanStack React Query | Server state |
| @hello-pangea/dnd | Kanban drag & drop |
| Recharts | Biểu đồ tương tác |
| canvas-confetti | Hiệu ứng pháo hoa 🎉 |
| Socket.io-client | Realtime client |
| Sonner | Toast notifications |
| Lucide React | Icons |

---

## 📁 Cấu trúc Dự án

```
TaskFlow-AI/
├── client/                          # React Frontend
│   ├── src/
│   │   ├── api/apiClient.ts         # Axios instance + interceptors
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   │   ├── Layout.tsx       # Main layout wrapper
│   │   │   │   └── AppLayout.tsx    # App layout với header
│   │   │   ├── tasks/
│   │   │   │   ├── TaskCard.tsx     # Kanban task card
│   │   │   │   └── TaskDetailModal.tsx # Modal chi tiết task
│   │   │   ├── charts/
│   │   │   │   ├── ProjectProgressChart.tsx
│   │   │   │   ├── RadarProductivityChart.tsx
│   │   │   │   └── KpiBarChart.tsx
│   │   │   ├── ui/
│   │   │   │   ├── StatsCard.tsx
│   │   │   │   ├── LoadingSkeleton.tsx
│   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── Avatar.tsx
│   │   │   ├── auth/
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   └── AdminRoute.tsx
│   │   │   ├── AIAssistantModal.tsx  # Floating AI Modal
│   │   │   ├── NotificationBell.tsx  # Chuông thông báo
│   │   │   └── RealtimeActivityFeed.tsx # Feed hoạt động realtime
│   │   ├── hooks/
│   │   │   ├── useAuth.ts           # Hook xác thực
│   │   │   └── useSocket.ts         # Hook Socket.io
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx        # Glassmorphism login
│   │   │   ├── DashboardPage.tsx    # Dashboard KPI + Charts
│   │   │   ├── KanbanPage.tsx       # Kanban + Confetti 🎉
│   │   │   ├── KpiPage.tsx          # Bảng xếp hạng KPI
│   │   │   ├── ProjectsPage.tsx     # Quản lý dự án
│   │   │   ├── AIAssistantPage.tsx  # AI Assistant
│   │   │   ├── AdminPage.tsx        # Admin panel
│   │   │   └── ProfilePage.tsx      # Hồ sơ cá nhân
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── taskService.ts
│   │   │   ├── projectService.ts
│   │   │   ├── kpiService.ts
│   │   │   ├── aiService.ts
│   │   │   └── notificationService.ts
│   │   ├── store/
│   │   │   ├── index.ts             # Redux store
│   │   │   └── slices/authSlice.ts
│   │   ├── types/index.ts           # TypeScript types
│   │   ├── socket.ts                # Socket.io singleton
│   │   ├── App.tsx                  # Router config
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
└── server/                          # Node.js Backend
    ├── prisma/
    │   └── schema.prisma            # Database schema
    ├── src/
    │   ├── config/
    │   │   ├── database.ts          # Prisma client singleton
    │   │   ├── googleAuth.ts        # Passport Google OAuth
    │   │   └── socket.ts            # Socket.io config
    │   ├── controllers/
    │   │   ├── authController.ts
    │   │   ├── projectController.ts
    │   │   ├── taskController.ts    # + Socket events
    │   │   ├── aiController.ts      # Gemini AI
    │   │   ├── kpiController.ts     # + Excel export
    │   │   ├── notificationController.ts
    │   │   └── userController.ts
    │   ├── services/
    │   │   ├── geminiService.ts     # AI: Breakdown/Summary/Risk
    │   │   ├── activityLogService.ts
    │   │   └── notificationService.ts
    │   ├── middlewares/
    │   │   ├── authMiddleware.ts    # JWT + RBAC
    │   │   └── errorHandler.ts
    │   ├── routes/
    │   │   ├── index.ts
    │   │   ├── authRoutes.ts
    │   │   ├── projectRoutes.ts
    │   │   ├── taskRoutes.ts
    │   │   ├── aiRoutes.ts
    │   │   ├── kpiRoutes.ts
    │   │   ├── notificationRoutes.ts
    │   │   └── userRoutes.ts
    │   ├── utils/
    │   │   ├── jwtUtils.ts
    │   │   └── responseHelper.ts
    │   ├── index.ts                 # Shared development/production entry point
    │   └── server.ts                # Express app and Socket.io server
    ├── .env.example
    ├── package.json
    └── tsconfig.json
```

---

## ⚡ Hướng dẫn Cài đặt & Chạy

### Yêu cầu hệ thống
- Node.js >= 18.x
- MySQL >= 8.0
- npm hoặc yarn

### 1. Clone & Cài đặt

```bash
# Cài đặt dependencies backend
cd server
npm install

# Cài đặt dependencies frontend
cd ../client
npm install
```

### 2. Cấu hình môi trường

```bash
# Backend
cd server
copy .env.example .env
# Chỉnh sửa .env với thông tin database, JWT secrets, API keys
```

Điền các giá trị sau vào `.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/chat_ai_kpi_db"
JWT_ACCESS_SECRET=<chuỗi_ngẫu_nhiên_tối_thiểu_32_ký_tự>
JWT_REFRESH_SECRET=<chuỗi_ngẫu_nhiên_tối_thiểu_32_ký_tự>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=<Google_OAuth_Client_ID>
GOOGLE_CLIENT_SECRET=<Google_OAuth_Client_Secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<Gmail_Address>
SMTP_PASS=<Gmail_App_Password>
SMTP_FROM="TaskFlow AI <Gmail_Address>"
GEMINI_API_KEY=<Google_AI_Studio_API_Key>
CLIENT_URL=http://localhost:5173
```

Trong Google Cloud Console, thêm `http://localhost:5000/api/auth/google/callback` vào **Authorized redirect URIs** của OAuth client. Với Gmail, bật xác minh 2 bước và dùng **App Password** cho `SMTP_PASS` (không dùng mật khẩu đăng nhập Gmail). Không đưa thông tin xác thực thật vào `.env.example` hoặc Git.

```bash
# Client — tạo file .env
cd client
echo "VITE_API_URL=http://localhost:5000/api" > .env
echo "VITE_GOOGLE_CLIENT_ID=<Google_OAuth_Client_ID>" >> .env
echo "VITE_SOCKET_URL=http://localhost:5000" >> .env
```

### 3. Thiết lập Database

```bash
cd server

# Đảm bảo MySQL đã có database chat_ai_kpi_db (CREATE DATABASE chat_ai_kpi_db;)
# Tạo Prisma Client và chạy migrations
npx prisma generate
npx prisma migrate dev --name init

# (Tùy chọn) Mở Prisma Studio để xem dữ liệu
npx prisma studio
```

### 4. Chạy ứng dụng

```bash
# Terminal 1 — Backend
cd server
npm run dev
# Server chạy tại http://localhost:5000

# Terminal 2 — Frontend
cd client
npm run dev
# App chạy tại http://localhost:5173
```

---

## 🔑 API Endpoints

### Authentication
| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/auth/register` | Đăng ký tài khoản | ❌ |
| POST | `/api/auth/verify-email` | Xác nhận OTP đăng ký và kích hoạt tài khoản | ❌ |
| POST | `/api/auth/resend-verification` | Gửi lại OTP xác nhận | ❌ |
| POST | `/api/auth/login` | Đăng nhập | ❌ |
| POST | `/api/auth/forgot-password` | Gửi OTP khôi phục mật khẩu | ❌ |
| POST | `/api/auth/reset-password` | Đặt mật khẩu mới bằng OTP | ❌ |
| GET | `/api/auth/google` | Khởi tạo Google OAuth | ❌ |
| GET | `/api/auth/google/callback` | Google OAuth callback | ❌ |
| POST | `/api/auth/refresh-token` | Làm mới access token | ❌ |
| GET | `/api/auth/me` | Lấy thông tin user | ✅ |
| PUT | `/api/auth/profile` | Cập nhật hồ sơ | ✅ |
| PUT | `/api/auth/change-password` | Đổi mật khẩu | ✅ |

### Projects
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects` | Danh sách dự án |
| POST | `/api/projects` | Tạo dự án mới |
| GET | `/api/projects/:id` | Chi tiết dự án |
| PUT | `/api/projects/:id` | Cập nhật dự án |
| DELETE | `/api/projects/:id` | Xóa dự án |
| POST | `/api/projects/:id/members` | Thêm thành viên |
| GET | `/api/projects/:id/stats` | Thống kê dự án |

### Tasks
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks/project/:projectId` | Tasks theo dự án |
| POST | `/api/tasks` | Tạo task mới |
| PATCH | `/api/tasks/:id/status` | Cập nhật trạng thái (Kanban) |
| POST | `/api/tasks/:id/comments` | Thêm bình luận |
| POST | `/api/tasks/:id/subtasks` | Thêm sub-task |

### AI Assistant
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/ai/breakdown` | Phân tách task tự động |
| POST | `/api/ai/summary` | Tóm tắt tiến độ dự án |
| POST | `/api/ai/risks` | Phát hiện rủi ro |
| POST | `/api/ai/search` | Tìm kiếm ngôn ngữ tự nhiên |

### KPI
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/kpi/calculate` | Tính KPI tháng |
| GET | `/api/kpi/dashboard` | Dashboard KPI |
| GET | `/api/kpi/leaderboard` | Bảng xếp hạng |
| GET | `/api/kpi/export` | Xuất Excel |

---

## 🎯 Tính năng Nổi bật

### 1. 🎉 Gamification — Confetti khi hoàn thành Task
Khi kéo task sang cột "Done" trên Kanban, hệ thống sẽ:
- Bắn hiệu ứng pháo hoa `canvas-confetti` với màu xanh-tím-vàng
- Hiển thị toast "Tuyệt vời! Task đã hoàn thành! 🎉"
- Cộng điểm KPI tạm thời cho nhân viên
- Bắn Socket event `task:completed` đến đúng user

### 2. 🤖 AI Smart Features (Google Gemini 1.5 Flash)
- **Task Breakdown**: Nhập mô tả -> AI sinh ≤8 sub-tasks có ước tính giờ
- **Progress Summary**: Phân tích tự động -> Báo cáo Markdown chuyên nghiệp (Tổng quan, Điểm mạnh, Điểm yếu, Khuyến nghị)
- **Risk Warning**: Quét toàn bộ dự án -> Cảnh báo CRITICAL/HIGH/MEDIUM/LOW
- **Natural Language Search**: "Tìm task trễ hạn của Tuấn" -> Query structured

### 3. 📡 Realtime Activity Feed
- Panel bên phải màn hình hiển thị ai đang làm gì
- Socket.io events: task:created, task:updated, task:completed, task:deleted
- Framer Motion AnimatePresence slide in/out

### 4. 📊 KPI Dashboard
- Công thức: `Điểm = (Hoàn thành × 10) + (Đúng hạn/Hoàn thành × 50) + Bonus`
- Xếp loại: A (≥80), B (60-79), C (40-59), D (<40)
- Xuất Excel 2 sheets: Tổng hợp + Chi tiết

---

## 🔒 Bảo mật

- **JWT**: Access Token (15 phút) + Refresh Token (7 ngày)
- **RBAC**: Admin > Manager > Employee
- **Bcrypt**: Salt rounds = 12
- **Helmet**: HTTP security headers
- **CORS**: Whitelist chỉ frontend URL
- **Input Validation**: express-validator

---

## 👨‍💻 Thông tin Sinh viên

| Thông tin | Giá trị |
|-----------|---------|
| **Họ và tên** | Dương Chí Dư |
| **MSSV** | 2310900022 |
| **Lớp** | K23CNT2 |
| **Ngành** | Công nghệ Thông tin |
| **Đề tài** | Xây dựng hệ thống quản lý công việc và đánh giá hiệu suất nhân sự tích hợp Trợ lý Trí tuệ nhân tạo (AI Assistant) |

---

*Phát triển với ❤️ sử dụng React, Node.js, Prisma, Socket.io & Google Gemini AI*
