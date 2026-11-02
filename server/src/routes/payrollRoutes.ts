import express from 'express';
import {
  getEnterprisePayroll,
  calculateEnterprisePayrollSimulation,
  confirmEnterprisePayroll,
  confirmAllEnterprisePayroll,
  lockPayrollPeriod,
  unlockPayrollPeriod,
} from '../controllers/kpiController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

// GET /api/payroll: Lấy danh sách lương trực tiếp từ DB
router.get('/', getEnterprisePayroll);

// POST /api/payroll/lock-period hoặc /finalize: Chốt lương kỳ
router.post('/lock-period', authorizeRoles('ADMIN', 'MANAGER'), lockPayrollPeriod);
router.post('/finalize', authorizeRoles('ADMIN', 'MANAGER'), lockPayrollPeriod);

// POST /api/payroll/unlock-period: Mở khóa kỳ lương
router.post('/unlock-period', authorizeRoles('ADMIN', 'MANAGER'), unlockPayrollPeriod);

// POST /api/payroll/confirm: Chốt lương từng nhân sự
router.post('/confirm', authorizeRoles('ADMIN', 'MANAGER'), confirmEnterprisePayroll);

// POST /api/payroll/confirm-all: Chốt lương hàng loạt
router.post('/confirm-all', authorizeRoles('ADMIN', 'MANAGER'), confirmAllEnterprisePayroll);

// POST /api/payroll/calculate: Tính toán mô phỏng
router.post('/calculate', calculateEnterprisePayrollSimulation);

export default router;

