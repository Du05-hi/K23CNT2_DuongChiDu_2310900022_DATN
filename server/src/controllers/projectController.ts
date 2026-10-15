import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';
import { createNotification, sendRealtimeNotification } from '../services/notificationService';
import { canAccessProject, canManageProject } from '../utils/projectAccess';

/**
 * 1. Tạo project mới, tự động add creator làm member với role PROJECT_MANAGER
 */
export const createProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { name, description, startDate, endDate, departmentId, status, memberIds } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ success: false, message: 'Tên dự án là bắt buộc.' });
      return;
    }

    if (memberIds !== undefined && (
      !Array.isArray(memberIds) ||
      memberIds.some((memberId: unknown) => typeof memberId !== 'string')
    )) {
      res.status(400).json({ success: false, message: 'Danh sách thành viên không hợp lệ.' });
      return;
    }

    const selectedDepartmentId = req.user?.role === 'MANAGER'
      ? req.user.departmentId || null
      : departmentId || null;

    if (
      req.user?.role === 'MANAGER' &&
      departmentId &&
      departmentId !== req.user.departmentId
    ) {
      res.status(403).json({ success: false, message: 'Quản lý chỉ có thể tạo dự án trong phòng ban của mình.' });
      return;
    }

    const selectedMemberIds = memberIds === undefined
      ? []
      : [...new Set(memberIds as string[])].filter((memberId) => memberId !== userId);
    if (selectedMemberIds.length > 0) {
      if (req.user?.role === 'MANAGER' && !selectedDepartmentId) {
        res.status(400).json({
          success: false,
          message: 'Tài khoản Quản lý cần thuộc một phòng ban để thêm thành viên vào dự án.',
        });
        return;
      }

      const eligibleMembers = await prisma.user.findMany({
        where: {
          id: { in: selectedMemberIds },
          ...(selectedDepartmentId ? { departmentId: selectedDepartmentId } : {}),
          role: { in: ['MANAGER', 'EMPLOYEE'] },
          isActive: true,
        },
        select: { id: true },
      });
      if (eligibleMembers.length !== selectedMemberIds.length) {
        res.status(400).json({
          success: false,
          message: selectedDepartmentId
            ? 'Thành viên được chọn phải là nhân sự đang hoạt động thuộc phòng ban dự án.'
            : 'Thành viên được chọn phải là Quản lý hoặc Nhân viên đang hoạt động.',
        });
        return;
      }
    }

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: name.trim(),
          description: description || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          departmentId: selectedDepartmentId,
          status: status || 'PLANNING',
          createdById: userId,
        },
      });

      // Tự động thêm người tạo làm thành viên quản lý dự án (PROJECT_MANAGER)
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: userId,
          role: 'PROJECT_MANAGER',
        },
      });
      if (selectedMemberIds.length > 0) {
        await tx.projectMember.createMany({
          data: selectedMemberIds.map((memberId) => ({
            projectId: newProject.id,
            userId: memberId,
            role: 'MEMBER' as const,
          })),
        });
      }

      return newProject;
    });

    // Ghi nhận Activity Log
    await logActivity({
      userId,
      action: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      entityId: project.id,
      description: `Đã khởi tạo dự án mới: "${project.name}"`,
      metadata: { projectId: project.id, projectName: project.name },
    });

    const projectWithDetails = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        department: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true },
            },
          },
        },
      },
    });

    req.app.get('io')?.emit('projects:changed');

    res.status(201).json({
      success: true,
      message: 'Khởi tạo dự án thành công!',
      data: projectWithDetails,
    });
  } catch (error: any) {
    console.error('Lỗi createProject:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo dự án.',
      error: error.message,
    });
  }
};

/**
 * 2. Lấy danh sách projects theo phân quyền (Role-based Access Control):
 * - ADMIN: xem toàn bộ các dự án
 * - MANAGER: xem các dự án thuộc phòng ban mình quản lý hoặc dự án mình tham gia
 * - EMPLOYEE: chỉ xem dự án mình tạo, tham gia hoặc được giao công việc
 */
export const getAllProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { status, search, departmentId } = req.query;

    const whereClause: any = {};

    if (status) {
      whereClause.status = status as any;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { description: { contains: String(search) } },
      ];
    }

    if (departmentId) {
      whereClause.departmentId = String(departmentId);
    }

    // Phân quyền theo Role
    if (user.role === 'ADMIN') {
      // ADMIN thấy tất cả
    } else if (user.role === 'MANAGER') {
      // MANAGER thấy projects trong phòng ban của mình HOẶC projects mình tham gia/tạo
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            user.departmentId ? { departmentId: user.departmentId } : undefined,
            { createdById: user.id },
            { members: { some: { userId: user.id } } },
          ].filter(Boolean),
        },
      ];
    } else {
      // EMPLOYEE chỉ thấy dự án mình là member hoặc creator
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { createdById: user.id },
            { members: { some: { userId: user.id } } },
            { tasks: { some: { assigneeId: user.id } } },
          ],
        },
      ];
    }

    const projectRecords = await prisma.project.findMany({
      where: whereClause,
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        department: {
          select: { id: true, name: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
        tasks: { select: { status: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const projects = projectRecords.map(({ tasks, ...project }) => ({
      ...project,
      taskCount: {
        total: tasks.length,
        completed: tasks.filter((task) => task.status === 'DONE').length,
        inProgress: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
        todo: tasks.filter((task) => task.status === 'TODO').length,
        review: tasks.filter((task) => task.status === 'REVIEW').length,
      },
    }));

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error: any) {
    console.error('Lỗi getAllProjects:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách dự án.',
      error: error.message,
    });
  }
};

/**
 * 3. Lấy chi tiết project kèm members, tasks summary
 */
export const getProjectById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        department: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            estimatedHours: true,
            actualHours: true,
            assignee: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!project) {
      res.status(404).json({ success: false, message: 'Dự án không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, id))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem dự án này.' });
      return;
    }

    // Thống kê nhanh số lượng task
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === 'DONE').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        ...project,
        stats: {
          totalTasks,
          completedTasks,
          progress,
        },
      },
    });
  } catch (error: any) {
    console.error('Lỗi getProjectById:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy thông tin chi tiết dự án.',
      error: error.message,
    });
  }
};

