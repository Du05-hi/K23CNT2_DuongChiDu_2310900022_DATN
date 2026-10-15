import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

// 1. Lấy danh sách thông báo & đếm chưa đọc
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

// 2. Đánh dấu tất cả là đã đọc
router.put('/read-all', markAllAsRead);

// 3. Đánh dấu một thông báo cụ thể là đã đọc & Xóa thông báo
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
