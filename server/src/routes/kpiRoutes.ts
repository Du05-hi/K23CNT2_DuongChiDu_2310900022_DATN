import express from 'express';
import {
  calculateKPI,
  getKpiDashboard,
  getUserKpiHistory,
  getLeaderboard,
  exportKpiExcel,
  getKpiReport,
} from '../controllers/kpiController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Yêu cầu xác thực tài khoản
router.use(authenticateToken);

router.get('/report', getKpiReport);

// 1. Xem bảng xếp hạng thi đua
router.get('/leaderboard', getLeaderboard);

// 2. Xem Dashboard KPI tổng quan
router.get('/dashboard', getKpiDashboard);

// 3. Xem lịch sử KPI của từng cá nhân
router.get('/user/:userId', getUserKpiHistory);

// 4. Tính toán KPI chu kỳ (Chỉ dành cho ADMIN & MANAGER)
router.post('/calculate', authorizeRoles('ADMIN', 'MANAGER'), calculateKPI);

// 5. Xuất báo cáo KPI ra tệp Excel (.xlsx) (Chỉ dành cho ADMIN & MANAGER)
router.get('/export', authorizeRoles('ADMIN', 'MANAGER'), exportKpiExcel);

export default router;
