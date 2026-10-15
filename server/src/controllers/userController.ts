import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';
import { sendPaginated } from '../utils/responseHelper';

/**
 * 1. Lấy danh sách users với bộ lọc (role, isActive, search name/email) kèm phân trang
 */
export const getAllUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { role, isActive, search, page, limit, departmentId } = req.query;

    const pageNum = Math.max(1, Number.parseInt(String(page || 1), 10) || 1);
    const limitNum = Math.max(1, Number.parseInt(String(limit || 20), 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};

    if (role) {
      whereClause.role = role as any;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (departmentId) {
      whereClause.departmentId = String(departmentId);
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { email: { contains: String(search) } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        take: limitNum,
        skip,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          avatar: true,
          departmentId: true,
          department: {
            select: { id: true, name: true },
          },
          createdAt: true,
          _count: {
            select: {
              assignedTasks: true,
              projectMembers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    sendPaginated(res, users, total, pageNum, limitNum, 'Lấy danh sách người dùng thành công.');
  } catch (error: any) {
    console.error('Lỗi getAllUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách người dùng.',
      error: error.message,
    });
  }
};

/**
 * 2. Lấy thông tin chi tiết một user theo ID
 */
export const getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatar: true,
        departmentId: true,
        department: true,
        createdAt: true,
        updatedAt: true,
        projectMembers: {
          include: {
            project: {
              select: { id: true, name: true, status: true },
            },
          },
        },
        assignedTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        kpiLogs: {
          orderBy: { period: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    console.error('Lỗi getUserById:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy thông tin người dùng.',
      error: error.message,
    });
  }
};

/**
 * 3. Thay đổi vai trò (Role) của người dùng (Admin only)
 */
export const updateUserRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user?.id;

    if (!role || !['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Vai trò (role) không hợp lệ. Phải là ADMIN, MANAGER hoặc EMPLOYEE.',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true, updatedAt: true },
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'USER',
        entityId: id,
        description: `Thay đổi quyền người dùng "${targetUser.name}" từ ${targetUser.role} sang ${role}`,
        metadata: { targetUserId: id, oldRole: targetUser.role, newRole: role },
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã cập nhật vai trò người dùng thành ${role}!`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Lỗi updateUserRole:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật vai trò người dùng.',
      error: error.message,
    });
  }
};

/**
 * 4. Khóa hoặc Mở khóa tài khoản người dùng (Toggle isActive)
 */
export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    // Tránh tự khóa tài khoản của chính mình
    if (adminId === id) {
      res.status(400).json({
        success: false,
        message: 'Bạn không thể tự khóa tài khoản của chính mình.',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    const newStatus = !targetUser.isActive;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: newStatus },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: newStatus ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
        entityType: 'USER',
        entityId: id,
        description: `${newStatus ? 'Mở khóa' : 'Khóa'} tài khoản người dùng "${targetUser.name}"`,
        metadata: { targetUserId: id, status: newStatus },
      });
    }

    res.status(200).json({
      success: true,
      message: `Tài khoản đã được ${newStatus ? 'kích hoạt mở khóa' : 'tạm khóa'} thành công!`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Lỗi toggleUserStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thay đổi trạng thái người dùng.',
      error: error.message,
    });
  }
};

/**
 * 5. Lấy danh sách tất cả các phòng ban
 */
export const getDepartments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error: any) {
    console.error('Lỗi getDepartments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách phòng ban.',
      error: error.message,
    });
  }
};

/**
 * 6. Tạo phòng ban mới
 */
export const createDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const adminId = req.user?.id;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Tên phòng ban là bắt buộc.' });
      return;
    }

    const existing = await prisma.department.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      res.status(409).json({ success: false, message: 'Tên phòng ban này đã tồn tại.' });
      return;
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description || null,
      },
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'DEPARTMENT_CREATED',
        entityType: 'DEPARTMENT',
        entityId: department.id,
        description: `Tạo mới phòng ban "${department.name}"`,
        metadata: { departmentId: department.id },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tạo phòng ban mới thành công!',
      data: department,
    });
  } catch (error: any) {
    console.error('Lỗi createDepartment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo phòng ban.',
      error: error.message,
    });
  }
};

export const updateDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, userIds } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, message: 'Tên phòng ban là bắt buộc.' });
      return;
    }

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Phòng ban không tồn tại.' });
      return;
    }

    const duplicate = await prisma.department.findFirst({
      where: { name: name.trim(), id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      res.status(409).json({ success: false, message: 'Tên phòng ban này đã tồn tại.' });
      return;
    }

    if (userIds !== undefined && (
      !Array.isArray(userIds) ||
      userIds.some((userId: unknown) => typeof userId !== 'string')
    )) {
      res.status(400).json({ success: false, message: 'Danh sách nhân sự không hợp lệ.' });
      return;
    }

    const selectedIds = userIds === undefined ? undefined : [...new Set(userIds as string[])];
    if (selectedIds) {
      const selectedUsers = await prisma.user.findMany({
        where: { id: { in: selectedIds } },
        select: { id: true, role: true },
      });
      if (
        selectedUsers.length !== selectedIds.length ||
        selectedUsers.some((user) => user.role === 'ADMIN')
      ) {
        res.status(400).json({
          success: false,
          message: 'Chỉ có thể gán tài khoản Quản lý hoặc Nhân viên vào phòng ban.',
        });
        return;
      }
    }

    const department = await prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: {
          name: name.trim(),
          description: typeof description === 'string' && description.trim()
            ? description.trim()
            : null,
        },
      });

      if (selectedIds) {
        await tx.user.updateMany({
          where: {
            departmentId: id,
            ...(selectedIds.length > 0 ? { id: { notIn: selectedIds } } : {}),
          },
          data: { departmentId: null },
        });
        if (selectedIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: selectedIds } },
            data: { departmentId: id },
          });
        }
      }

      return updated;
    });

    req.app.get('io')?.emit('projects:changed');

    const adminId = req.user?.id;
    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'DEPARTMENT',
        entityId: id,
        description: `Cập nhật phòng ban "${department.name}"`,
        metadata: { departmentId: id, assignedUserIds: selectedIds },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật phòng ban thành công!',
      data: department,
    });
  } catch (error: any) {
    console.error('Lỗi updateDepartment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật phòng ban.',
      error: error.message,
    });
  }
};

export const getRoleDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const projectScope: any = user.role === 'ADMIN'
      ? {}
      : user.role === 'MANAGER'
      ? { OR: [
          ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
          { createdById: user.id },
          { members: { some: { userId: user.id } } },
        ] }
      : { OR: [{ createdById: user.id }, { members: { some: { userId: user.id } } }] };
    const taskScope: any = user.role === 'ADMIN'
      ? {}
      : user.role === 'MANAGER'
      ? { project: projectScope }
      : { assigneeId: user.id };

    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [projectCount, activeProjectCount, taskGroups, overdue, recentProjects, recentTasks, teamSize, monthlyKpi] =
      await Promise.all([
        prisma.project.count({ where: projectScope }),
        prisma.project.count({ where: { ...projectScope, status: 'IN_PROGRESS' } }),
        prisma.task.groupBy({ by: ['status'], where: taskScope, _count: { status: true } }),
        prisma.task.count({
          where: { ...taskScope, status: { not: 'DONE' }, dueDate: { lt: new Date() } },
        }),
        prisma.project.findMany({
          where: projectScope,
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: { _count: { select: { tasks: true, members: true } } },
        }),
        prisma.task.findMany({
          where: taskScope,
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: 8,
          include: {
            project: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, avatar: true } },
          },
        }),
        user.role === 'MANAGER'
          ? prisma.user.count({
              where: {
                isActive: true,
                OR: [
                  ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
                  { projectMembers: { some: { project: projectScope } } },
                ],
              },
            })
          : Promise.resolve(0),
        prisma.kpiLog.findUnique({
          where: { userId_period: { userId: user.id, period: currentPeriod } },
          select: { totalScore: true, rank: true, tasksCompleted: true, tasksOnTime: true },
        }),
      ]);

    const tasks = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0, total: 0 };
    for (const item of taskGroups) {
      tasks[item.status] = item._count.status;
      tasks.total += item._count.status;
    }

    res.status(200).json({
      success: true,
      data: {
        role: user.role,
        teamSize,
        projects: { total: projectCount, IN_PROGRESS: activeProjectCount },
        tasks: { ...tasks, overdue },
        monthlyKpi,
        recentProjects,
        recentTasks,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getRoleDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy dữ liệu tổng quan.',
      error: error.message,
    });
  }
};

/**
 * 7. Thống kê tổng quan cho Admin Dashboard
 * (total users, active users, projects, tasks, completion rate, departments)
 */
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalDepartments,
      projectsByStatus,
      tasksByStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.project.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.task.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const projectCounts = {
      PLANNING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ARCHIVED: 0,
      total: 0,
    };

    projectsByStatus.forEach((item) => {
      if (item.status in projectCounts) {
        (projectCounts as any)[item.status] = item._count.status;
      }
      projectCounts.total += item._count.status;
    });

    const taskCounts = {
      TODO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
      total: 0,
    };

    tasksByStatus.forEach((item) => {
      if (item.status in taskCounts) {
        (taskCounts as any)[item.status] = item._count.status;
      }
      taskCounts.total += item._count.status;
    });

    const completionRate =
      taskCounts.total > 0
        ? Math.round((taskCounts.DONE / taskCounts.total) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        departments: {
          total: totalDepartments,
        },
        projects: projectCounts,
        tasks: {
          ...taskCounts,
          completionRate,
        },
      },
    });
  } catch (error: any) {
    console.error('Lỗi getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy thống kê dashboard admin.',
      error: error.message,
    });
  }
};
