import express from 'express';
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  getProjectStats,
} from '../controllers/projectController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Tất cả các routes của project đều yêu cầu người dùng đăng nhập
router.use(authenticateToken);

// 1. Quản lý danh sách & khởi tạo dự án
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), createProject);
router.get('/', getAllProjects);

// 2. Thống kê dự án
router.get('/:id/stats', getProjectStats);

// 3. Chi tiết, chỉnh sửa & lưu trữ (soft delete) dự án
router.get('/:id', getProjectById);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updateProject);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), deleteProject);

// 4. Quản lý thành viên tham gia dự án
router.post('/:id/members', authorizeRoles('ADMIN', 'MANAGER'), addMember);
router.delete('/:id/members/:userId', authorizeRoles('ADMIN', 'MANAGER'), removeMember);

export default router;
