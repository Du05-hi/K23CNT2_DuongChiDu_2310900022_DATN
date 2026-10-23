import fs from 'fs';
import path from 'path';
import { NextFunction, Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';
import { createNotification, sendRealtimeNotification } from '../services/notificationService';
import { canAccessProject, canManageProject } from '../utils/projectAccess';

/**
 * Hàm hỗ trợ tính toán cập nhật KPI tạm thời khi một task chuyển sang DONE
 */
async function updateTemporaryKpiOnTaskDone(assigneeId: string, dueDate: Date | null) {
  try {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isOnTime = !dueDate || now <= new Date(dueDate);

    const existingKpi = await prisma.kpiLog.findUnique({
      where: {
        userId_period: {
          userId: assigneeId,
          period,
        },
      },
    });

    const tasksCompleted = (existingKpi?.tasksCompleted || 0) + 1;
    const tasksOnTime = (existingKpi?.tasksOnTime || 0) + (isOnTime ? 1 : 0);
    const onTimeRate = tasksCompleted > 0 ? tasksOnTime / tasksCompleted : 1;
    const totalScore = Math.round((tasksCompleted * 10 + onTimeRate * 50) * 10) / 10;

    let rank = 'C';
    if (totalScore >= 90) rank = 'A';
    else if (totalScore >= 70) rank = 'B';
    else if (totalScore >= 50) rank = 'C';
    else rank = 'D';

    await prisma.kpiLog.upsert({
      where: {
        userId_period: {
          userId: assigneeId,
          period,
        },
      },
      update: {
        tasksCompleted,
        tasksOnTime,
        totalScore,
        rank,
      },
      create: {
        userId: assigneeId,
        period,
        tasksCompleted: 1,
        tasksOnTime: isOnTime ? 1 : 0,
        totalScore,
        rank,
        details: {
          lastUpdatedTaskId: 'auto_increment',
        },
      },
    });
  } catch (err: any) {
    console.error('Lỗi tự động tính KPI tạm khi task hoàn thành:', err?.message || err);
  }
}

/**
 * Tự động đồng bộ thành viên dự án:
 * Nếu nhân viên được giao task (assigneeId) chưa có trong ProjectMember,
 * tự động ghi nhận nhân viên đó là thành viên dự án (role MEMBER).
 */
export async function ensureProjectMember(projectId: string, userId?: string | null): Promise<void> {
  if (!projectId || !userId) return;
  try {
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!existing) {
      await prisma.projectMember.create({
        data: {
          projectId,
          userId,
          role: 'MEMBER',
        },
      });
    }
  } catch (err: any) {
    console.error(`Lỗi tự động đồng bộ thành viên dự án ${projectId} cho user ${userId}:`, err?.message || err);
  }
}

/**
 * 1. Tạo task mới, tính position max+1, emit socket 'task:created', log activity, gửi notification
 */
