import express from 'express';
import {
  breakdownTask,
  generateSummary,
  generateMyWorkInsights,
  detectRisks,
  searchTasksNL,
  chatWithLiveData,
} from '../controllers/aiController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

// Tất cả các tiện ích AI đều yêu cầu xác thực
router.use(authenticateToken);

// 1. Live Data-Aware Chat Assistant
router.post('/chat', chatWithLiveData);
router.post('/query-data', chatWithLiveData);

// 2. Phân tách tự động công việc thành sub-tasks
router.post('/breakdown', breakdownTask);

// 3. Nhận xét và phân tích tiến độ dự án
router.post('/summary', generateSummary);

// Nhận xét công việc cá nhân dựa trên task của người dùng đang đăng nhập
router.post('/my-work', generateMyWorkInsights);

// 4. Dự đoán và phát hiện rủi ro dự án (hỗ trợ cả /risks và /department-risk)
router.post('/risks', detectRisks);
router.post('/department-risk', detectRisks);
router.get('/department-risk', detectRisks);

// 5. Tìm kiếm tác vụ thông minh bằng ngôn ngữ tự nhiên
router.post('/search', searchTasksNL);

export default router;
