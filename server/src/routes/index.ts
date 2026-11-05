import express from 'express';
import authRoutes from './authRoutes';
import projectRoutes from './projectRoutes';
import taskRoutes from './taskRoutes';
import aiRoutes from './aiRoutes';
import kpiRoutes from './kpiRoutes';
import payrollRoutes from './payrollRoutes';
import notificationRoutes from './notificationRoutes';
import userRoutes from './userRoutes';
import activityRoutes from './activityRoutes';
import calendarRoutes from './calendarRoutes';
import approvalRoutes from './approvalRoutes';
import settingRoutes from './settingRoutes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/ai', aiRoutes);
router.use('/kpi', kpiRoutes);
router.use('/payroll', payrollRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/activity', activityRoutes);
router.use('/calendar', calendarRoutes);
router.use('/approvals', approvalRoutes);
router.use('/settings', settingRoutes);

export default router;
