import { createSlice } from '@reduxjs/toolkit';
import type { Notification } from '../../services/notificationService';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    markAllAsRead: (state) => {
      state.notifications.forEach((notification) => {
        notification.isRead = true;
      });
      state.unreadCount = 0;
    },
  },
});

export const { markAllAsRead } = notificationSlice.actions;
export default notificationSlice.reducer;
