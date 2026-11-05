import api from './api';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type ProjectMemberRole = 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  joinedAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  members?: ProjectMember[];
  ownerId: string;
  owner?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  progress?: number;
}

export interface CreateProjectDto {
  name: string;
  key?: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  memberIds?: string[];
}

export interface UpdateProjectDto {
  name?: string;
  key?: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number;
  membersCount: number;
}

export interface WorkloadMemberTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  estimatedHours: number;
  dueDate?: string | null;
}

export interface WorkloadMemberData {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  departmentName?: string;
  assignedHours: number;
  standardCapacity: number;
  workloadPercent: number;
  status: 'OVERLOADED' | 'BALANCED' | 'UNDERLOADED';
  tasks: WorkloadMemberTask[];
  reallocatableTasks: WorkloadMemberTask[];
}

export interface WorkloadSummary {
  totalMembers: number;
  overloadedCount: number;
  balancedCount: number;
  underloadedCount: number;
  totalAssignedHours: number;
}

export interface ProjectWorkloadResponse {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
  };
  standardCapacity: number;
  members: WorkloadMemberData[];
  summary: WorkloadSummary;
}

export interface AiRebalanceRecommendation {
  taskId: string;
  taskTitle: string;
  hours: number;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  reason: string;
}

export interface AiRebalanceResponse {
  projectId: string;
  standardCapacity: number;
  recommendations: AiRebalanceRecommendation[];
  summary: string;
}

export const projectService = {
  async createProject(dto: CreateProjectDto): Promise<Project> {
    const response = await api.post<Project>('/projects', dto);
    return response.data;
  },

  async getAllProjects(): Promise<Project[]> {
    const response = await api.get<Project[]>('/projects');
    return response.data;
  },

  async getProjectById(id: string): Promise<Project> {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  async updateProject(id: string, dto: UpdateProjectDto): Promise<Project> {
    const response = await api.put<Project>(`/projects/${id}`, dto);
    return response.data;
  },

  async deleteProject(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async addMember(projectId: string, userId: string, role: ProjectMemberRole = 'MEMBER'): Promise<ProjectMember> {
    const response = await api.post<ProjectMember>(`/projects/${projectId}/members`, {
      userId,
      role,
    });
    return response.data;
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/members/${userId}`);
  },

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const response = await api.get<ProjectStats>(`/projects/${projectId}/stats`);
    return response.data;
  },

  async getProjectWorkload(projectId: string, capacity: number = 40): Promise<ProjectWorkloadResponse> {
    const response = await api.get<{ success: boolean; data: ProjectWorkloadResponse }>(`/projects/${projectId}/workload?capacity=${capacity}`);
    return response.data.data;
  },

  async getAiRebalanceRecommendations(projectId: string, capacity: number = 40): Promise<AiRebalanceResponse> {
    const response = await api.post<{ success: boolean; data: AiRebalanceResponse }>(`/projects/${projectId}/workload/ai-rebalance`, { capacity });
    return response.data.data;
  },

  async applyWorkloadRebalance(projectId: string, reallocations: Array<{ taskId: string; toUserId: string }>): Promise<{ appliedCount: number }> {
    const response = await api.post<{ success: boolean; message: string; data: { appliedCount: number } }>(`/projects/${projectId}/workload/apply-rebalance`, { reallocations });
    return response.data.data;
  },
};

export default projectService;
