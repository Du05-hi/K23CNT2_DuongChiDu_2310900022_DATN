import { Response } from 'express';
import bcrypt from 'bcryptjs';
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
    const now = new Date();

    const [projectCount, activeProjectCount, taskGroups, overdue, recentProjects, recentTasks, teamSize, monthlyKpi] =
      await Promise.all([
        prisma.project.count({ where: projectScope }),
        prisma.project.count({ where: { ...projectScope, status: 'IN_PROGRESS' } }),
        prisma.task.groupBy({ by: ['status'], where: taskScope, _count: { status: true } }),
        prisma.task.count({
          where: { ...taskScope, status: { not: 'DONE' }, dueDate: { lt: now } },
        }),
        prisma.project.findMany({
          where: projectScope,
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            _count: { select: { tasks: true, members: true } },
            members: {
              select: {
                user: {
                  select: { id: true, name: true, avatar: true },
                },
              },
            },
          },
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

    const allTasks = await prisma.task.findMany({
      where: taskScope,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        updatedAt: true,
        assigneeId: true,
        projectId: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    const projectList = await prisma.project.findMany({
      where: projectScope,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        description: true,
        members: {
          select: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        tasks: {
          select: { id: true, status: true, dueDate: true },
        },
      },
    });

    const projectSummaries = projectList.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((task) => task.status === 'DONE').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const startDate = project.startDate ? new Date(project.startDate) : null;
      const endDate = project.endDate ? new Date(project.endDate) : null;
      const budgetDays = startDate && endDate ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)) : 0;

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        description: project.description,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        budgetDays,
        progress: completionRate,
        members: project.members.map((member) => member.user),
      };
    });

    const teamMembers = user.role === 'MANAGER'
      ? await prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
              { projectMembers: { some: { project: projectScope } } },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            isActive: true,
            department: { select: { id: true, name: true } },
            assignedTasks: {
              select: {
                id: true,
                status: true,
                priority: true,
                dueDate: true,
              },
            },
            kpiLogs: {
              orderBy: { period: 'desc' },
              take: 3,
              select: { totalScore: true },
            },
          },
          orderBy: { name: 'asc' },
        })
      : [];

    const staffPerformance = teamMembers.map((member) => {
      const tasks = member.assignedTasks ?? [];
      const completed = tasks.filter((task) => task.status === 'DONE').length;
      const onTime = tasks.filter((task) => task.status === 'DONE' || !task.dueDate || new Date(task.dueDate) >= now).length;
      const late = tasks.filter((task) => task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < now).length;
      const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      const avgKpi = member.kpiLogs.length > 0
        ? member.kpiLogs.reduce((sum, item) => sum + (item.totalScore ?? 0), 0) / member.kpiLogs.length
        : 0;

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        avatar: member.avatar,
        isActive: member.isActive,
        department: member.department,
        tasksAssigned: tasks.length,
        tasksOnTime: onTime,
        tasksLate: late,
        contributionRate: completionRate,
        kpiScore: Math.round(avgKpi),
      };
    });

    const approvalQueue = await prisma.task.findMany({
      where: { ...taskScope, status: 'REVIEW' },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      take: 8,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    const dueTaskList = allTasks.filter((task) => task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < now);
    const completedTaskList = allTasks.filter((task) => task.status === 'DONE');
    const statusBreakdown = [
      { name: 'TO_DO', value: tasks.TODO, color: '#64748b' },
      { name: 'IN_PROGRESS', value: tasks.IN_PROGRESS, color: '#3b82f6' },
      { name: 'REVIEW', value: tasks.REVIEW, color: '#f59e0b' },
      { name: 'DONE', value: tasks.DONE, color: '#10b981' },
    ];

    const weeklyTrendMap = new Map<string, number>();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 41);
    for (let index = 0; index < 6; index += 1) {
      const current = new Date();
      current.setDate(current.getDate() - (41 - index * 7));
      const label = `${current.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}`;
      weeklyTrendMap.set(label, 0);
    }

    for (const task of allTasks) {
      if (task.status !== 'DONE' || !task.updatedAt) continue;
      const updatedAt = new Date(task.updatedAt);
      if (updatedAt < startDate || updatedAt > now) continue;
      const label = updatedAt.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
      weeklyTrendMap.set(label, (weeklyTrendMap.get(label) ?? 0) + 1);
    }

    const weeklyTrend = Array.from(weeklyTrendMap.entries()).map(([label, value]) => ({
      label,
      completed: value,
    }));

    const normalizeTask = (task: any) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      project: task.project,
      assignee: task.assignee,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      overdueDays: task.dueDate && task.status !== 'DONE'
        ? Math.max(0, Math.ceil((now.getTime() - new Date(task.dueDate).getTime()) / 86400000))
        : 0,
    });

    const overdueTasks = dueTaskList.map(normalizeTask);
    const completedTasks = completedTaskList.map(normalizeTask);

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
        teamMembers: staffPerformance,
        projectList: projectSummaries,
        approvalQueue: approvalQueue.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
          project: task.project,
          assignee: task.assignee,
          creator: task.creator,
        })),
        statusBreakdown,
        weeklyTrend,
        overdueTasks,
        completedTasks,
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

/**
 * 8. Tạo người dùng mới trực tiếp bởi Admin
 */