export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const {
      title,
      description,
      status = 'TODO',
      priority = 'MEDIUM',
      dueDate,
      projectId,
      assigneeId,
      estimatedHours,
    } = req.body;

    if (!title || !projectId) {
      res.status(400).json({ success: false, message: 'Tiêu đề task và ID dự án là bắt buộc.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Chỉ quản trị viên hoặc quản lý dự án mới được tạo công việc.' });
      return;
    }

    // Tính position lớn nhất trong cột status của project đó
    const maxPositionTask = await prisma.task.findFirst({
      where: { projectId, status },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (maxPositionTask?.position ?? -1) + 1;

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        projectId,
        assigneeId: assigneeId || null,
        createdById: userId,
        position,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Realtime socket emit tới room của project
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${projectId}`).emit('task:created', task);
    }

    // Ghi Activity Log
    await logActivity({
      userId,
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: task.id,
      description: `Tạo công việc mới: "${task.title}" trong dự án "${task.project.name}"`,
      metadata: { projectId, taskId: task.id, assigneeId: task.assigneeId },
    });

    // Tự động đồng bộ thành viên dự án nếu task có assignee
    if (assigneeId) {
      await ensureProjectMember(projectId, assigneeId);
    }

    // Nếu có assignee và không phải chính người tạo, gửi notification kèm relatedId projectId:taskId
    if (assigneeId && assigneeId !== userId) {
      const notif = await createNotification({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Công việc mới được giao',
        message: `${req.user?.name || 'Một thành viên'} đã giao công việc "${task.title}" cho bạn.`,
        relatedId: `${projectId}:${task.id}`,
      });
      sendRealtimeNotification(io, assigneeId, notif);
    }

    res.status(201).json({
      success: true,
      message: 'Tạo công việc thành công!',
      data: task,
    });
  } catch (error: any) {
    console.error('Lỗi createTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo công việc.',
      error: error.message,
    });
  }
};

/**
 * 2. Lấy tất cả tasks của project, nhóm theo status cho Kanban view
 */
export const getTasksByProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!req.user || !(await canAccessProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem công việc của dự án này.' });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        subTasks: {
          select: { id: true, title: true, isCompleted: true },
        },
        _count: {
          select: { comments: true, subTasks: true, attachments: true },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    // Nhóm theo các cột Kanban
    const kanban = {
      TODO: tasks.filter((t) => t.status === 'TODO'),
      IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
      REVIEW: tasks.filter((t) => t.status === 'REVIEW'),
      DONE: tasks.filter((t) => t.status === 'DONE'),
    };

    res.status(200).json({
      success: true,
      data: {
        allTasks: tasks,
        kanban,
        total: tasks.length,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getTasksByProject:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách công việc.',
      error: error.message,
    });
  }
};

export const getMyTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const now = new Date();
    const [tasks, kpiLogs] = await Promise.all([
      prisma.task.findMany({
        where: { assigneeId: userId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              description: true,
              startDate: true,
              endDate: true,
            },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          creator: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          subTasks: {
            orderBy: { createdAt: 'asc' },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              attachments: true,
              subTasks: true,
              comments: true,
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.kpiLog.findMany({
        where: { userId },
        orderBy: { period: 'asc' },
        take: 6,
        select: {
          period: true,
          totalScore: true,
          rank: true,
          tasksCompleted: true,
          tasksOnTime: true,
        },
      }),
    ]);

    const statusSummary = {
      TODO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
      overdue: 0,
      upcomingWithin48h: 0,
      total: tasks.length,
    };

    const normalizedTasks = tasks.map((task) => {
      const completedSubTasks = task.subTasks.filter((subTask) => subTask.isCompleted).length;
      const progress = task.subTasks.length > 0
        ? Math.round((completedSubTasks / task.subTasks.length) * 100)
        : task.status === 'DONE'
          ? 100
          : 0;

      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const isOverdue = task.status !== 'DONE' && dueDate && dueDate < now;
      const timeUntilDueHours = dueDate ? (dueDate.getTime() - now.getTime()) / 3600000 : null;
      const isUpcomingDeadline = task.status !== 'DONE' && dueDate && timeUntilDueHours !== null && timeUntilDueHours <= 48 && timeUntilDueHours >= 0;

      if (task.status === 'TODO') statusSummary.TODO += 1;
      if (task.status === 'IN_PROGRESS') statusSummary.IN_PROGRESS += 1;
      if (task.status === 'REVIEW') statusSummary.REVIEW += 1;
      if (task.status === 'DONE') statusSummary.DONE += 1;
      if (isOverdue) statusSummary.overdue += 1;
      if (isUpcomingDeadline) statusSummary.upcomingWithin48h += 1;

      return {
        ...task,
        dueDate: dueDate ? dueDate.toISOString() : null,
        progress,
        isOverdue,
        isUpcomingDeadline,
        attachmentsCount: task._count.attachments,
        subtaskCount: task._count.subTasks,
        completedSubtaskCount: completedSubTasks,
        hoursUntilDue: timeUntilDueHours,
      };
    });

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const currentMonthKpi = kpiLogs.find((entry) => entry.period === currentMonth) ?? kpiLogs[kpiLogs.length - 1] ?? null;

    res.status(200).json({
      success: true,
      data: {
        summary: statusSummary,
        tasks: normalizedTasks,
        kpiHistory: kpiLogs,
        monthlyKpi: currentMonthKpi,
        upcomingDeadlines: normalizedTasks
          .filter((task) => task.isUpcomingDeadline)
          .sort((a, b) => (a.hoursUntilDue ?? Number.MAX_SAFE_INTEGER) - (b.hoursUntilDue ?? Number.MAX_SAFE_INTEGER)),
      },
    });
  } catch (error: any) {
    console.error('Lỗi getMyTasks:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách công việc của bạn.',
      error: error.message,
    });
  }
};

/**
 * 3. Lấy chi tiết task kèm subtasks, comments, author/assignee
 */
export const getTaskById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
        subTasks: {
          orderBy: { createdAt: 'asc' },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem công việc này.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    console.error('Lỗi getTaskById:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy chi tiết công việc.',
      error: error.message,
    });
  }
};

export const authorizeTaskAttachmentAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền đính kèm file vào task này.' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const uploadTaskAttachment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, title: true },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }

    if (!req.user || !(await canAccessProject(req.user, task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền đính kèm file vào task này.' });
      return;
    }

    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      res.status(400).json({ success: false, message: 'Bạn chưa chọn file để upload.' });
      return;
    }

    let attachments;
    try {
      attachments = await prisma.$transaction(
        uploadedFiles.map((file) => {
          const fileUrl = `/uploads/tasks/${path.basename(file.path)}`;

          return prisma.taskAttachment.create({
            data: {
              taskId,
              fileName: file.originalname,
              fileUrl,
              fileType: file.mimetype || 'application/octet-stream',
              fileSize: file.size,
              uploadedById: userId,
            },
          });
        })
      );
    } catch (error) {
      const cleanupResults = await Promise.allSettled(
        uploadedFiles.map((file) => fs.promises.unlink(file.path))
      );
      cleanupResults.forEach((result) => {
        if (result.status === 'rejected' && (result.reason as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error('Không thể dọn file upload sau khi lưu metadata thất bại:', result.reason);
        }
      });
      throw error;
    }

    let activityLogWarning = false;
    try {
      await logActivity({
        userId,
        action: 'TASK_ATTACHMENT_ADDED',
        entityType: 'TASK_ATTACHMENT',
        entityId: taskId,
        description: `Đính kèm ${attachments.length} file vào task "${task.title}"`,
        metadata: { taskId, projectId: task.projectId, attachmentCount: attachments.length },
      });
    } catch (error) {
      activityLogWarning = true;
      console.error('File đã được lưu nhưng không thể ghi activity log:', error);
    }

    const io = req.app.get('io');
    if (io) {
      const attachmentCount = await prisma.taskAttachment.count({ where: { taskId } });
      io.to(`project:${task.projectId}`).emit('attachment_updated', {
        projectId: task.projectId,
        taskId,
        action: 'added',
        attachments,
        attachmentCount,
      });
    }

    res.status(201).json({
      success: true,
      message: activityLogWarning
        ? 'Đã tải file lên nhưng chưa thể ghi nhật ký hoạt động.'
        : 'Upload file thành công!',
      data: attachments,
      ...(activityLogWarning ? { activityLogWarning: true } : {}),
    });
  } catch (error: any) {
    console.error('Lỗi uploadTaskAttachment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi upload file đính kèm.',
      error: error.message,
    });
  }
};

export const deleteTaskAttachment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId, attachmentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: { select: { projectId: true, title: true } } },
    });

    if (!attachment) {
      res.status(404).json({ success: false, message: 'File đính kèm không tồn tại.' });
      return;
    }

    if (attachment.taskId !== taskId) {
      res.status(400).json({ success: false, message: 'File không thuộc task này.' });
      return;
    }

    if (!req.user || !(await canAccessProject(req.user, attachment.task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xóa file đính kèm này.' });
      return;
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } });

    let cleanupWarning = false;
    const filePathOnDisk = path.join(__dirname, '../../uploads/tasks', path.basename(attachment.fileUrl));
    try {
      await fs.promises.unlink(filePathOnDisk);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        cleanupWarning = true;
        console.error('Không thể dọn file đính kèm sau khi xóa metadata:', error);
      }
    }

    let activityLogWarning = false;
    try {
      await logActivity({
        userId,
        action: 'TASK_ATTACHMENT_REMOVED',
        entityType: 'TASK_ATTACHMENT',
        entityId: attachmentId,
        description: `Xóa file "${attachment.fileName}" khỏi task "${attachment.task.title}"`,
        metadata: { taskId, projectId: attachment.task.projectId },
      });
    } catch (error) {
      activityLogWarning = true;
      console.error('Đã xóa file nhưng không thể ghi activity log:', error);
    }

    const io = req.app.get('io');
    if (io) {
      const attachmentCount = await prisma.taskAttachment.count({ where: { taskId } });
      io.to(`project:${attachment.task.projectId}`).emit('attachment_updated', {
        projectId: attachment.task.projectId,
        taskId,
        action: 'removed',
        attachmentId,
        attachmentCount,
      });
    }

    res.status(200).json({
      success: true,
      message: cleanupWarning || activityLogWarning
        ? 'Đã xóa file nhưng có cảnh báo khi dọn bộ nhớ hoặc ghi nhật ký hoạt động.'
        : 'Xóa file đính kèm thành công!',
      ...(cleanupWarning ? { cleanupWarning: true } : {}),
      ...(activityLogWarning ? { activityLogWarning: true } : {}),
    });
  } catch (error: any) {
    console.error('Lỗi deleteTaskAttachment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa file đính kèm.',
      error: error.message,
    });
  }
};

export const getTaskAttachmentContent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: taskId, attachmentId } = req.params;
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: { select: { projectId: true } } },
    });

    if (!attachment || attachment.taskId !== taskId) {
      res.status(404).json({ success: false, message: 'File đính kèm không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, attachment.task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem file đính kèm này.' });
      return;
    }

    const filePathOnDisk = path.join(__dirname, '../../uploads/tasks', path.basename(attachment.fileUrl));
    res.set({
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.type(attachment.fileType);
    res.sendFile(filePathOnDisk, (error) => {
      if (error && !res.headersSent) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          res.status(404).json({ success: false, message: 'Không tìm thấy file trong bộ nhớ.' });
          return;
        }
        console.error('Lỗi đọc file đính kèm:', error);
        res.status(500).json({ success: false, message: 'Không thể đọc file đính kèm.' });
      }
    });
  } catch (error: any) {
    console.error('Lỗi getTaskAttachmentContent:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đọc file đính kèm.',
      error: error.message,
    });
  }
};

/**
 * 4. Cập nhật task đầy đủ, detect status change, tính KPI tạm nếu DONE, emit 'task:updated'
 */
export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assigneeId,
      estimatedHours,
      actualHours,
      position,
    } = req.body;

    const currentTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!currentTask) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, currentTask.projectId))) {
      res.status(403).json({ success: false, message: 'Chỉ quản trị viên hoặc quản lý dự án mới được chỉnh sửa công việc.' });
      return;
    }

    const isStatusChangedToDone = status === 'DONE' && currentTask.status !== 'DONE';

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        priority: priority !== undefined ? priority : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        assigneeId: assigneeId !== undefined ? assigneeId : undefined,
        estimatedHours: estimatedHours !== undefined ? (estimatedHours ? parseFloat(estimatedHours) : null) : undefined,
        actualHours: actualHours !== undefined ? (actualHours ? parseFloat(actualHours) : null) : undefined,
        position: position !== undefined ? parseInt(position, 10) : undefined,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        project: {
          select: { id: true, name: true },
        },
        subTasks: true,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${updatedTask.projectId}`).emit('task_updated', {
        projectId: updatedTask.projectId,
        task: updatedTask,
        movedBy: userId,
      });
      io.to(`project:${updatedTask.projectId}`).emit('task:updated', updatedTask);
    }

    if (userId) {
      await logActivity({
        userId,
        action: 'TASK_UPDATED',
        entityType: 'TASK',
        entityId: id,
        description: `Cập nhật công việc "${updatedTask.title}" (Trạng thái: ${updatedTask.status})`,
        metadata: {
          projectId: updatedTask.projectId,
          oldStatus: currentTask.status,
          newStatus: updatedTask.status,
        },
      });
    }

    // Nếu chuyển sang DONE, cập nhật KPI tạm
    if (isStatusChangedToDone && updatedTask.assigneeId) {
      await updateTemporaryKpiOnTaskDone(updatedTask.assigneeId, updatedTask.dueDate);

      if (io) {
        io.to(`user:${updatedTask.assigneeId}`).emit('task:completed', {
          taskId: updatedTask.id,
          title: updatedTask.title,
          userId: updatedTask.assigneeId,
        });
      }
    }

    // Nếu assignee được cập nhật/thay đổi, tự động đồng bộ thành viên dự án
    if (assigneeId) {
      await ensureProjectMember(updatedTask.projectId, assigneeId);
    }

    // Nếu assignee thay đổi
    if (assigneeId && assigneeId !== currentTask.assigneeId && assigneeId !== userId) {
      const notif = await createNotification({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Công việc mới được giao',
        message: `Bạn vừa được giao công việc "${updatedTask.title}".`,
        relatedId: `${updatedTask.projectId}:${updatedTask.id}`,
      });
      sendRealtimeNotification(io, assigneeId, notif);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật công việc thành công!',
      data: updatedTask,
    });
  } catch (error: any) {
    console.error('Lỗi updateTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật công việc.',
      error: error.message,
    });
  }
};

