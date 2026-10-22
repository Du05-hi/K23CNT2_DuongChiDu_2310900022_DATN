import express from 'express';
import {
  getCalendarEvents,
  createQuickCalendarTask,
  getCalendarReminders,
} from '../controllers/calendarController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

// Yêu cầu xác thực tài khoản
router.use(authenticateToken);

// 1. Lấy danh sách sự kiện và hạn chót trên lịch biểu (Hỗ trợ cả GET / và GET /events)
router.get('/', getCalendarEvents);
router.get('/events', getCalendarEvents);

// 2. Thêm nhanh công việc / sự kiện trực tiếp từ lịch
router.post('/quick-task', createQuickCalendarTask);

// 3. Quét và nhắc hẹn các task sắp đến hạn (30 - 60 phút)
router.get('/reminders', getCalendarReminders);

export default router;

