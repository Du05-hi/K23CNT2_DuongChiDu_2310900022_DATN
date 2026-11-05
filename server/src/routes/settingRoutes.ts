import express from 'express';
import {
  getSettings,
  getSettingByKey,
  updateSetting,
  batchUpdateSettings,
} from '../controllers/settingController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

// 1. Lấy danh sách toàn bộ cấu hình hệ thống
router.get('/', getSettings);

// 2. Lấy một cấu hình theo Key
router.get('/:key', getSettingByKey);

// 3. Cập nhật một cấu hình (Chỉ ADMIN)
router.put('/:key', authorizeRoles('ADMIN'), updateSetting);

// 4. Cập nhật nhiều cấu hình cùng lúc (Chỉ ADMIN)
router.put('/', authorizeRoles('ADMIN'), batchUpdateSettings);
router.post('/batch', authorizeRoles('ADMIN'), batchUpdateSettings);

export default router;

