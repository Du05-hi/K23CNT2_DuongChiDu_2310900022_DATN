import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';
import { createNotification, sendRealtimeNotification } from '../services/notificationService';

/**
 * Lấy toàn bộ sự kiện và công việc trên lịch biểu (Calendar Matrix)
 * Bao gồm cả dự án và nhiệm vụ liên quan đến người dùng hoặc toàn công ty
 */
export const getCalendarEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { month, year } = req.query;
    const now = new Date();

    // 1. Lọc Dự Án: Người dùng là thành viên, người tạo, hoặc quyền ADMIN/MANAGER
    // TUYỆT ĐỐI LOẠI TRỪ dự án cá nhân & lịch hẹn khỏi danh sách Project trên Lịch biểu
    const excludePersonalCondition = {
      NOT: {
        name: 'Công việc cá nhân & Lịch hẹn',
      },
    };

    let projectWhere: any = {};
    if (user.role === 'ADMIN') {
      projectWhere = { ...excludePersonalCondition };
    } else if (user.role === 'MANAGER') {
      projectWhere = {
        AND: [
          excludePersonalCondition,
          {
            OR: [
              { createdById: user.id },
              { members: { some: { userId: user.id } } },
              ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
            ],
          },
        ],
      };
    } else {
      // EMPLOYEE: tham gia làm thành viên hoặc người tạo
      projectWhere = {
        AND: [
          excludePersonalCondition,
          {
            OR: [
              { members: { some: { userId: user.id } } },
              { createdById: user.id },
            ],
          },
        ],
      };
    }

    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        department: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    // 2. Lọc Nhiệm Vụ: ĐẢM BẢO KHÔNG BỊ CHẶN BỞI BẤT KỲ ĐIỀU KIỆN LỌC PHÒNG BAN HAY DỰ ÁN NÀO đối với task do chính user tạo hoặc được giao
    let taskWhere: any = {};
    if (user.role === 'ADMIN') {
      taskWhere = {};
    } else if (user.role === 'MANAGER') {
      taskWhere = {
        OR: [
          { createdById: user.id },
          { assigneeId: user.id },
          { project: { createdById: user.id } },
          { project: { members: { some: { userId: user.id } } } },
          ...(user.departmentId ? [{ project: { departmentId: user.departmentId } }] : []),
        ],
      };
    } else {
      taskWhere = {
        OR: [
          { createdById: user.id },
          { assigneeId: user.id },
          { project: { createdById: user.id } },
          { project: { members: { some: { userId: user.id } } } },
        ],
      };
    }

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Định dạng danh sách dự án
    const formattedProjects = projects.map((p) => {
      const date = p.endDate || p.startDate || p.createdAt;
      const isoEndDate = p.endDate ? p.endDate.toISOString() : date.toISOString();
      const isoStartDate = p.startDate ? p.startDate.toISOString() : null;
      return {
        id: p.id,
        name: p.name,
        startDate: isoStartDate,
        endDate: isoEndDate,
        deadline: isoEndDate,
        status: p.status,
        departmentName: p.department?.name || 'Toàn công ty',
        creatorName: p.creator?.name,
      };
    });

    // Định dạng danh sách nhiệm vụ và gắn cờ cảnh báo
    const nowMs = now.getTime();
    const formattedTasks = tasks.map((t) => {
      const effectiveDueDate = t.dueDate || t.updatedAt || t.createdAt;
      const isoDueDate = effectiveDueDate.toISOString();
      const dueMs = new Date(effectiveDueDate).getTime();
      const diffMs = dueMs - nowMs;

      // Sắp đến hạn trong 60 phút
      const isDueSoon = t.status !== 'DONE' && diffMs > 0 && diffMs <= 60 * 60 * 1000;
      // Đã quá hạn
      const isOverdue = t.status !== 'DONE' && diffMs < 0;

      const isPersonal =
        !t.projectId ||
        t.project?.name?.toLowerCase().includes('cá nhân') ||
        t.project?.name?.toLowerCase().includes('lịch hẹn');

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: isoDueDate,
        deadline: isoDueDate,
        status: t.status,
        priority: t.priority,
        projectId: t.projectId,
        projectName: t.project?.name || 'Việc cá nhân & Lịch hẹn',
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.name || (t.assigneeId === user.id ? user.name : 'Chưa giao'),
        assigneeAvatar: t.assignee?.avatar,
        isPersonal,
        isDueSoon,
        isOverdue,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        projects: formattedProjects,
        tasks: formattedTasks,
        totalProjects: formattedProjects.length,
        totalTasks: formattedTasks.length,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getCalendarEvents:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy dữ liệu lịch làm việc.',
      error: error.message,
    });
  }
};

