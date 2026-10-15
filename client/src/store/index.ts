import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './slices/authSlice';
import uiReducer, { setTheme, toggleActivityFeed, toggleSidebar } from './slices/uiSlice';
import notificationReducer, { markAllAsRead } from './slices/notificationSlice';
import { clearError, logout, setCredentials, setLoading, setUser, updateUser } from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    notification: notificationReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export {
  clearError,
  logout,
  markAllAsRead,
  setCredentials,
  setLoading,
  setTheme,
  setUser,
  toggleActivityFeed,
  toggleSidebar,
  updateUser,
};
export type { User } from '../types';

export default store;