/**
 * 4. Cập nhật thông tin dự án
 */
export const updateProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { name, description, status, startDate, endDate, departmentId } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      res.status(404).json({ success: false, message: 'Dự án không tồn tại.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, id))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý dự án này.' });
      return;
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        departmentId: departmentId !== undefined ? departmentId : undefined,
      },
      include: {
        department: true,
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    req.app.get('io')?.emit('projects:changed');

    if (userId) {
      await logActivity({
        userId,
        action: 'PROJECT_UPDATED',
        entityType: 'PROJECT',
        entityId: id,
        description: `Cập nhật thông tin dự án "${updatedProject.name}"`,
        metadata: { projectId: id, status: updatedProject.status },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật dự án thành công!',
      data: updatedProject,
    });
  } catch (error: any) {
    console.error('Lỗi updateProject:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật dự án.',
      error: error.message,
    });
  }
};

/**
 * 5. Xóa vĩnh viễn dự án cùng các công việc và thành viên liên quan
 */
export const deleteProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      res.status(404).json({ success: false, message: 'Dự án không tồn tại.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, id))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý dự án này.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { projectId: id } });
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });

    req.app.get('io')?.emit('projects:changed');

    if (userId) {
      await logActivity({
        userId,
        action: 'PROJECT_DELETED',
        entityType: 'PROJECT',
        entityId: id,
        description: `Đã xóa vĩnh viễn dự án "${existingProject.name}"`,
        metadata: { projectId: id },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã xóa dự án và các công việc liên quan thành công!',
    });
  } catch (error: any) {
    console.error('Lỗi deleteProject:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa dự án.',
      error: error.message,
    });
  }
};

/**
 * 6. Thêm thành viên vào dự án
 */
export const addMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { userId, role } = req.body;
    const currentUserId = req.user?.id;

    if (!userId) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp ID người dùng cần thêm.' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({ success: false, message: 'Dự án không tồn tại.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý thành viên dự án này.' });
      return;
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existingMember) {
      res.status(409).json({ success: false, message: 'Người dùng này đã là thành viên của dự án.' });
      return;
    }

    const newMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: role || 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
      },
    });

    // Gửi thông báo cho thành viên mới
    const notif = await createNotification({
      userId,
      type: 'PROJECT_INVITATION',
      title: 'Tham gia dự án mới',
      message: `Bạn vừa được thêm vào dự án "${project.name}" với vai trò ${role || 'MEMBER'}.`,
      relatedId: projectId,
    });

    const io = req.app.get('io');
    sendRealtimeNotification(io, userId, notif);

    if (currentUserId) {
      await logActivity({
        userId: currentUserId,
        action: 'PROJECT_MEMBER_ADDED',
        entityType: 'PROJECT',
        entityId: projectId,
        description: `Thêm thành viên ${newMember.user.name} vào dự án "${project.name}"`,
        metadata: { projectId, targetUserId: userId, memberRole: role },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Đã thêm thành viên vào dự án thành công!',
      data: newMember,
    });
  } catch (error: any) {
    console.error('Lỗi addMember:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thêm thành viên vào dự án.',
      error: error.message,
    });
  }
};

/**
 * 7. Xóa thành viên khỏi dự án
 */
export const removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: projectId, userId } = req.params;
    const currentUserId = req.user?.id;

    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!existingMember) {
      res.status(404).json({ success: false, message: 'Thành viên không thuộc dự án này.' });
      return;
    }
    if (!req.user || !(await canManageProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý thành viên dự án này.' });
      return;
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (currentUserId) {
      await logActivity({
        userId: currentUserId,
        action: 'PROJECT_MEMBER_REMOVED',
        entityType: 'PROJECT',
        entityId: projectId,
        description: `Đã xóa thành viên khỏi dự án`,
        metadata: { projectId, removedUserId: userId },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã xóa thành viên khỏi dự án thành công!',
    });
  } catch (error: any) {
    console.error('Lỗi removeMember:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa thành viên khỏi dự án.',
      error: error.message,
    });
  }
};

/**
 * 8. Thống kê tasks theo status, progress percentage
 */
export const getProjectStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      res.status(404).json({ success: false, message: 'Dự án không tồn tại.' });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem thống kê dự án này.' });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        actualHours: true,
      },
    });

    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === 'TODO').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const review = tasks.filter((t) => t.status === 'REVIEW').length;
    const done = tasks.filter((t) => t.status === 'DONE').length;

    const now = new Date();
    const overdue = tasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now
    ).length;

    const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActual = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

    const progressPercentage = total > 0 ? Math.round((done / total) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        totalTasks: total,
        byStatus: {
          TODO: todo,
          IN_PROGRESS: inProgress,
          REVIEW: review,
          DONE: done,
        },
        overdueTasks: overdue,
        progressPercentage,
        totalEstimatedHours: totalEstimated,
        totalActualHours: totalActual,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getProjectStats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy thống kê dự án.',
      error: error.message,
    });
  }
};