/**
 * Thêm công việc hoặc lịch hẹn trực tiếp từ giao diện Lịch
 * Tự động tạo / gán vào Dự án Cá Nhân nếu người dùng chọn "Việc cá nhân / Ghi chú lịch"
 */
export const createQuickCalendarTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { title, date, time, dueDate: rawDueDate, deadline, projectId, priority, description } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề công việc / sự kiện.' });
      return;
    }

    // 1. Tính toán deadline chuẩn xác đến Giờ và Phút:
    // TUYỆT ĐỐI KHÔNG gán nhầm thành năm 2027 (31/12/2027), lưu chính xác thời gian Frontend gửi lên.
    let finalDueDate: Date;
    const inputDue = deadline || rawDueDate;
    if (inputDue) {
      finalDueDate = new Date(inputDue);
    } else if (date) {
      const timeStr = time && typeof time === 'string' && time.trim() ? time.trim() : '17:30';
      const [h, m] = timeStr.split(':').map((num) => parseInt(num, 10) || 0);
      const dateParts = typeof date === 'string' ? date.split('-').map((num) => parseInt(num, 10)) : [];
      if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
        finalDueDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], h, m, 0, 0);
      } else {
        const parsedDate = new Date(date);
        parsedDate.setHours(h, m, 0, 0);
        finalDueDate = parsedDate;
      }
    } else {
      finalDueDate = new Date();
      finalDueDate.setHours(17, 30, 0, 0);
    }

    if (isNaN(finalDueDate.getTime())) {
      finalDueDate = new Date();
    }

    // 2. Xử lý Dự án:
    // TUYỆT ĐỐI KHÔNG TỰ ĐỘNG TẠO DỰ ÁN MỚI mang tên "Công việc cá nhân & Lịch hẹn" mỗi khi người dùng thêm lịch!
    let targetProjectId = projectId;
    const isPersonalChoice = !targetProjectId || targetProjectId === 'PERSONAL' || targetProjectId === '__personal__';

    if (isPersonalChoice) {
      // Tìm duy nhất 1 dự án hệ thống cá nhân đã có sẵn của user
      let personalProject = await prisma.project.findFirst({
        where: {
          createdById: user.id,
          name: 'Công việc cá nhân & Lịch hẹn',
        },
      });

      // Nếu chưa từng có, chỉ tạo DUY NHẤT 1 dự án hệ thống ẩn cho user này
      // TUYỆT ĐỐI KHÔNG gán endDate = 2027! startDate và endDate để null.
      if (!personalProject) {
        personalProject = await prisma.project.create({
          data: {
            name: 'Công việc cá nhân & Lịch hẹn',
            description: 'Lưu trữ các công việc cá nhân, lịch hẹn và ghi chú trên lịch biểu',
            status: 'IN_PROGRESS',
            createdById: user.id,
            startDate: null,
            endDate: null,
            departmentId: user.departmentId || null,
          },
        });
      }
      targetProjectId = personalProject.id;
    } else {
      // Nếu người dùng chọn một Dự án có sẵn: Lưu Task trực tiếp vào dự án đó
      const existingProject = await prisma.project.findUnique({
        where: { id: targetProjectId },
      });
      if (!existingProject) {
        res.status(404).json({ success: false, message: 'Dự án đã chọn không tồn tại.' });
        return;
      }
    }

    // Chuẩn hóa độ ưu tiên
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const finalPriority = validPriorities.includes(priority) ? priority : 'MEDIUM';

    // Tạo Task trong Prisma DB với deadline đúng bằng ngày giờ người dùng đã chọn
    const newTask = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: 'TODO',
        priority: finalPriority,
        dueDate: finalDueDate,
        projectId: targetProjectId,
        assigneeId: user.id,
        createdById: user.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Ghi nhật ký hoạt động
    await logActivity({
      userId: user.id,
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: newTask.id,
      description: `Đã thêm nhanh công việc "${newTask.title}" vào lịch làm việc (Hạn: ${finalDueDate.toISOString()})`,
      metadata: { taskId: newTask.id, projectId: targetProjectId, dueDate: finalDueDate },
    });

    // Bắn thông báo Socket.io
    const io = req.app.get('io');
    if (io) {
      try {
        io.to(`user:${user.id}`).emit('task:created', newTask);
      } catch (err) {
        console.warn('[Socket] Lỗi emit task:created:', err);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Đã thêm công việc vào lịch biểu thành công!',
      data: {
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        dueDate: newTask.dueDate ? newTask.dueDate.toISOString() : null,
        deadline: newTask.dueDate ? newTask.dueDate.toISOString() : null,
        status: newTask.status,
        priority: newTask.priority,
        projectId: newTask.projectId,
        projectName: newTask.project?.name || (isPersonalChoice ? 'Việc cá nhân & Lịch hẹn' : 'Dự án'),
        assigneeId: newTask.assigneeId,
        assigneeName: newTask.assignee?.name || user.name,
        assigneeAvatar: newTask.assignee?.avatar,
        isPersonal: isPersonalChoice,
        isDueSoon: false,
        isOverdue: false,
      },
    });
  } catch (error: any) {
    console.error('Lỗi createQuickCalendarTask:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thêm công việc vào lịch.',
      error: error.message,
    });
  }
};

