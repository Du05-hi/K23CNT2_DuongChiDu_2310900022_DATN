import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
  getDepartments,
  createDepartment,
  getDashboardStats,
  getRoleDashboard,
  updateDepartment,
} from '../controllers/userController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.get('/role-dashboard', getRoleDashboard);

// 1. Quản lý phòng ban (Departments)
router.get('/departments', getDepartments);
router.post('/departments', authorizeRoles('ADMIN'), createDepartment);
router.put('/departments/:id', authorizeRoles('ADMIN'), updateDepartment);

// 2. Thống kê tổng quan hệ thống (Admin Dashboard Stats)
router.get('/dashboard-stats', authorizeRoles('ADMIN'), getDashboardStats);

// 3. Danh sách người dùng (Admin & Manager)
router.get('/', authorizeRoles('ADMIN', 'MANAGER'), getAllUsers);

// 4. Chi tiết người dùng
router.get('/:id', getUserById);

// 5. Quản lý quyền hạn và trạng thái kích hoạt tài khoản (Admin Only)
router.put('/:id/role', authorizeRoles('ADMIN'), updateUserRole);
router.put('/:id/status', authorizeRoles('ADMIN'), toggleUserStatus);

export default router;
