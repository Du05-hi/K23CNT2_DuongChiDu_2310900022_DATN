import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { canAccessProject } from '../utils/projectAccess';
import {
  rebalanceProjectWorkloadWithGemini,
  RebalanceMemberInput,
} from '../services/geminiService';

const DEFAULT_STANDARD_CAPACITY = 40; // 40h / sprint chuẩn

interface ProjectMemberInfo {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  departmentName?: string;
}

/**
 * Thu thập và thống kê danh sách thành viên cùng công việc chưa hoàn thành trong dự án
 */
async function computeProjectWorkloadData(projectId: string, standardCapacity: number = DEFAULT_STANDARD_CAPACITY) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          department: { select: { name: true } },
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  // Thu thập mọi nhân sự có liên quan: Creator + Thành viên dự án + Người đang được giao Task
  const memberMap = new Map<string, ProjectMemberInfo>();

  if (project.creator) {
    memberMap.set(project.creator.id, {
      id: project.creator.id,
      name: project.creator.name,
      email: project.creator.email,
      avatar: project.creator.avatar,
      role: project.creator.role,
      departmentName: project.creator.department?.name,
    });
  }

  for (const pm of project.members) {
    if (pm.user && !memberMap.has(pm.user.id)) {
      memberMap.set(pm.user.id, {
        id: pm.user.id,
        name: pm.user.name,
        email: pm.user.email,
        avatar: pm.user.avatar,
        role: pm.user.role,
        departmentName: pm.user.department?.name,
      });
    }
  }

  // Kiểm tra thêm các task thuộc dự án có assigneeId nhưng chưa nằm trong danh sách
  const assignedUsers = await prisma.task.findMany({
    where: {
      projectId,
      assigneeId: { not: null },
    },
    select: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          department: { select: { name: true } },
        },
      },
    },
    distinct: ['assigneeId'],
  });

  for (const item of assignedUsers) {
    if (item.assignee && !memberMap.has(item.assignee.id)) {
      memberMap.set(item.assignee.id, {
        id: item.assignee.id,
        name: item.assignee.name,
        email: item.assignee.email,
        avatar: item.assignee.avatar,
        role: item.assignee.role,
        departmentName: item.assignee.department?.name,
      });
    }
  }

  // Lấy toàn bộ task chưa hoàn thành (status IN ['TODO', 'IN_PROGRESS']) của dự án
  const incompleteTasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      estimatedHours: true,
      actualHours: true,
      dueDate: true,
      assigneeId: true,
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  });

  // Gom nhóm task theo từng nhân sự
  const membersList: RebalanceMemberInput[] = [];

  for (const member of memberMap.values()) {
    const userTasks = incompleteTasks.filter((t) => t.assigneeId === member.id);

    // Tính tổng assignedHours: SUM(task.estimatedHours) - nếu không có thì mặc định 4h
    const assignedHours = userTasks.reduce((sum, task) => {
      const hours = typeof task.estimatedHours === 'number' && task.estimatedHours > 0 ? task.estimatedHours : 4;
      return sum + hours;
    }, 0);

    const workloadPercent = Math.round((assignedHours / standardCapacity) * 100);

    let status: 'OVERLOADED' | 'BALANCED' | 'UNDERLOADED' = 'BALANCED';
    if (workloadPercent > 100) {
      status = 'OVERLOADED';
    } else if (workloadPercent < 60) {
      status = 'UNDERLOADED';
    } else {
      status = 'BALANCED';
    }

    const reallocatableTasks = userTasks
      .filter((t) => t.status === 'TODO')
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        estimatedHours: typeof t.estimatedHours === 'number' && t.estimatedHours > 0 ? t.estimatedHours : 4,
        dueDate: t.dueDate,
      }));

    membersList.push({
      userId: member.id,
      name: member.name,
      email: member.email,
      avatar: member.avatar,
      role: member.role,
      departmentName: member.departmentName,
      assignedHours,
      standardCapacity,
      workloadPercent,
      status,
      tasks: userTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        estimatedHours: typeof t.estimatedHours === 'number' && t.estimatedHours > 0 ? t.estimatedHours : 4,
        dueDate: t.dueDate,
      })),
      reallocatableTasks,
    });
  }

  // Sắp xếp người quá tải lên trước để dễ theo dõi
  membersList.sort((a, b) => b.workloadPercent - a.workloadPercent);

  const summary = {
    totalMembers: membersList.length,
    overloadedCount: membersList.filter((m) => m.status === 'OVERLOADED').length,
    balancedCount: membersList.filter((m) => m.status === 'BALANCED').length,
    underloadedCount: membersList.filter((m) => m.status === 'UNDERLOADED').length,
    totalAssignedHours: membersList.reduce((sum, m) => sum + m.assignedHours, 0),
  };

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
    },
    standardCapacity,
    members: membersList,
    summary,
  };
}

/**
 * 1. API Phân tích Tải Nhân sự Dự án
 * GET /api/projects/:id/workload
 */
export const getProjectWorkload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;

    if (!req.user || !(await canAccessProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập dự án này.' });
      return;
    }

    const standardCapacity = Number(req.query.capacity) || DEFAULT_STANDARD_CAPACITY;
    const workloadData = await computeProjectWorkloadData(projectId, standardCapacity);

    if (!workloadData) {
      res.status(404).json({ success: false, message: 'Không tìm thấy dự án yêu cầu.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: workloadData,
    });
  } catch (error: any) {
    console.error('[getProjectWorkload] Lỗi:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi phân tích tải nhân sự dự án.',
      error: error?.message,
    });
  }
};

