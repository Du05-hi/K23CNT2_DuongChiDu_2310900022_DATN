import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createUser,
  updateUserDepartment,
  resetUserPassword,
  getDashboardStats,
  getRoleDashboard,
  getAuditLogs,
  getSystemHealth,
} from '../controllers/userController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

// Role Dashboard
router.get('/role-dashboard', getRoleDashboard);

// 1. Quản lý phòng ban (Departments)
router.get('/departments', getDepartments);
router.post('/departments', authorizeRoles('ADMIN'), createDepartment);
router.put('/departments/:id', authorizeRoles('ADMIN'), updateDepartment);
router.delete('/departments/:id', authorizeRoles('ADMIN'), deleteDepartment);

// 2. Thống kê & Kiểm toán hệ thống (Admin only)
router.get('/dashboard-stats', authorizeRoles('ADMIN'), getDashboardStats);
router.get('/audit-logs', authorizeRoles('ADMIN'), getAuditLogs);
router.get('/system-health', authorizeRoles('ADMIN'), getSystemHealth);

// 3. Danh sách người dùng & Tạo người dùng mới
router.get('/', authorizeRoles('ADMIN', 'MANAGER'), getAllUsers);
router.post('/', authorizeRoles('ADMIN'), createUser);

// 4. Quản lý quyền hạn, phòng ban, mật khẩu, và trạng thái kích hoạt (Admin Only)
router.put('/:id/role', authorizeRoles('ADMIN'), updateUserRole);
router.put('/:id/department', authorizeRoles('ADMIN'), updateUserDepartment);
router.put('/:id/reset-password', authorizeRoles('ADMIN'), resetUserPassword);
router.put('/:id/status', authorizeRoles('ADMIN'), toggleUserStatus);

// 5. Chi tiết người dùng (Phải đặt sau các specific routes)
router.get('/:id', getUserById);

export default router;