/**
 * Quét các Task sắp đến hạn (trong 30 - 60 phút) hoặc quá hạn
 * Tự động tạo và gửi thông báo qua chuông Notification & Socket.io
 */
export const getCalendarReminders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();

    // Tìm các task chưa hoàn thành của user hoặc liên quan đến user
    const pendingTasks = await prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        dueDate: { not: null },
        OR: [
          { assigneeId: user.id },
          { createdById: user.id },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const dueSoonTasks: any[] = [];
    const overdueTasks: any[] = [];

    const io = req.app.get('io');

    for (const task of pendingTasks) {
      if (!task.dueDate) continue;
      const dueMs = new Date(task.dueDate).getTime();
      const diffMs = dueMs - nowMs;
      const diffMinutes = Math.round(diffMs / 60000);

      // Sắp đến hạn: từ 0 đến 60 phút
      if (diffMs > 0 && diffMs <= 60 * 60 * 1000) {
        dueSoonTasks.push({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate.toISOString(),
          projectName: task.project?.name,
          diffMinutes,
        });

        // Kiểm tra xem đã gửi thông báo nhắc hẹn trong 60 phút gần đây chưa
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: user.id,
            relatedId: task.id,
            createdAt: { gte: new Date(nowMs - 60 * 60 * 1000) },
          },
        });

        if (!existingNotification) {
          const timeFormatted = new Date(task.dueDate).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const notif = await createNotification({
            userId: user.id,
            type: 'SYSTEM',
            title: '⏰ Nhắc hẹn công việc sắp đến hạn',
            message: `Công việc "${task.title}" sắp đến hạn lúc ${timeFormatted}! Vui lòng kiểm tra và hoàn thành đúng hạn.`,
            relatedId: task.id,
          });
          sendRealtimeNotification(io, user.id, notif);
        }
      } else if (diffMs < 0 && diffMs >= -24 * 60 * 60 * 1000) {
        // Quá hạn trong vòng 24 giờ qua
        overdueTasks.push({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate.toISOString(),
          projectName: task.project?.name,
          overdueMinutes: Math.abs(diffMinutes),
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        dueSoonTasks,
        overdueTasks,
        totalDueSoon: dueSoonTasks.length,
        totalOverdue: overdueTasks.length,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getCalendarReminders:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi quét nhắc hẹn deadline.',
      error: error.message,
    });
  }
};

