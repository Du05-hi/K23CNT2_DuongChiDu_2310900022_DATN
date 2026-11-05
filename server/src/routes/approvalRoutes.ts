import express from 'express';
import {
  getApprovals,
  createApproval,
  reviewApproval,
  cancelApproval,
  batchReviewApprovals,
  analyzeApprovalWithAI,
  deleteApproval,
  getMyTasksForApproval,
} from '../controllers/approvalController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Yêu cầu xác thực toàn bộ phân hệ Phê duyệt & Đề xuất
router.use(authenticateToken);

// 1. Danh sách đề xuất (có lọc theo vai trò và status/type/priority)
router.get('/', getApprovals);

// 2. Danh sách task cá nhân phục vụ chọn khi tạo đề xuất gia hạn
router.get('/my-tasks', getMyTasksForApproval);

// 3. Tạo đề xuất mới
router.post('/', createApproval);

// 4. Phê duyệt / Từ chối hàng loạt (chỉ ADMIN hoặc MANAGER)
router.post('/batch-review', authorizeRoles('ADMIN', 'MANAGER'), batchReviewApprovals);

// 5. Thẩm định tác động và rủi ro đề xuất bằng AI
router.post('/:id/ai-analyze', analyzeApprovalWithAI);

// 6. Phê duyệt hoặc từ chối đề xuất (chỉ ADMIN hoặc MANAGER)
router.patch('/:id/review', authorizeRoles('ADMIN', 'MANAGER'), reviewApproval);

// 7. Hủy yêu cầu dành cho người gửi (khi đơn vẫn ở trạng thái PENDING)
router.patch('/:id/cancel', cancelApproval);

// 8. Hủy hoặc xóa đề xuất
router.delete('/:id', deleteApproval);

export default router;
