import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  getUserNotifications,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
  getUnreadCount as countUnreadNotifications,
} from '../services/notificationService';

/**
 * 1. Lấy danh sách notifications của user hiện tại
 */
export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { page, limit, isRead } = req.query;

    const options: any = {
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    };

    if (isRead !== undefined) {
      options.isRead = isRead === 'true';
    }

    const result = await getUserNotifications(userId, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi getNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách thông báo.',
      error: error.message,
    });
  }
};

/**
 * 2. Đánh dấu một thông báo là đã đọc
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const updated = await markNotificationAsRead(id, userId);

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc.',
      data: updated,
    });
  } catch (error: any) {
    console.error('Lỗi markAsRead:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi cập nhật trạng thái thông báo.',
    });
  }
};

/**
 * 3. Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const result = await markAllNotificationsAsRead(userId);

    res.status(200).json({
      success: true,
      message: `Đã đánh dấu ${result.count} thông báo là đã đọc.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi markAllAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đánh dấu tất cả thông báo là đã đọc.',
      error: error.message,
    });
  }
};

/**
 * 4. Đếm số lượng thông báo chưa đọc của người dùng
 */
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const count = await countUnreadNotifications(userId);

    res.status(200).json({
      success: true,
      data: {
        unreadCount: count,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getUnreadCount:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy số lượng thông báo chưa đọc.',
      error: error.message,
    });
  }
};

/**
 * 5. Xóa thông báo
 */
export const deleteNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const existing = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Thông báo không tồn tại hoặc không thuộc quyền sở hữu của bạn.',
      });
      return;
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa thông báo thành công!',
    });
  } catch (error: any) {
    console.error('Lỗi deleteNotification:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa thông báo.',
      error: error.message,
    });
  }
};
