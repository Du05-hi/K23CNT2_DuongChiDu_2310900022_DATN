import apiClient from './apiClient';

export type ApprovalType = 'LEAVE' | 'OT' | 'EXTEND_DEADLINE' | 'RESOURCE';
export type ApprovalPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApprovalUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  department?: {
    name: string;
  } | null;
}

export interface ApprovalTask {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  priority: string;
  project?: {
    id: string;
    name: string;
  } | null;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  type: ApprovalType;
  description: string;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  responseNote?: string | null;
  requesterId: string;
  requester: ApprovalUser;
  reviewerId?: string | null;
  reviewer?: ApprovalUser | null;
  taskId?: string | null;
  task?: ApprovalTask | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalMetrics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled?: number;
}

export interface CreateApprovalDTO {
  title: string;
  type: ApprovalType;
  description: string;
  priority?: ApprovalPriority;
  startDate?: string | null;
  endDate?: string | null;
  taskId?: string | null;
}

export interface ReviewApprovalDTO {
  action?: 'APPROVE' | 'REJECT' | 'RESET_PENDING';
  status?: 'APPROVED' | 'REJECTED';
  responseNote?: string;
}

export interface BatchReviewDTO {
  ids: string[];
  action: 'APPROVE' | 'REJECT';
  responseNote?: string;
}

export interface AiAnalysisResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  recommendation: string;
}

export interface TaskOption {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  priority: string;
  project?: {
    id: string;
    name: string;
  } | null;
}

export const approvalService = {
  // Lấy danh sách đề xuất kèm số liệu thống kê
  async getApprovals(params?: {
    status?: string;
    type?: string;
    priority?: string;
    search?: string;
  }): Promise<{ data: ApprovalRequest[]; stats: ApprovalMetrics; metrics: ApprovalMetrics }> {
    const res = await apiClient.get('/approvals', { params });
    const raw = res.data;

    let list: ApprovalRequest[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (Array.isArray(raw?.data)) {
      list = raw.data;
    } else if (Array.isArray(raw?.approvals)) {
      list = raw.approvals;
    } else if (raw?.data && Array.isArray(raw.data.data)) {
      list = raw.data.data;
    }

    const pending = list.filter((item) => item.status === 'PENDING').length;
    const approved = list.filter((item) => item.status === 'APPROVED').length;
    const rejected = list.filter((item) => item.status === 'REJECTED').length;
    const cancelled = list.filter((item) => item.status === 'CANCELLED').length;
    const total = list.length;

    const statsObj = raw?.stats || raw?.metrics || (raw?.data && (raw.data.stats || raw.data.metrics));
    const stats: ApprovalMetrics = {
      pending: typeof statsObj?.pending === 'number' ? statsObj.pending : pending,
      approved: typeof statsObj?.approved === 'number' ? statsObj.approved : approved,
      rejected: typeof statsObj?.rejected === 'number' ? statsObj.rejected : rejected,
      cancelled: typeof statsObj?.cancelled === 'number' ? statsObj.cancelled : cancelled,
      total: typeof statsObj?.total === 'number' ? statsObj.total : total,
    };

    return {
      data: list,
      stats,
      metrics: stats,
    };
  },

  // Lấy danh sách task cá nhân phục vụ chọn khi xin gia hạn deadline
  async getMyTasks(): Promise<TaskOption[]> {
    const res = await apiClient.get('/approvals/my-tasks');
    return res.data.data || [];
  },

  // Tạo đề xuất mới
  async createApproval(data: CreateApprovalDTO): Promise<ApprovalRequest> {
    const res = await apiClient.post('/approvals', data);
    return res.data.data;
  },

  // Phê duyệt hoặc từ chối đề xuất (chỉ ADMIN / MANAGER)
  async reviewApproval(id: string, data: ReviewApprovalDTO): Promise<ApprovalRequest> {
    const res = await apiClient.patch(`/approvals/${id}/review`, data);
    return res.data.data;
  },

  // Người gửi tự hủy đề xuất khi đơn vẫn ở trạng thái PENDING
  async cancelApproval(id: string): Promise<ApprovalRequest> {
    const res = await apiClient.patch(`/approvals/${id}/cancel`);
    return res.data.data;
  },

  // Phê duyệt hoặc từ chối hàng loạt bằng Prisma Transaction (ADMIN / MANAGER)
  async batchReviewApprovals(data: BatchReviewDTO): Promise<{ success: boolean; message: string; processedCount: number }> {
    const res = await apiClient.post('/approvals/batch-review', data);
    return res.data;
  },

  // Thẩm định tác động và rủi ro đề xuất bằng AI
  async analyzeApprovalWithAI(id: string): Promise<AiAnalysisResult> {
    const res = await apiClient.post(`/approvals/${id}/ai-analyze`);
    return res.data.data;
  },

  // Hủy/xóa đề xuất vĩnh viễn (ADMIN hoặc chủ đơn khi PENDING)
  async deleteApproval(id: string): Promise<void> {
    await apiClient.delete(`/approvals/${id}`);
  },
};

export default approvalService;
