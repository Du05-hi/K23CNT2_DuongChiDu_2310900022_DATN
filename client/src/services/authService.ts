import apiClient from './apiClient';
import type { User } from '@/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
  department?: string;
  position?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

export const authService = {
  /**
   * Đăng nhập người dùng bằng email và mật khẩu
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Đăng ký tài khoản người dùng mới
   */
  async register(data: RegisterRequest): Promise<ApiResponse<{ email: string }>> {
    const response = await apiClient.post<ApiResponse<{ email: string }>>('/auth/register', data);
    return response.data;
  },

  async verifyEmail(email: string, otp: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/verify-email', { email, otp });
    return response.data;
  },

  async resendEmailVerification(email: string): Promise<ApiMessageResponse> {
    const response = await apiClient.post<ApiMessageResponse>('/auth/resend-verification', { email });
    return response.data;
  },

  async forgotPassword(email: string): Promise<ApiMessageResponse> {
    const response = await apiClient.post<ApiMessageResponse>('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(email: string, otp: string, newPassword: string): Promise<ApiMessageResponse> {
    const response = await apiClient.post<ApiMessageResponse>('/auth/reset-password', {
      email,
      otp,
      newPassword,
    });
    return response.data;
  },

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;

    try {
      const user = localStorage.getItem('user');
      return user ? (JSON.parse(user) as User) : null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  },

  /**
   * Cấp lại access token từ refresh token
   */
  async refreshToken(token?: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const refreshToken = token || localStorage.getItem('refreshToken');
    const response = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>(
      '/auth/refresh-token',
      { refreshToken }
    );
    return response.data.data;
  },

  /**
   * Đăng xuất khỏi hệ thống
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Bỏ qua lỗi server khi logout để luôn clear client state
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  /**
   * Lấy thông tin người dùng hiện tại đang đăng nhập
   */
  async getMe(accessToken?: string): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return response.data;
  },

  /**
   * Cập nhật thông tin tài khoản cá nhân
   */
  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.put<ApiResponse<User>>('/auth/profile', data);
    return response.data;
  },

  /**
   * Thay đổi mật khẩu người dùng
   */
  async changePassword(passwords: ChangePasswordRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      '/auth/change-password',
      passwords
    );
    return response.data;
  },
};

export default authService;
