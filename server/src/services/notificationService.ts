import { Server } from 'socket.io';
import { prisma } from '../config/prisma';

export type NotificationTypeEnum =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'PROJECT_INVITATION'
  | 'KPI_GENERATED'
  | 'SYSTEM';

export interface CreateNotificationParams {
  userId: string;
  type?: NotificationTypeEnum;
  title: string;
  message: string;
  relatedId?: string | null;
}

export interface GetNotificationOptions {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

/**
 * 1. Tạo notification mới trong cơ sở dữ liệu
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type || 'SYSTEM',
        title: params.title,
        message: params.message,
        relatedId: params.relatedId || null,
        isRead: false,
      },
    });

    return notification;
  } catch (error: any) {
    console.error('Lỗi khi tạo notification:', error?.message || error);
    throw error;
  }
}

/**
 * 2. Gửi notification real-time qua Socket.io tới đúng room của user
 */
export function sendRealtimeNotification(
  io: Server | null | undefined,
  userId: string,
  notification: any
): void {
  if (!io) {
    return;
  }

  try {
    // Room cho mỗi cá nhân: user:<userId>
    io.to(`user:${userId}`).emit('notification:new', notification);
  } catch (error: any) {
    console.error(`Lỗi khi emit socket notification tới user ${userId}:`, error?.message || error);
  }
}

/**
 * 3. Lấy danh sách notifications của một user có phân trang và lọc trạng thái đã đọc
 */
export async function getUserNotifications(
  userId: string,
  options: GetNotificationOptions = {}
) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, options.limit || 20);
  const skip = (page - 1) * limit;

  const whereClause: any = {
    userId,
  };

  if (typeof options.isRead === 'boolean') {
    whereClause.isRead = options.isRead;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.notification.count({
      where: whereClause,
    }),
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 4. Đánh dấu một thông báo cụ thể là đã đọc
 */
export async function markAsRead(notificationId: string, userId: string) {
  // Đảm bảo thông báo thuộc về chính user đó
  const existing = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!existing) {
    throw new Error('Thông báo không tồn tại hoặc bạn không có quyền thao tác.');
  }

  const updated = await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      isRead: true,
    },
  });

  return updated;
}

/**
 * 5. Đánh dấu toàn bộ thông báo của user là đã đọc
 */
export async function markAllAsRead(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return {
    count: result.count,
  };
}

/**
 * 6. Đếm số lượng thông báo chưa đọc của user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return count;
}
