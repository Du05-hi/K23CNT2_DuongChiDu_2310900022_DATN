import express from 'express';
import {
  calculateKPI,
  getKpiDashboard,
  getUserKpiHistory,
  getLeaderboard,
  exportKpiExcel,
  getKpiReport,
  getKpiList,
  getMyKpi,
  updateKpiBonus,
  generateAiKpiReview,
} from '../controllers/kpiController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Yêu cầu xác thực tài khoản
router.use(authenticateToken);

// Danh sách điểm KPI đầy đủ toàn bộ nhân sự (GET /api/kpi & GET /api/kpi/report)
router.get('/', getKpiList);
router.get('/report', getKpiList);

// KPI cá nhân của user đang đăng nhập
router.get('/my-kpi', getMyKpi);

// 1. Xem bảng xếp hạng thi đua
router.get('/leaderboard', getLeaderboard);

// 2. Xem Dashboard KPI tổng quan
router.get('/dashboard', getKpiDashboard);

// 3. Xem lịch sử KPI của từng cá nhân
router.get('/user/:userId', getUserKpiHistory);

// 3.1. AI Nhận Xét Hiệu Suất Cá Nhân
router.post('/ai-review', generateAiKpiReview);

// 4. Tính toán KPI chu kỳ (Chỉ dành cho ADMIN & MANAGER)
router.post('/calculate', authorizeRoles('ADMIN', 'MANAGER'), calculateKPI);

// 5. Cập nhật điểm thưởng Manager trực tiếp
router.patch('/bonus', authorizeRoles('ADMIN', 'MANAGER'), updateKpiBonus);
router.patch('/:userId/bonus', authorizeRoles('ADMIN', 'MANAGER'), updateKpiBonus);
router.put('/bonus', authorizeRoles('ADMIN', 'MANAGER'), updateKpiBonus);
router.put('/:userId/bonus', authorizeRoles('ADMIN', 'MANAGER'), updateKpiBonus);

// 6. Xuất báo cáo KPI ra tệp Excel (.xlsx) (Chỉ dành cho ADMIN & MANAGER)
router.get('/export', authorizeRoles('ADMIN', 'MANAGER'), exportKpiExcel);

export default router;
