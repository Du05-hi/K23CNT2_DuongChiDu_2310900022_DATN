import express from 'express';
import {
  getMyPayroll,
  getMyPayrollPdfData,
  getCompanyAnalytics,
  exportProjectWbsExcel,
  exportCompanyPayrollExcel,
  exportTeamProductivityExcel,
  exportAuditLogs,
  getEnterpriseSummary,
  getManagerSummary,
  getProjectWbsVelocity,
  getReportProjects,
  getMyPerformance,
} from '../controllers/reportController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Tất cả các API trong phân hệ Report yêu cầu đăng nhập
router.use(authenticateToken);

// =========================================================
// 1. DÀNH CHO TẤT CẢ CÁC VAI TRÒ (EMPLOYEE, MANAGER, ADMIN)
// =========================================================
// Lấy phiếu lương cá nhân thực tế từ Database (TaskFlow AI 3P)
router.get('/my-payroll', getMyPayroll);

// Lấy dữ liệu chi tiết phiếu lương 3P của user hiện tại để render PDF
router.get('/my-payroll-pdf', getMyPayrollPdfData);

// Thẻ tổng hợp hiệu suất cá nhân tháng và lịch sử phiếu lương
router.get('/my-performance', getMyPerformance);

// =========================================================
// 2. DÀNH CHO QUẢN LÝ DỰ ÁN (MANAGER) & ADMIN
// =========================================================
// Báo Cáo Tổng Hợp Toàn Doanh Nghiệp Cho Admin & Manager
router.get('/company-analytics', authorizeRoles('ADMIN', 'MANAGER'), getCompanyAnalytics);

// Dữ liệu tiến độ và giờ công nhóm (Team Velocity & WBS)
router.get('/projects/:projectId/wbs-velocity', authorizeRoles('ADMIN', 'MANAGER'), getProjectWbsVelocity);
router.get('/projects/:id/wbs', authorizeRoles('ADMIN', 'MANAGER'), getProjectWbsVelocity);
router.get('/manager-summary', authorizeRoles('ADMIN', 'MANAGER'), getProjectWbsVelocity);
router.get('/project-wbs-velocity', authorizeRoles('ADMIN', 'MANAGER'), getProjectWbsVelocity);

// Danh sách dự án cho Dropdown & Báo cáo chi tiết WBS
router.get('/projects', authorizeRoles('ADMIN', 'MANAGER', 'EMPLOYEE'), getReportProjects);

// Xuất file Excel tiến độ WBS dự án (.xlsx)
router.get('/projects/:projectId/export-excel', authorizeRoles('ADMIN', 'MANAGER'), exportProjectWbsExcel);
router.get('/projects/:id/export-excel', authorizeRoles('ADMIN', 'MANAGER'), exportProjectWbsExcel);

// Xuất báo cáo năng suất nhóm ra file Excel (.xlsx)
router.get('/team-productivity-excel', authorizeRoles('ADMIN', 'MANAGER'), exportTeamProductivityExcel);

// =========================================================
// 3. DÀNH RIÊNG CHO QUẢN TRỊ VIÊN (ADMIN) & MANAGER
// =========================================================
// Bộ chỉ số toàn doanh nghiệp (Enterprise Analytics)
router.get('/enterprise-summary', authorizeRoles('ADMIN', 'MANAGER'), getEnterpriseSummary);

// Xuất bảng lương tổng hợp toàn bộ nhân viên ra file Excel (.xlsx)
router.get('/company-payroll-excel', authorizeRoles('ADMIN', 'MANAGER'), exportCompanyPayrollExcel);

// Xuất toàn bộ dữ liệu nhật ký kiểm toán hệ thống ra file Excel (.xlsx)
router.get('/audit-logs-export', authorizeRoles('ADMIN'), exportAuditLogs);

export default router;

