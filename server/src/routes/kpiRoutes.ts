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
  getEnterprisePayroll,
  calculateEnterprisePayrollSimulation,
  confirmEnterprisePayroll,
  confirmAllEnterprisePayroll,
  lockPayrollPeriod,
  unlockPayrollPeriod,
  getEnterpriseWorkflow,
  updateEnterpriseWorkflowStep,
} from '../controllers/kpiController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Yêu cầu xác thực tài khoản cho toàn bộ phân hệ KPI
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

// =========================================================================
// PHÂN HỆ QUẢN TRỊ ĐỊNH MỨC GIỜ CÔNG, LƯƠNG 3P & QUY TRÌNH DUYỆT KPI 7 BƯỚC
// =========================================================================
// Lấy báo cáo định mức giờ công và tính lương doanh nghiệp
router.get('/enterprise-payroll', getEnterprisePayroll);

// Mô phỏng tính lương thực tế với tham số tùy chỉnh
router.post('/enterprise-payroll/calculate', calculateEnterprisePayrollSimulation);

// Xác nhận và chốt lương cho từng nhân sự (Chỉ ADMIN & MANAGER)
router.post('/enterprise-payroll/confirm', authorizeRoles('ADMIN', 'MANAGER'), confirmEnterprisePayroll);

// Xác nhận và chốt lương hàng loạt / khóa kỳ toàn công ty (Chỉ ADMIN & MANAGER)
router.post('/enterprise-payroll/confirm-all', authorizeRoles('ADMIN', 'MANAGER'), confirmAllEnterprisePayroll);
router.post('/enterprise-payroll/lock-period', authorizeRoles('ADMIN', 'MANAGER'), lockPayrollPeriod);
router.post('/payroll/lock-period', authorizeRoles('ADMIN', 'MANAGER'), lockPayrollPeriod);
router.post('/enterprise-payroll/unlock-period', authorizeRoles('ADMIN', 'MANAGER'), unlockPayrollPeriod);
router.post('/payroll/unlock-period', authorizeRoles('ADMIN', 'MANAGER'), unlockPayrollPeriod);

// Lấy trạng thái quy trình phê duyệt 7 bước
router.get('/enterprise-workflow', getEnterpriseWorkflow);

// Cập nhật trạng thái từng bước phê duyệt (Chỉ ADMIN & MANAGER)
router.post('/enterprise-workflow/step', authorizeRoles('ADMIN', 'MANAGER'), updateEnterpriseWorkflowStep);

export default router;
