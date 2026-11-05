import { prisma } from '../config/database';

export interface ProjectStatusSyncResult {
  projectId: string;
  previousStatus: string;
  newStatus: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
}

/**
 * Tự động kiểm tra và đồng bộ trạng thái của một Dự án (project.status) dựa trên tiến độ Tasks thực tế
 * - Nếu 100% tasks hoàn thành (status === 'DONE'): status = 'COMPLETED'
 * - Nếu một task bị kéo lại khiến progress < 100% nhưng đã có task làm: status = 'IN_PROGRESS'
 * - Nếu chưa có task nào bắt đầu (tất cả TODO hoặc không có task): status = 'PLANNING' (hoặc giữ nguyên nếu đã set)
 */
export async function syncProjectStatus(
  projectId: string,
  io?: any
): Promise<ProjectStatusSyncResult | null> {
  if (!projectId) return null;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true },
    });

    if (!project || project.status === 'ARCHIVED') return null;

    // Lấy toàn bộ danh sách tasks thuộc dự án
    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: { id: true, status: true },
    });

    const totalTasks = tasks.length;
    if (totalTasks === 0) {
      return null;
    }

    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;
    const progress = Math.round((completedTasks / totalTasks) * 100);

    let targetStatus: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' = project.status as any;

    if (completedTasks === totalTasks) {
      // 100% hoàn thành -> COMPLETED
      targetStatus = 'COMPLETED';
    } else if (completedTasks > 0 || inProgressTasks > 0) {
      // Đang triển khai nhưng chưa đạt 100% -> IN_PROGRESS
      targetStatus = 'IN_PROGRESS';
    } else {
      // Tất cả tasks đều TODO: nếu trước đó là COMPLETED mà bị chuyển về chưa xong -> IN_PROGRESS
      if (project.status === 'COMPLETED') {
        targetStatus = 'IN_PROGRESS';
      }
    }

    if (targetStatus !== project.status) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: targetStatus },
      });

      const result: ProjectStatusSyncResult = {
        projectId,
        previousStatus: project.status,
        newStatus: targetStatus,
        progress,
        totalTasks,
        completedTasks,
      };

      if (io) {
        io.to(`project:${projectId}`).emit('project:status_changed', {
          projectId,
          status: targetStatus,
          previousStatus: project.status,
          progress,
        });
        io.emit('project:status_changed', {
          projectId,
          status: targetStatus,
          previousStatus: project.status,
          progress,
        });
      }

      return result;
    }

    return null;
  } catch (error) {
    console.error(`[syncProjectStatus] Lỗi khi đồng bộ trạng thái project ${projectId}:`, error);
    return null;
  }
}

/**
 * Đồng bộ toàn bộ trạng thái các dự án trong hệ thống (dùng khi khởi động hoặc truy vấn tổng)
 */
export async function syncAllProjectsStatus(): Promise<number> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        NOT: {
          name: 'Công việc cá nhân & Lịch hẹn',
        },
      },
      select: {
        id: true,
        status: true,
        tasks: { select: { status: true } },
      },
    });

    let updatedCount = 0;
    for (const p of projects) {
      if (p.status === 'ARCHIVED') continue;

      const total = p.tasks.length;
      if (total === 0) continue;

      const completed = p.tasks.filter((t) => t.status === 'DONE').length;
      const inProgress = p.tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;

      let newStatus: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | null = null;
      if (completed === total) {
        newStatus = 'COMPLETED';
      } else if (completed > 0 || inProgress > 0) {
        if (p.status === 'PLANNING') {
          newStatus = 'IN_PROGRESS';
        }
      }

      if (newStatus && newStatus !== p.status) {
        await prisma.project.update({
          where: { id: p.id },
          data: { status: newStatus },
        });
        updatedCount++;
      }
    }

    return updatedCount;
  } catch (error) {
    console.warn('[syncAllProjectsStatus] Lỗi quét đồng bộ dự án:', error);
    return 0;
  }
}

