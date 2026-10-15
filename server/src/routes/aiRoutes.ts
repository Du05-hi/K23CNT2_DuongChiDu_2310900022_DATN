import express from 'express';
import {
  breakdownTask,
  generateSummary,
  detectRisks,
  searchTasksNL,
} from '../controllers/aiController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

// Tất cả các tiện ích AI đều yêu cầu xác thực
router.use(authenticateToken);

// 1. Phân tách tự động công việc thành sub-tasks
router.post('/breakdown', breakdownTask);

// 2. Nhận xét và phân tích tiến độ dự án
router.post('/summary', generateSummary);

// 3. Dự đoán và phát hiện rủi ro dự án
router.post('/risks', detectRisks);

// 4. Tìm kiếm tác vụ thông minh bằng ngôn ngữ tự nhiên
router.post('/search', searchTasksNL);

export default router;