export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, departmentId } = req.body;
    const adminId = req.user?.id;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ tên, email và mật khẩu.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất 6 ký tự.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email này đã tồn tại trong hệ thống.' });
      return;
    }

    const validRole = ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role) ? role : 'EMPLOYEE';

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        res.status(400).json({ success: false, message: 'Phòng ban được chọn không tồn tại.' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(String(password), 12);

    const newUser = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        password: hashedPassword,
        role: validRole,
        isActive: true,
        departmentId: departmentId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatar: true,
        departmentId: true,
        department: {
          select: { id: true, name: true },
        },
        createdAt: true,
      },
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: newUser.id,
        description: `Quản trị viên tạo tài khoản mới: ${newUser.name} (${newUser.email}) - Vai trò: ${newUser.role}`,
        metadata: { createdUserId: newUser.id, role: newUser.role, departmentId: newUser.departmentId },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản người dùng thành công!',
      data: newUser,
    });
  } catch (error: any) {
    console.error('Lỗi createUser:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo người dùng.',
      error: error.message,
    });
  }
};

/**
 * 9. Cập nhật phòng ban của người dùng (Admin only)
 */
export const updateUserDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { departmentId } = req.body;
    const adminId = req.user?.id;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    let deptName = 'Không thuộc phòng ban';
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        res.status(400).json({ success: false, message: 'Phòng ban không tồn tại.' });
        return;
      }
      deptName = dept.name;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        departmentId: departmentId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatar: true,
        departmentId: true,
        department: {
          select: { id: true, name: true },
        },
        updatedAt: true,
      },
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'USER_DEPARTMENT_CHANGED',
        entityType: 'USER',
        entityId: id,
        description: `Chuyển phòng ban nhân sự "${targetUser.name}" sang "${deptName}"`,
        metadata: {
          targetUserId: id,
          oldDepartment: targetUser.department?.name ?? null,
          newDepartment: deptName,
        },
      });
    }

    req.app.get('io')?.emit('projects:changed');

    res.status(200).json({
      success: true,
      message: `Đã cập nhật phòng ban cho ${targetUser.name}!`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Lỗi updateUserDepartment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật phòng ban người dùng.',
      error: error.message,
    });
  }
};

/**
 * 10. Đặt lại mật khẩu khẩn cấp cho người dùng (Admin only)
 */
export const resetUserPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user?.id;

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có độ dài ít nhất 6 ký tự.',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'USER_PASSWORD_RESET',
        entityType: 'USER',
        entityId: id,
        description: `Đặt lại mật khẩu cho tài khoản "${targetUser.name}" (${targetUser.email})`,
        metadata: { targetUserId: id },
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã đặt lại mật khẩu thành công cho ${targetUser.name}!`,
    });
  } catch (error: any) {
    console.error('Lỗi resetUserPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đặt lại mật khẩu.',
      error: error.message,
    });
  }
};

/**
 * 11. Xóa phòng ban an toàn (Admin only)
 */
export const deleteDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, projects: true },
        },
      },
    });

    if (!department) {
      res.status(404).json({ success: false, message: 'Phòng ban không tồn tại.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Bỏ liên kết nhân sự thuộc phòng ban
      await tx.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
      });

      // Bỏ liên kết dự án thuộc phòng ban
      await tx.project.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
      });

      // Xóa phòng ban
      await tx.department.delete({
        where: { id },
      });
    });

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'DEPARTMENT_DELETED',
        entityType: 'DEPARTMENT',
        entityId: id,
        description: `Xóa phòng ban "${department.name}"`,
        metadata: { departmentName: department.name },
      });
    }

    req.app.get('io')?.emit('projects:changed');

    res.status(200).json({
      success: true,
      message: `Đã xóa phòng ban "${department.name}" thành công!`,
    });
  } catch (error: any) {
    console.error('Lỗi deleteDepartment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa phòng ban.',
      error: error.message,
    });
  }
};

/**
 * 12. Lấy danh sách Audit Logs đầy đủ cho Admin
 */
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, action, entityType, limit = '100', page = '1' } = req.query;

    const pageNum = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(200, Number.parseInt(String(limit), 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (action && action !== 'ALL') {
      where.action = { contains: String(action) };
    }

    if (entityType && entityType !== 'ALL') {
      where.entityType = String(entityType);
    }

    if (search) {
      where.OR = [
        { description: { contains: String(search) } },
        { action: { contains: String(search) } },
        { user: { name: { contains: String(search) } } },
        { user: { email: { contains: String(search) } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        take: limitNum,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    sendPaginated(res, logs, total, pageNum, limitNum, 'Lấy danh sách nhật ký hệ thống thành công.');
  } catch (error: any) {
    console.error('Lỗi getAuditLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy nhật ký kiểm toán.',
      error: error.message,
    });
  }
};

/**
 * 13. Kiểm tra tình trạng Server & Database (Admin Health Metrics)
 */
export const getSystemHealth = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    const memoryUsage = process.memoryUsage();
    const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    const io = req.app.get('io');
    const connectedSockets = io?.engine?.clientsCount ?? 0;

    const [userCount, activeUserCount, departmentCount, projectCount, taskCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.project.count(),
      prisma.task.count(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        status: 'ONLINE',
        database: {
          status: 'CONNECTED',
          engine: 'MySQL (Prisma ORM)',
          latencyMs: dbLatencyMs,
          health: dbLatencyMs < 50 ? 'EXCELLENT' : dbLatencyMs < 200 ? 'GOOD' : 'SLOW',
        },
        server: {
          nodeVersion: process.version,
          platform: process.platform,
          uptimeSeconds,
          uptimeFormatted,
          memory: {
            heapUsedMB: toMB(memoryUsage.heapUsed),
            heapTotalMB: toMB(memoryUsage.heapTotal),
            rssMB: toMB(memoryUsage.rss),
          },
        },
        realtime: {
          status: 'ACTIVE',
          connectedClients: connectedSockets,
        },
        records: {
          users: userCount,
          activeUsers: activeUserCount,
          departments: departmentCount,
          projects: projectCount,
          tasks: taskCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Lỗi getSystemHealth:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi kiểm tra trạng thái hệ thống.',
      error: error.message,
    });
  }
};
