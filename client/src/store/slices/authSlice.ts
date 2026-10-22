import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types';
import authService from '../../services/authService';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const normalizeUser = (user: User): User => {
  const name = user.name || user.fullName || '';
  const fullName = user.fullName || user.name || '';
  const avatar = user.avatar || user.avatarUrl || null;
  const avatarUrl = user.avatarUrl || user.avatar || null;
  return {
    ...user,
    name,
    fullName,
    avatar,
    avatarUrl,
  };
};

const readStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;

  try {
    const user = localStorage.getItem('user');
    return user ? normalizeUser(JSON.parse(user) as User) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const initialToken =
  typeof window !== 'undefined'
    ? localStorage.getItem('accessToken') || localStorage.getItem('token')
    : null;

const initialState: AuthState = {
  user: readStoredUser(),
  accessToken: initialToken,
  isAuthenticated: Boolean(initialToken),
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      const normalized = normalizeUser(action.payload);
      state.user = normalized;
      state.isAuthenticated = true;
      localStorage.setItem('user', JSON.stringify(normalized));
    },
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; accessToken: string; refreshToken?: string }>
    ) => {
      const normalized = normalizeUser(action.payload.user);
      state.user = normalized;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('token', action.payload.accessToken);
      localStorage.setItem('user', JSON.stringify(normalized));
      if (action.payload.refreshToken) {
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      }
    },
    updateUser: (state, action: PayloadAction<User>) => {
      const normalized = normalizeUser(action.payload);
      state.user = normalized;
      localStorage.setItem('user', JSON.stringify(normalized));
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.error = null;
      authService.logout();
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setUser, setCredentials, updateUser, setLoading, logout, clearError } =
  authSlice.actions;

export default authSlice.reducer;
