import { prisma } from '../config/prisma';

export interface LogActivityParams {
  userId: string;
  action: string;
  entityType: 'PROJECT' | 'TASK' | 'SUBTASK' | 'COMMENT' | 'USER' | 'KPI' | string;
  entityId: string;
  description: string;
  metadata?: Record<string, any> | null;
}

export interface ActivityLogFilters {
  projectId?: string;
  userId?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Ghi nhận nhật ký hoạt động hệ thống
 */
export async function logActivity(params: LogActivityParams) {
  try {
    const activityLog = await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        description: params.description,
        metadata: params.metadata ? (params.metadata as any) : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    return activityLog;
  } catch (error: any) {
    console.error('Lỗi khi ghi ActivityLog:', error?.message || error);
    throw error;
  }
}

/**
 * Lấy danh sách nhật ký hoạt động có phân trang và bộ lọc, tự động join User
 */
export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const limit = Math.max(1, filters.limit || 20);
  const offset = Math.max(0, filters.offset || 0);

  const whereClause: any = {};

  if (filters.userId) {
    whereClause.userId = filters.userId;
  }

  if (filters.entityType) {
    whereClause.entityType = filters.entityType;
  }

  // Nếu lọc theo projectId: có thể entityType = 'PROJECT' và entityId = projectId,
  // hoặc metadata chứa projectId
  if (filters.projectId) {
    whereClause.OR = [
      {
        entityType: 'PROJECT',
        entityId: filters.projectId,
      },
      {
        metadata: {
          path: ['projectId'],
          equals: filters.projectId,
        },
      },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    }),
    prisma.activityLog.count({
      where: whereClause,
    }),
  ]);

  return {
    logs,
    total,
    page: Math.floor(offset / limit) + 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