/**
 * 2. API Đề xuất Tái Cân bằng bằng Google Gemini AI
 * POST /api/projects/:id/workload/ai-rebalance
 */
export const getAiRebalanceRecommendations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;

    if (!req.user || !(await canAccessProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập dự án này.' });
      return;
    }

    const standardCapacity = Number(req.body?.capacity) || DEFAULT_STANDARD_CAPACITY;
    const workloadData = await computeProjectWorkloadData(projectId, standardCapacity);

    if (!workloadData) {
      res.status(404).json({ success: false, message: 'Không tìm thấy dự án yêu cầu.' });
      return;
    }

    // Gọi Gemini AI để tính toán kế hoạch điều chuyển tối ưu
    const aiResult = await rebalanceProjectWorkloadWithGemini(workloadData.members, standardCapacity);

    res.status(200).json({
      success: true,
      data: {
        projectId,
        standardCapacity,
        recommendations: aiResult.recommendations,
        summary: aiResult.summary,
      },
    });
  } catch (error: any) {
    console.error('[getAiRebalanceRecommendations] Lỗi:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xử lý đề xuất AI cân bằng tải.',
      error: error?.message,
    });
  }
};

/**
 * 3. API Áp dụng Điều chuyển Hàng loạt
 * POST /api/projects/:id/workload/apply-rebalance
 */
export const applyWorkloadRebalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const currentUserId = req.user?.id;

    if (!req.user || !currentUserId || !(await canAccessProject(req.user, projectId))) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác trên dự án này.' });
      return;
    }

    // Hỗ trợ cả req.body = [...] hoặc req.body = { reallocations: [...] } hoặc { recommendations: [...] }
    const rawItems = Array.isArray(req.body)
      ? req.body
      : (req.body?.reallocations || req.body?.recommendations || []);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Danh sách điều chuyển không hợp lệ hoặc đang trống.',
      });
      return;
    }

    // Lọc các item hợp lệ
    const validItems = rawItems
      .filter((item) => typeof item.taskId === 'string' && typeof item.toUserId === 'string')
      .map((item) => ({
        taskId: item.taskId.trim(),
        toUserId: item.toUserId.trim(),
      }));

    if (validItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Không tìm thấy mục điều chuyển hợp lệ (cần taskId và toUserId).',
      });
      return;
    }

    // Thực hiện trong Prisma Transaction để đảm bảo tính toàn vẹn
    const updatedTasks = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of validItems) {
        // Kiểm tra task và người nhận
        const existingTask = await tx.task.findUnique({
          where: { id: item.taskId },
          include: {
            assignee: { select: { id: true, name: true } },
          },
        });

        const targetUser = await tx.user.findUnique({
          where: { id: item.toUserId },
          select: { id: true, name: true, email: true, avatar: true },
        });

        if (!existingTask || !targetUser) {
          continue;
        }

        const oldAssigneeName = existingTask.assignee?.name || 'Chưa phân công';

        // Cập nhật người phụ trách mới
        const updated = await tx.task.update({
          where: { id: item.taskId },
          data: {
            assigneeId: item.toUserId,
          },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatar: true, role: true } },
            creator: { select: { id: true, name: true, avatar: true } },
            milestone: { select: { id: true, title: true } },
            dependencies: {
              include: {
                dependsOnTask: { select: { id: true, title: true, status: true } },
              },
            },
            dependedBy: {
              include: {
                task: { select: { id: true, title: true, status: true } },
              },
            },
            checklists: true,
            _count: {
              select: {
                comments: true,
                attachments: true,
                subtasks: true,
              },
            },
          },
        });

        // Ghi nhận vào ActivityLog
        await tx.activityLog.create({
          data: {
            userId: currentUserId,
            action: 'REASSIGN_TASK',
            entityType: 'TASK',
            entityId: existingTask.id,
            description: `Được AI điều phối cân bằng tải sang ${targetUser.name} (trước đó: ${oldAssigneeName})`,
            metadata: {
              projectId,
              taskId: existingTask.id,
              taskTitle: existingTask.title,
              fromUserId: existingTask.assigneeId,
              fromUserName: oldAssigneeName,
              toUserId: targetUser.id,
              toUserName: targetUser.name,
              rebalancedBy: 'AI_OPTIMIZATION',
            },
          },
        });

        results.push(updated);
      }

      return results;
    });

    // Phát sự kiện qua Socket.IO Realtime
    const io = req.app?.get ? req.app.get('io') : null;
    if (io) {
      const eventPayload = {
        projectId,
        rebalancedBy: req.user.name,
        rebalancedCount: updatedTasks.length,
        timestamp: new Date().toISOString(),
      };

      // Sự kiện workload_rebalanced theo yêu cầu đề bài
      io.to(`project:${projectId}`).emit('workload_rebalanced', eventPayload);
      io.emit('workload_rebalanced', eventPayload);

      // Đồng thời cập nhật từng task để bảng Kanban hiển thị ngay người phụ trách mới
      for (const t of updatedTasks) {
        io.to(`project:${projectId}`).emit('task:updated', t);
        io.to(`project:${projectId}`).emit('task_updated', {
          taskId: t.id,
          task: t,
          updatedBy: currentUserId,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `✨ Đã áp dụng điều phối cân bằng tải thành công cho ${updatedTasks.length} công việc!`,
      data: {
        appliedCount: updatedTasks.length,
        tasks: updatedTasks,
      },
    });
  } catch (error: any) {
    console.error('[applyWorkloadRebalance] Lỗi:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi áp dụng điều chuyển cân bằng tải.',
      error: error?.message,
    });
  }
};

