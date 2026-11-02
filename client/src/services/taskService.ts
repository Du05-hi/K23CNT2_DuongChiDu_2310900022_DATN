import api from './api';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskCategory = 'CORE_PROJECT' | 'RD' | 'OPERATIONS';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MilestoneStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';
export type DependencyType = 'BLOCKS' | 'BLOCKED_BY' | 'RELATES_TO';

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: MilestoneStatus;
  totalTasks?: number;
  completedTasks?: number;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskChecklist {
  id: string;
  taskId: string;
  content: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedById?: string | null;
  completedBy?: { id: string; name: string; avatar?: string } | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: DependencyType;
  task?: { id: string; title: string; status: TaskStatus; priority?: TaskPriority; dueDate?: string | null; assignee?: { name: string } };
  dependsOnTask?: { id: string; title: string; status: TaskStatus; priority?: TaskPriority; dueDate?: string | null; assignee?: { name: string } };
  createdAt?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface WorkLog {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  description?: string | null;
  loggedDate: string;
  createdAt?: string;
  updatedAt?: string;
  user?: UserSummary;
}

export interface TaskActivityItem {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: any;
  createdAt: string;
  user?: UserSummary;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  author?: UserSummary;
  content: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  category?: TaskCategory;
  priority: TaskPriority;
  projectId: string;
  project?: {
    id: string;
    name: string;
  };
  assigneeId?: string | null;
  assignee?: UserSummary;
  reviewerId?: string | null;
  reviewer?: UserSummary;
  milestoneId?: string | null;
  milestone?: Milestone;
  rejectReason?: string | null;
  position?: number;
  createdById: string;
  creator?: UserSummary;
  dueDate?: string;
  completedAt?: string | null;
  estimatedHours?: number;
  actualHours?: number;
  kpiBonusScore?: number;
  kpiPenaltyScore?: number;
  parentId?: string | null;
  parentTask?: {
    id: string;
    title: string;
    status: TaskStatus;
    priority?: TaskPriority;
  } | null;
  subtasks?: Task[];
  isParent?: boolean;
  subTasks?: SubTask[];
  checklists?: TaskChecklist[];
  dependencies?: TaskDependency[];
  dependedBy?: TaskDependency[];
  comments?: Comment[];
  attachments?: TaskAttachment[];
  workLogs?: WorkLog[];
  _count?: {
    attachments?: number;
    comments?: number;
    subTasks?: number;
    subtasks?: number;
    checklists?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
  reviewerId?: string;
  milestoneId?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  kpiBonusScore?: number;
  kpiPenaltyScore?: number;
  parentId?: string;
  isParent?: boolean;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  reviewerId?: string | null;
  milestoneId?: string | null;
  rejectReason?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  kpiBonusScore?: number;
  kpiPenaltyScore?: number;
  parentId?: string | null;
  isParent?: boolean;
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
  rejectReason?: string;
}

export const taskService = {
  async createTask(dto: CreateTaskDto): Promise<Task> {
    const response = await api.post<Task>('/tasks', dto);
    return response.data;
  },

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const response = await api.get<{ allTasks: Task[] }>(`/tasks/project/${projectId}`);
    return response.data.allTasks;
  },

  async getTaskById(id: string): Promise<Task> {
    const response = await api.get<Task>(`/tasks/${id}`);
    return response.data;
  },

  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, dto);
    return response.data;
  },

  async updateTaskStatus(id: string, dto: UpdateTaskStatusDto): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}/status`, dto);
    return response.data;
  },

  async updateTaskDeadline(id: string, dueDate: string | Date): Promise<Task> {
    const response = await api.patch<Task>(`/tasks/${id}/deadline`, { dueDate });
    return response.data;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  async addComment(taskId: string, content: string): Promise<Comment> {
    const response = await api.post<Comment>(`/tasks/${taskId}/comments`, { content });
    return response.data;
  },

  async getComments(taskId: string): Promise<Comment[]> {
    const response = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
    return response.data;
  },

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
  },

  async createSubTask(taskId: string, title: string): Promise<SubTask> {
    const response = await api.post<SubTask>(`/tasks/${taskId}/subtasks`, { title });
    return response.data;
  },

  async createWbsSubtask(payload: {
    parentId: string;
    projectId: string;
    title: string;
    assigneeId?: string;
    dueDate?: string;
    estimatedHours?: number;
  }): Promise<Task> {
    const response = await api.post<Task>('/tasks', {
      ...payload,
      isParent: false,
    });
    return response.data;
  },

  async updateSubTask(taskId: string, subTaskId: string, isCompleted: boolean, title?: string): Promise<SubTask> {
    const response = await api.put<SubTask>(`/tasks/subtasks/${subTaskId}`, {
      isCompleted,
      ...(title !== undefined ? { title } : {}),
    });
    return response.data;
  },

  async deleteSubTask(taskId: string, subTaskId: string): Promise<void> {
    await api.delete(`/tasks/subtasks/${subTaskId}`);
  },

  async uploadTaskAttachments(taskId: string, files: File[]): Promise<TaskAttachment[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await api.post<TaskAttachment[]>(`/tasks/${taskId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  },

  async getTaskAttachmentContent(taskId: string, attachmentId: string): Promise<Blob> {
    const response = await api.get<Blob>(
      `/tasks/${taskId}/attachments/${attachmentId}/content`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  async deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
  },

  async searchTasksNL(query: string, projectId?: string): Promise<Task[]> {
    const response = await api.post<Task[]>('/tasks/search-nl', { query, projectId });
    return response.data;
  },

  async logWork(taskId: string, payload: { hours: number; description?: string; loggedDate?: string }): Promise<{ success: boolean; message: string; data: { workLog: WorkLog; task: Task; actualHours: number } }> {
    const response = await api.post<{ success: boolean; message: string; data: { workLog: WorkLog; task: Task; actualHours: number } }>(`/tasks/${taskId}/worklogs`, payload);
    return response.data;
  },

  async getTaskWorkLogs(taskId: string): Promise<WorkLog[]> {
    const response = await api.get<{ success: boolean; data: WorkLog[] }>(`/tasks/${taskId}/worklogs`);
    return response.data.data;
  },

  async getTaskActivities(taskId: string): Promise<TaskActivityItem[]> {
    const response = await api.get<{ success: boolean; data: TaskActivityItem[] }>(`/tasks/${taskId}/activities`);
    return response.data.data;
  },

  // --- MILESTONES ---
  async getProjectMilestones(projectId: string): Promise<Milestone[]> {
    const response = await api.get<{ success: boolean; data: Milestone[] }>(`/tasks/milestones/project/${projectId}`);
    return (response.data as any)?.data || response.data || [];
  },

  async createProjectMilestone(projectId: string, dto: { title: string; description?: string; startDate?: string; dueDate?: string; status?: string }): Promise<Milestone> {
    const response = await api.post<{ success: boolean; data: Milestone }>(`/tasks/milestones/project/${projectId}`, dto);
    return (response.data as any)?.data || response.data;
  },

  async updateProjectMilestone(id: string, dto: { title?: string; description?: string; startDate?: string; dueDate?: string; status?: string }): Promise<Milestone> {
    const response = await api.put<{ success: boolean; data: Milestone }>(`/tasks/milestones/${id}`, dto);
    return (response.data as any)?.data || response.data;
  },

  async deleteProjectMilestone(id: string): Promise<void> {
    await api.delete(`/tasks/milestones/${id}`);
  },

  // --- CHECKLISTS (DoD) ---
  async getTaskChecklists(taskId: string): Promise<TaskChecklist[]> {
    const response = await api.get<{ success: boolean; data: TaskChecklist[] }>(`/tasks/${taskId}/checklists`);
    return (response.data as any)?.data || response.data || [];
  },

  async createTaskChecklist(taskId: string, content: string, isRequired: boolean = true): Promise<TaskChecklist> {
    const response = await api.post<{ success: boolean; data: TaskChecklist }>(`/tasks/${taskId}/checklists`, { content, isRequired });
    return (response.data as any)?.data || response.data;
  },

  async toggleTaskChecklist(checklistId: string): Promise<TaskChecklist> {
    const response = await api.put<{ success: boolean; data: TaskChecklist }>(`/tasks/checklists/${checklistId}/toggle`);
    return (response.data as any)?.data || response.data;
  },

  async deleteTaskChecklist(checklistId: string): Promise<void> {
    await api.delete(`/tasks/checklists/${checklistId}`);
  },

  // --- DEPENDENCIES ---
  async getTaskDependencies(taskId: string): Promise<{ dependencies: TaskDependency[]; dependedBy: TaskDependency[] }> {
    const response = await api.get<{ success: boolean; data: { dependencies: TaskDependency[]; dependedBy: TaskDependency[] } }>(`/tasks/${taskId}/dependencies`);
    return (response.data as any)?.data || response.data || { dependencies: [], dependedBy: [] };
  },

  async createTaskDependency(taskId: string, dependsOnTaskId: string, type: DependencyType = 'BLOCKS'): Promise<TaskDependency> {
    const response = await api.post<{ success: boolean; data: TaskDependency }>(`/tasks/${taskId}/dependencies`, { dependsOnTaskId, type });
    return (response.data as any)?.data || response.data;
  },

  async deleteTaskDependency(dependencyId: string): Promise<void> {
    await api.delete(`/tasks/dependencies/${dependencyId}`);
  },

  // --- REVIEW / QA ---
  async approveTaskReview(taskId: string): Promise<Task> {
    const response = await api.post<{ success: boolean; data: Task }>(`/tasks/${taskId}/review-approve`);
    return (response.data as any)?.data || response.data;
  },

  async rejectTaskReview(taskId: string, rejectReason: string): Promise<Task> {
    const response = await api.post<{ success: boolean; data: Task }>(`/tasks/${taskId}/review-reject`, { rejectReason });
    return (response.data as any)?.data || response.data;
  },

  // --- GEMINI AI TASK COPILOT ---
  async aiTaskBreakdown(taskId: string, projectScope?: string): Promise<{ suggestions: any[]; createdSubtasks: Task[]; createdChecklists: TaskChecklist[] }> {
    const response = await api.post<{ success: boolean; data: { suggestions: any[]; createdSubtasks: Task[]; createdChecklists: TaskChecklist[] } }>('/ai/task-breakdown', { taskId, projectScope });
    return (response.data as any)?.data || response.data;
  },
};

export default taskService;