/**
 * 5. Cập nhật status + position (dành cho Kanban Drag and Drop)
 */
export const updateTaskStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, position } = req.body;
    const userId = req.user?.id;

    if (!status) {
      res.status(400).json({ success: false, message: 'Trạng thái status là bắt buộc.' });
      return;
    }

    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!currentTask) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || (
      !(await canManageProject(req.user, currentTask.projectId))
      && currentTask.assigneeId !== req.user.id
    )) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật trạng thái công việc này.' });
      return;
    }

    const isTransitionToDone = status === 'DONE' && currentTask.status !== 'DONE';

    if (currentTask.assigneeId) {
      void ensureProjectMember(currentTask.projectId, currentTask.assigneeId);
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status,
        position: position !== undefined ? parseInt(position, 10) : currentTask.position,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const io = req.app.get('io');
    if (io) {
      // Bắn socket cho cả room project cập nhật cột Kanban
      io.to(`project:${currentTask.projectId}`).emit('task:status_changed', {
        taskId: id,
        projectId: currentTask.projectId,
        oldStatus: currentTask.status,
        newStatus: status,
        position: updatedTask.position,
        task: updatedTask,
      });

      // Nếu DONE thì emit sự kiện task:completed tới đúng user để trigger Confetti
      if (isTransitionToDone && currentTask.assigneeId) {
        io.to(`user:${currentTask.assigneeId}`).emit('task:completed', {
          taskId: currentTask.id,
          title: currentTask.title,
          userId: currentTask.assigneeId,
        });
      }
    }

    if (userId) {
      await logActivity({
        userId,
        action: 'TASK_STATUS_CHANGED',
        entityType: 'TASK',
        entityId: id,
        description: `Chuyển công việc "${currentTask.title}" từ ${currentTask.status} sang ${status}`,
        metadata: {
          projectId: currentTask.projectId,
          from: currentTask.status,
          to: status,
        },
      });
    }

    if (isTransitionToDone && currentTask.assigneeId) {
      await updateTemporaryKpiOnTaskDone(currentTask.assigneeId, currentTask.dueDate);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái công việc thành công!',
      data: updatedTask,
    });
  } catch (error: any) {
    console.error('Lỗi updateTaskStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật trạng thái công việc.',
      error: error.message,
    });
  }
};

