import express from 'express';
import authRoutes from './authRoutes';
import projectRoutes from './projectRoutes';
import taskRoutes from './taskRoutes';
import aiRoutes from './aiRoutes';
import kpiRoutes from './kpiRoutes';
import notificationRoutes from './notificationRoutes';
import userRoutes from './userRoutes';
import activityRoutes from './activityRoutes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/ai', aiRoutes);
router.use('/kpi', kpiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/activity', activityRoutes);

export default router;
