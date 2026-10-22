export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type ProjectMemberRole = 'PROJECT_MANAGER' | 'MEMBER' | 'VIEWER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  email: string;
  name: string;
  fullName?: string;
  role: Role;
  isActive: boolean;
  avatar?: string | null;
  avatarUrl?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  userCount?: number;
  projectCount?: number;
  users?: User[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  user: User;
  joinedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  createdById: string;
  creator?: User;
  members: ProjectMember[];
  tasks?: Task[];
  taskCount?: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    review: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
  taskId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  author: User;
  createdAt: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  position: number;
  estimatedHours?: number | null;
  actualHours?: number | null;
  projectId: string;
  project?: Project;
  assigneeId?: string | null;
  assignee?: User | null;
  createdById: string;
  creator?: User;
  subTasks: SubTask[];
  comments?: Comment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KpiLog {
  id: string;
  userId: string;
  user: User;
  period: string; // "YYYY-MM"
  tasksCompleted: number;
  tasksOnTime: number;
  totalScore: number;
  rank: 'A' | 'B' | 'C' | 'D' | 'S';
  details?: {
    qualityScore?: number;
    deadlineScore?: number;
    teamworkScore?: number;
    innovationScore?: number;
    feedback?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  user: User;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface DashboardStats {
  todayTasksCount: number;
  completedTasksCount: number;
  activeProjectsCount: number;
  monthlyKpiScore: number;
  weeklyProgress: {
    day: string;
    completed: number;
    assigned: number;
  }[];
  radarMetrics: {
    subject: string;
    score: number;
    fullMark: number;
  }[];
  topPerformers: {
    id: string;
    name: string;
    avatar?: string | null;
    role: string;
    department?: string;
    kpiScore: number;
    rank: number;
  }[];
  recentProjects: Project[];
  recentActivities: ActivityLog[];
}
