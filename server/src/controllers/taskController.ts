import { Response } from 'express';
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

    // Nếu có assignee và không phải chính người tạo, gửi notification
    if (assigneeId && assigneeId !== userId) {
      const notif = await createNotification({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Công việc mới được giao',
        message: `${req.user?.name || 'Một thành viên'} đã giao công việc "${task.title}" cho bạn.`,
        relatedId: task.id,
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
          select: { comments: true, subTasks: true },
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

    const tasks = await prisma.task.findMany({
      where: { assigneeId: userId },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
    });

    res.status(200).json({ success: true, data: tasks });
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

    // Nếu assignee thay đổi
    if (assigneeId && assigneeId !== currentTask.assigneeId && assigneeId !== userId) {
      const notif = await createNotification({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Công việc mới được giao',
        message: `Bạn vừa được giao công việc "${updatedTask.title}".`,
        relatedId: updatedTask.id,
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
 * 6. Xóa task, emit 'task:deleted', tạo activity log
 */
export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) {
      res.status(404).json({ success: false, message: 'Công việc không tồn tại.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, task.projectId))) {
      res.status(403).json({ success: false, message: 'Chỉ quản trị viên hoặc quản lý dự án mới được xóa công việc.' });
      return;
    }

    await prisma.task.delete({
      where: { id },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${task.projectId}`).emit('task:deleted', {
        taskId: id,
        projectId: task.projectId,
      });
    }

    if (userId) {
      await logActivity({
        userId,
        action: 'TASK_DELETED',
        entityType: 'TASK',
        entityId: id,
        description: `Đã xóa công việc "${task.title}" khỏi dự án "${task.project.name}"`,
        metadata: { projectId: task.projectId },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Xóa công việc thành công!',
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