/**
 * 6. Xóa task, dọn dẹp quan hệ và thông báo, phát tín hiệu Socket.io toàn hệ thống
 * Cho phép: Admin, Manager dự án, người tạo task (createdById), hoặc người nhận task (assigneeId)
 */
export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId || !req.user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: true,
          },
        },
        attachments: { select: { fileUrl: true } },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }

    // Kiểm tra quyền xóa: Cho phép Admin, Quản lý dự án, người tạo task hoặc người nhận việc
    const isProjectManager =
      task.project.createdById === userId ||
      (req.user.role === 'MANAGER' && (
        (req.user.departmentId && task.project.departmentId === req.user.departmentId) ||
        (await canManageProject(req.user, task.projectId))
      )) ||
      task.project.members.some((m) => m.userId === userId && m.role === 'PROJECT_MANAGER');

    const canDelete =
      req.user.role === 'ADMIN' ||
      task.createdById === userId ||
      task.assigneeId === userId ||
      isProjectManager;

    if (!canDelete) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa công việc này.',
      });
      return;
    }

    // 1. Dọn dẹp Notification liên quan đến task để chuông không tiếp tục nhắc việc đã xóa
    await prisma.notification.deleteMany({
      where: {
        relatedId: id,
      },
    });

    // 2. Dọn dẹp comment, subTask, attachment records trước khi xóa task
    await prisma.comment.deleteMany({
      where: { taskId: id },
    });
    await prisma.subTask.deleteMany({
      where: { taskId: id },
    });
    await prisma.taskAttachment.deleteMany({
      where: { taskId: id },
    });

    // 3. Xóa chính thức bản ghi Task trong Database
    await prisma.task.delete({
      where: { id },
    });

    // 4. Dọn file đính kèm vật lý trên ổ đĩa
    const cleanupResults = await Promise.allSettled(
      task.attachments.map((attachment) =>
        fs.promises.unlink(
          path.join(__dirname, '../../uploads/tasks', path.basename(attachment.fileUrl))
        )
      )
    );
    const cleanupFailures = cleanupResults.filter(
      (result) => result.status === 'rejected' && (result.reason as NodeJS.ErrnoException).code !== 'ENOENT'
    );
    cleanupFailures.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('Không thể dọn file đính kèm sau khi xóa task:', result.reason);
      }
    });

    // 5. Phát tín hiệu Socket.io toàn hệ thống và trong room dự án
    const io = req.app.get('io');
    if (io) {
      io.emit('task:deleted', { taskId: id, projectId: task.projectId });
      io.emit('calendar:refresh');
      try {
        io.to(`project:${task.projectId}`).emit('task:deleted', {
          taskId: id,
          projectId: task.projectId,
        });
      } catch (err) {
        // silent catch
      }
    }

    let activityLogWarning = false;
    if (userId) {
      try {
        await logActivity({
          userId,
          action: 'TASK_DELETED',
          entityType: 'TASK',
          entityId: id,
          description: `Đã xóa công việc "${task.title}" khỏi dự án "${task.project.name}"`,
          metadata: { projectId: task.projectId },
        });
      } catch (error) {
        activityLogWarning = true;
        console.error('Đã xóa task nhưng không thể ghi activity log:', error);
      }
    }

    res.status(200).json({
      success: true,
      message: cleanupFailures.length > 0 || activityLogWarning
        ? 'Đã xóa công việc nhưng có cảnh báo khi dọn file hoặc ghi nhật ký hoạt động.'
        : 'Xóa công việc thành công!',
      ...(cleanupFailures.length > 0 ? { cleanupWarning: true } : {}),
      ...(activityLogWarning ? { activityLogWarning: true } : {}),
    });
  } catch (error: any) {
    console.error('Lỗi deleteTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa công việc.',
      error: error.message,
    });
  }
};

