import api from './api';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_COMPLETED'
  | 'COMMENT_ADDED'
  | 'PROJECT_INVITATION'
  | 'KPI_GENERATED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export const notificationService = {
  async getNotifications(limit: number = 20, page: number = 1): Promise<GetNotificationsResponse> {
    const response = await api.get<GetNotificationsResponse>('/notifications', {
      params: { limit, page },
    });
    return response.data;
  },

  async markAsRead(id: string): Promise<Notification> {
    const response = await api.put<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ unreadCount: number }>('/notifications/unread-count');
    return response.data.unreadCount;
  },

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
