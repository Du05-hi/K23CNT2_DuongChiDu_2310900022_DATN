import express from 'express';
import { getRecentActivities } from '../controllers/activityController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticateToken);
router.get('/', getRecentActivities);

export default router;
