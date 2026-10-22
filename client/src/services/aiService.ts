import api from './api';
import { Task } from './taskService';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubTaskSuggestion {
  title: string;
  estimatedHours: number;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface RiskWarning {
  id: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  riskLevel: RiskLevel;
  title: string;
  description: string;
  recommendation: string;
}

export const aiService = {
  async generateMyWorkInsights(): Promise<string> {
    try {
      const response = await api.post<any>('/ai/my-work');
      return (
        response.data?.data?.summaryMarkdown ||
        response.data?.summaryMarkdown ||
        (typeof response.data === 'string' ? response.data : '') ||
        'Chưa có dữ liệu phân tích công việc cá nhân.'
      );
    } catch (error) {
      console.warn('Lỗi khi tải phân tích cá nhân AI:', error);
      return 'Hiện tại AI đang tạm ngưng phân tích. Vui lòng thử lại sau.';
    }
  },

  async breakdownTask(title: string, description: string, projectId?: string): Promise<SubTaskSuggestion[]> {
    try {
      const response = await api.post<any>('/ai/breakdown', {
        title,
        description,
        projectId,
      });
      const raw = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      return raw;
    } catch (error) {
      console.warn('Lỗi khi phân tách task AI:', error);
      return [];
    }
  },

  async generateSummary(projectId: string): Promise<string> {
    try {
      const response = await api.post<any>('/ai/summary', {
        projectId,
      });
      return (
        response.data?.data?.summaryMarkdown ||
        response.data?.summaryMarkdown ||
        (typeof response.data === 'string' ? response.data : '') ||
        'Không thể lấy bản tóm tắt tiến độ.'
      );
    } catch (error) {
      console.warn('Lỗi khi tạo báo cáo tóm tắt tiến độ AI:', error);
      return 'Báo cáo tiến độ hiện chưa sẵn sàng. Vui lòng thử lại sau.';
    }
  },

  async detectRisks(): Promise<RiskWarning[]> {
    try {
      const response = await api.post<any>('/ai/risks');
      const raw = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      return raw.map((risk: any) => ({
        id: risk.projectId || String(Math.random()),
        projectId: risk.projectId || '',
        projectName: risk.projectName || 'Dự án',
        riskLevel: (risk.riskLevel as RiskLevel) || 'LOW',
        title: risk.title || `Mức độ rủi ro: ${risk.riskLevel || 'LOW'}`,
        description: Array.isArray(risk.riskFactors)
          ? risk.riskFactors.join(' • ')
          : typeof risk.description === 'string'
          ? risk.description
          : 'Dữ liệu rủi ro đang được theo dõi.',
        recommendation: Array.isArray(risk.recommendations)
          ? risk.recommendations.join(' ')
          : typeof risk.recommendation === 'string'
          ? risk.recommendation
          : 'Tiếp tục giám sát các mốc quan trọng của dự án.',
      }));
    } catch (error) {
      console.warn('Lỗi khi tải phân tích rủi ro AI:', error);
      return [];
    }
  },

  async getDepartmentRisks(): Promise<RiskWarning[]> {
    try {
      const response = await api.get<any>('/ai/department-risk');
      const raw = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      return raw.map((risk: any) => ({
        id: risk.projectId || String(Math.random()),
        projectId: risk.projectId || '',
        projectName: risk.projectName || 'Dự án',
        riskLevel: (risk.riskLevel as RiskLevel) || 'LOW',
        title: risk.title || `Mức độ rủi ro: ${risk.riskLevel || 'LOW'}`,
        description: Array.isArray(risk.riskFactors)
          ? risk.riskFactors.join(' • ')
          : typeof risk.description === 'string'
          ? risk.description
          : 'Dữ liệu rủi ro đang được theo dõi.',
        recommendation: Array.isArray(risk.recommendations)
          ? risk.recommendations.join(' ')
          : typeof risk.recommendation === 'string'
          ? risk.recommendation
          : 'Tiếp tục giám sát các mốc quan trọng của dự án.',
      }));
    } catch (error) {
      console.warn('Lỗi khi tải rủi ro phòng ban:', error);
      return [];
    }
  },

  async searchTasksNL(query: string, projectId?: string): Promise<Task[]> {
    try {
      const response = await api.post<any>('/ai/search', { query, projectId });
      const raw = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      return raw;
    } catch (error) {
      console.warn('Lỗi khi tìm kiếm công việc bằng AI:', error);
      return [];
    }
  },

  async chatWithLiveData(
    query: string,
    history?: Array<{ role: 'user' | 'model'; text: string }>
  ): Promise<{
    answer: string;
    stats?: any;
    timestamp?: string;
  }> {
    try {
      const response = await api.post<any>('/ai/chat', { query, history });
      const raw = response.data;
      const answer =
        raw?.answer ||
        raw?.data?.answer ||
        (typeof raw === 'string' ? raw : '') ||
        'Không có phản hồi từ trợ lý AI.';

      return {
        answer,
        stats: raw?.stats || raw?.data?.stats,
        timestamp: raw?.timestamp,
      };
    } catch (error) {
      console.error('Lỗi khi chat với dữ liệu live AI:', error);
      throw error;
    }
  },
};

export default aiService;
