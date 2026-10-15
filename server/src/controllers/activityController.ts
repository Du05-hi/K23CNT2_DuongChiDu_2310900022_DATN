import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export const getRecentActivities = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    let where: any = {};
    if (user.role !== 'ADMIN') {
      const projectWhere: any = user.role === 'MANAGER'
        ? {
            OR: [
              ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
              { createdById: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }
        : { OR: [{ createdById: user.id }, { members: { some: { userId: user.id } } }] };
      const projects = await prisma.project.findMany({
        where: projectWhere,
        select: { id: true },
      });
      const projectIds = projects.map((project) => project.id);
      const tasks = projectIds.length
        ? await prisma.task.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } })
        : [];
      const relatedIds = [...projectIds, ...tasks.map((task) => task.id)];
      where = {
        OR: [
          { userId: user.id },
          ...(relatedIds.length ? [{ entityId: { in: relatedIds } }] : []),
        ],
      };
    }

    const logs = await prisma.activityLog.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    const data = logs.map((log) => {
      const action = log.action.toUpperCase();
      const metadata = log.metadata && typeof log.metadata === 'object'
        ? log.metadata as Record<string, unknown>
        : {};
      const verb = action.includes('COMMENT')
        ? 'commented'
        : action.includes('COMPLETED') || action.includes('DONE')
        ? 'completed'
        : action.includes('CREATED')
        ? 'created'
        : action.includes('DELETED') || action.includes('ARCHIVED')
        ? 'deleted'
        : 'updated';
      const title = metadata.taskTitle || metadata.projectName || metadata.title || log.description;

      return {
        id: log.id,
        user: {
          id: log.user.id,
          fullName: log.user.name,
          avatarUrl: log.user.avatar || undefined,
        },
        action: verb,
        entityType: log.entityType.toLowerCase(),
        entityTitle: String(title),
        details: log.description,
        createdAt: log.createdAt,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Lỗi getRecentActivities:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy lịch sử hoạt động.',
      error: error.message,
    });
  }
};