/**
 * 7. Thêm comment vào task, emit 'task:comment_added', gửi notification
 */
export const addComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực.' });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống.' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền bình luận trong công việc này.' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        taskId,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, email: true },
        },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${task.projectId}`).emit('task:comment_added', {
        taskId,
        comment,
      });
    }

    await logActivity({
      userId,
      action: 'COMMENT_ADDED',
      entityType: 'COMMENT',
      entityId: comment.id,
      description: `Bình luận vào công việc "${task.title}"`,
      metadata: { taskId, projectId: task.projectId },
    });

    // Thông báo cho người được giao việc nếu người comment khác người làm
    if (task.assigneeId && task.assigneeId !== userId) {
      const notif = await createNotification({
        userId: task.assigneeId,
        type: 'COMMENT_ADDED',
        title: 'Bình luận mới trong công việc',
        message: `${req.user?.name || 'Ai đó'} vừa bình luận về công việc "${task.title}".`,
        relatedId: taskId,
      });
      sendRealtimeNotification(io, task.assigneeId, notif);
    }

    res.status(201).json({
      success: true,
      message: 'Thêm bình luận thành công!',
      data: comment,
    });
  } catch (error: any) {
    console.error('Lỗi addComment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thêm bình luận.',
      error: error.message,
    });
  }
};

/**
 * 8. Lấy comments của task
 */
export const getComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId } = req.params;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, task.projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem bình luận của công việc này.' });
      return;
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    console.error('Lỗi getComments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách bình luận.',
      error: error.message,
    });
  }
};

/**
 * 9. Tạo sub-task
 */
export const createSubTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId } = req.params;
    const { title } = req.body;
    const userId = req.user?.id;

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: 'Tiêu đề công việc con là bắt buộc.' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc cha không tồn tại.' });
      return;
    }
    if (!req.user || (
      !(await canManageProject(req.user, task.projectId))
      && task.assigneeId !== req.user.id
    )) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý công việc con này.' });
      return;
    }

    const subTask = await prisma.subTask.create({
      data: {
        title: title.trim(),
        isCompleted: false,
        taskId,
      },
    });

    if (userId) {
      await logActivity({
        userId,
        action: 'SUBTASK_CREATED',
        entityType: 'SUBTASK',
        entityId: subTask.id,
        description: `Tạo công việc con "${subTask.title}" trong task "${task.title}"`,
        metadata: { taskId, projectId: task.projectId },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tạo công việc con thành công!',
      data: subTask,
    });
  } catch (error: any) {
    console.error('Lỗi createSubTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo công việc con.',
      error: error.message,
    });
  }
};

/**
 * 10. Cập nhật sub-task (toggle isCompleted hoặc đổi title)
 */
export const updateSubTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subTaskId } = req.params;
    const { isCompleted, title } = req.body;
    const userId = req.user?.id;

    const existingSubTask = await prisma.subTask.findUnique({
      where: { id: subTaskId },
      include: { task: true },
    });

    if (!existingSubTask) {
      res.status(404).json({ success: false, message: 'Công việc con không tồn tại.' });
      return;
    }
    if (!req.user || (
      !(await canManageProject(req.user, existingSubTask.task.projectId))
      && existingSubTask.task.assigneeId !== req.user.id
    )) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa công việc con này.' });
      return;
    }

    const updatedSubTask = await prisma.subTask.update({
      where: { id: subTaskId },
      data: {
        isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : undefined,
        title: title !== undefined ? title.trim() : undefined,
      },
    });

    if (userId) {
      await logActivity({
        userId,
        action: 'SUBTASK_UPDATED',
        entityType: 'SUBTASK',
        entityId: subTaskId,
        description: `Cập nhật công việc con: "${updatedSubTask.title}" (${updatedSubTask.isCompleted ? 'Đã xong' : 'Chưa xong'})`,
        metadata: { taskId: existingSubTask.taskId, projectId: existingSubTask.task.projectId },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật công việc con thành công!',
      data: updatedSubTask,
    });
  } catch (error: any) {
    console.error('Lỗi updateSubTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật công việc con.',
      error: error.message,
    });
  }
};

/**
 * 11. Xóa sub-task
 */
export const deleteSubTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subTaskId } = req.params;
    const userId = req.user?.id;

    const existingSubTask = await prisma.subTask.findUnique({
      where: { id: subTaskId },
      include: { task: true },
    });

    if (!existingSubTask) {
      res.status(404).json({ success: false, message: 'Công việc con không tồn tại.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, existingSubTask.task.projectId))) {
      res.status(403).json({ success: false, message: 'Chỉ quản trị viên hoặc quản lý dự án mới được xóa công việc con.' });
      return;
    }

    await prisma.subTask.delete({
      where: { id: subTaskId },
    });

    if (userId) {
      await logActivity({
        userId,
        action: 'SUBTASK_DELETED',
        entityType: 'SUBTASK',
        entityId: subTaskId,
        description: `Đã xóa công việc con "${existingSubTask.title}"`,
        metadata: { taskId: existingSubTask.taskId },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Xóa công việc con thành công!',
    });
  } catch (error: any) {
    console.error('Lỗi deleteSubTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa công việc con.',
      error: error.message,
    });
  }
};

/**
 * Cập nhật hạn chót (deadline / dueDate) của công việc (Hỗ trợ kéo thả trên Calendar).
 * PATCH /api/tasks/:id/deadline & PUT /api/tasks/:id/deadline
 */
export const updateTaskDeadline = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { dueDate } = req.body;
    const userId = req.user?.id;

    if (!dueDate) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp hạn chót mới (dueDate).' });
      return;
    }

    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, createdById: true } },
      },
    });

    if (!currentTask) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }

    // Quyền: Admin, Quản lý dự án, Người được giao việc, hoặc Người tạo dự án
    const canManage = req.user ? await canManageProject(req.user, currentTask.projectId) : false;
    const isAssignee = currentTask.assigneeId === userId;
    const isCreator = currentTask.project.createdById === userId;

    if (!canManage && !isAssignee && !isCreator) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền dời hạn chót công việc này.' });
      return;
    }

    const newDueDate = new Date(dueDate);
    if (isNaN(newDueDate.getTime())) {
      res.status(400).json({ success: false, message: 'Định dạng ngày hạn chót không hợp lệ.' });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { dueDate: newDueDate },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${updatedTask.projectId}`).emit('task_updated', {
        projectId: updatedTask.projectId,
        task: updatedTask,
        movedBy: userId,
      });
      io.to(`project:${updatedTask.projectId}`).emit('task:updated', updatedTask);
    }

    if (userId) {
      await logActivity({
        userId,
        action: 'TASK_UPDATED',
        entityType: 'TASK',
        entityId: id,
        description: `Dời hạn chót công việc "${updatedTask.title}" sang ngày ${newDueDate.toLocaleDateString('vi-VN')}`,
        metadata: {
          projectId: updatedTask.projectId,
          oldDueDate: currentTask.dueDate,
          newDueDate: updatedTask.dueDate,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật hạn chót công việc thành công.',
      data: updatedTask,
    });
  } catch (error: any) {
    console.error('Lỗi updateTaskDeadline:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật hạn chót công việc.',
      error: error.message,
    });
  }
};
