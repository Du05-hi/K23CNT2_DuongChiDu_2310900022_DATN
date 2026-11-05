import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { createNotification, sendRealtimeNotification } from '../services/notificationService';
import { logActivity } from '../services/activityLogService';
import { generateContentWithFallback } from '../services/geminiService';

/**
 * Tự động tạo phiếu đề xuất mẫu đại diện cho 3 vai trò nếu bảng ApprovalRequest còn rỗng
 */
async function autoSeedApprovalsIfEmpty(): Promise<void> {
  try {
    const count = await prisma.approvalRequest.count();
    if (count > 0) return;

    // Lấy người dùng thực tế
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, email: true },
    });

    if (users.length === 0) return;

    const admin = users.find((u) => u.role === 'ADMIN') || users[0];
    const manager = users.find((u) => u.role === 'MANAGER') || users[0];
    const employee = users.find((u) => u.role === 'EMPLOYEE') || users[0];
    const employee2 = users.find((u) => u.role === 'EMPLOYEE' && u.id !== employee.id) || employee;

    // Tìm một task để liên kết gia hạn deadline
    const sampleTask =
      (await prisma.task.findFirst({
        where: { assigneeId: employee.id },
        select: { id: true, title: true, dueDate: true },
      })) ||
      (await prisma.task.findFirst({
        select: { id: true, title: true, dueDate: true },
      }));

    const now = new Date();

    const sampleRequests = [
      {
        title: 'Xin nghỉ phép 2 ngày giải quyết việc gia đình',
        type: 'LEAVE',
        description:
          'Tôi xin phép nghỉ từ thứ 5 đến hết thứ 6 tuần này để về quê giải quyết việc gia đình đột xuất. Công việc và các task phụ trách đã được phân công và bàn giao cho đồng nghiệp hỗ trợ.',
        priority: 'MEDIUM',
        status: 'PENDING',
        requesterId: employee.id,
        startDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Đăng ký làm thêm giờ (OT) tối thứ 6 hoàn thiện Module',
        type: 'OT',
        description:
          'Đăng ký làm thêm 3 giờ ngoài giờ (18:30 - 21:30) tối thứ 6 để hoàn tất tích hợp hệ thống kiểm duyệt quy trình và kiểm thử bảo mật API cho đợt triển khai sắp tới.',
        priority: 'HIGH',
        status: 'APPROVED',
        requesterId: employee2.id,
        reviewerId: manager.id,
        responseNote:
          'Đã phê duyệt. Đề nghị bạn chú ý an toàn lao động và ghi nhận đúng giờ công trên hệ thống chấm công.',
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        title: `Đề xuất gia hạn Deadline ${sampleTask ? `task "${sampleTask.title}"` : 'công việc phát triển'}`,
        type: 'EXTEND_DEADLINE',
        description:
          'Do khách hàng cập nhật đặc tả yêu cầu bổ sung luồng phê duyệt đa cấp và kiểm soát bảo mật, xin phép ban quản lý dự án cho gia hạn thêm 3 ngày để hoàn thành toàn diện kiểm thử tự động.',
        priority: 'URGENT',
        status: 'PENDING',
        requesterId: employee.id,
        taskId: sampleTask ? sampleTask.id : null,
        startDate: new Date(),
        endDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Đề xuất cấp màn hình phụ 4K và tài khoản Cloud GPU',
        type: 'RESOURCE',
        description:
          'Đề xuất phòng Hành chính & IT cấp thêm 01 màn hình Dell UltraSharp 27 inch 4K và 01 tài khoản AWS Cloud EC2 GPU để phục vụ công tác huấn luyện mô hình AI Assistant & tối ưu hóa hiệu năng.',
        priority: 'MEDIUM',
        status: 'APPROVED',
        requesterId: manager.id,
        reviewerId: admin.id,
        responseNote:
          'Đã phê duyệt cấp phát thiết bị và tài nguyên Cloud theo ngân sách quý 4 của phòng kỹ thuật.',
        startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const req of sampleRequests) {
      await prisma.approvalRequest.create({ data: req });
    }
  } catch (err) {
    console.warn('Lỗi autoSeedApprovalsIfEmpty:', err);
  }
}

/**
 * 1. GET /api/approvals - Lấy danh sách đề xuất theo phân quyền & kèm metrics
 */
export const getApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    // Tự tạo dữ liệu mẫu nếu chưa có
    await autoSeedApprovalsIfEmpty();

    const { status, type, priority, search } = req.query;

    // Xây dựng điều kiện lọc theo phân quyền
    let userFilter: Record<string, any> = {};

    if (user.role === 'ADMIN') {
      // ADMIN: Xem toàn bộ đề xuất công ty
      userFilter = {};
    } else if (user.role === 'MANAGER') {
      // MANAGER: Xem đề xuất của chính mình VÀ của thành viên trong dự án/phòng ban mình phụ trách
      const managedProjects = await prisma.project.findMany({
        where: {
          OR: [
            { createdById: user.id },
            { members: { some: { userId: user.id, role: 'PROJECT_MANAGER' } } },
            ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
          ],
        },
        select: {
          members: { select: { userId: true } },
          tasks: { select: { assigneeId: true } },
        },
      });

      const memberIds = new Set<string>([user.id]);
      managedProjects.forEach((p) => {
        p.members.forEach((m) => memberIds.add(m.userId));
        p.tasks.forEach((t) => {
          if (t.assigneeId) memberIds.add(t.assigneeId);
        });
      });

      if (user.departmentId) {
        const deptUsers = await prisma.user.findMany({
          where: { departmentId: user.departmentId },
          select: { id: true },
        });
        deptUsers.forEach((u) => memberIds.add(u.id));
      }

      userFilter = { requesterId: { in: Array.from(memberIds) } };
    } else {
      // EMPLOYEE: Chỉ xem đề xuất do chính mình tạo
      userFilter = { requesterId: user.id };
    }

    // Điều kiện lọc query bổ sung
    const whereClause: Record<string, any> = { ...userFilter };

    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status;
    }
    if (type && typeof type === 'string' && type !== 'ALL') {
      whereClause.type = type;
    }
    if (priority && typeof priority === 'string' && priority !== 'ALL') {
      whereClause.priority = priority;
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      whereClause.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
        { requester: { name: { contains: search.trim() } } },
      ];
    }

    // Lấy danh sách đề xuất
    const approvals = await prisma.approvalRequest.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { name: true } },
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            status: true,
            priority: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Tính toán Top Metrics Cards dựa trên quyền của user
    const [totalCount, pendingCount, approvedCount, rejectedCount, cancelledCount] =
      await Promise.all([
        prisma.approvalRequest.count({
          where: Object.keys(userFilter).length > 0 ? userFilter : undefined,
        }),
        prisma.approvalRequest.count({ where: { ...userFilter, status: 'PENDING' } }),
        prisma.approvalRequest.count({ where: { ...userFilter, status: 'APPROVED' } }),
        prisma.approvalRequest.count({ where: { ...userFilter, status: 'REJECTED' } }),
        prisma.approvalRequest.count({ where: { ...userFilter, status: 'CANCELLED' } }),
      ]);

    const stats = {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      cancelled: cancelledCount,
      total: totalCount,
    };

    res.status(200).json({
      success: true,
      data: approvals,
      stats,
      metrics: stats,
    });
    return;
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách phê duyệt:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách đề xuất phê duyệt.',
      error: error?.message,
    });
  }
};

/**
 * 2. POST /api/approvals - Tạo đề xuất mới
 */
export const createApproval = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { title, type, description, priority, startDate, endDate, taskId } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ success: false, message: 'Tiêu đề đề xuất là bắt buộc.' });
      return;
    }

    const validTypes = ['LEAVE', 'OT', 'EXTEND_DEADLINE', 'RESOURCE'];
    if (!type || !validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Loại đề xuất không hợp lệ (hỗ trợ LEAVE, OT, EXTEND_DEADLINE, RESOURCE).',
      });
      return;
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      res.status(400).json({ success: false, message: 'Mô tả chi tiết đề xuất là bắt buộc.' });
      return;
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const chosenPriority = validPriorities.includes(priority) ? priority : 'MEDIUM';

    // Nếu là gia hạn deadline thì kiểm tra task
    let linkedTaskId: string | null = null;
    if (type === 'EXTEND_DEADLINE') {
      if (!taskId) {
        res.status(400).json({
          success: false,
          message: 'Vui lòng chọn công việc cần gia hạn deadline.',
        });
        return;
      }
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, title: true, dueDate: true },
      });
      if (!task) {
        res.status(404).json({ success: false, message: 'Công việc liên quan không tồn tại.' });
        return;
      }
      linkedTaskId = task.id;
    }

    const newApproval = await prisma.approvalRequest.create({
      data: {
        title: title.trim(),
        type,
        description: description.trim(),
        priority: chosenPriority,
        status: 'PENDING',
        requesterId: user.id,
        taskId: linkedTaskId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { name: true } },
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Gửi thông báo đến quản trị viên hoặc quản lý
    const managersAndAdmins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        id: { not: user.id },
      },
      select: { id: true },
    });

    const io = req.app.get('io');
    for (const approver of managersAndAdmins) {
      try {
        const notif = await createNotification({
          userId: approver.id,
          type: 'SYSTEM',
          title: `Đề xuất mới chờ phê duyệt: ${newApproval.title}`,
          message: `${user.name || 'Một nhân viên'} đã gửi đề xuất [${newApproval.type}] cần bạn xem xét phê duyệt.`,
          relatedId: newApproval.id,
        });
        sendRealtimeNotification(io, approver.id, notif);
      } catch (err) {
        console.warn('Lỗi gửi notification đề xuất:', err);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Tạo đề xuất thành công và đã gửi tới người quản lý.',
      data: newApproval,
    });
  } catch (error: any) {
    console.error('Lỗi khi tạo đề xuất:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo đề xuất phê duyệt.',
      error: error?.message,
    });
  }
};

/**
 * 3. PATCH /api/approvals/:id/review - Duyệt, từ chối hoặc điều chỉnh lại quyết định xét duyệt (ADMIN, MANAGER)
 * Body: { action: 'APPROVE' | 'REJECT' | 'RESET_PENDING', responseNote?: string }
 */
export const reviewApproval = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền phê duyệt đề xuất (chỉ ADMIN hoặc MANAGER).',
      });
      return;
    }

    const { id } = req.params;
    const rawAction =
      req.body.action ||
      (req.body.status === 'APPROVED'
        ? 'APPROVE'
        : req.body.status === 'REJECTED'
        ? 'REJECT'
        : req.body.status === 'PENDING'
        ? 'RESET_PENDING'
        : req.body.status);
    const action = String(rawAction || '').trim().toUpperCase();
    const responseNote = req.body.responseNote ? String(req.body.responseNote).trim() : '';

    if (!['APPROVE', 'REJECT', 'RESET_PENDING'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Hành động không hợp lệ (hỗ trợ APPROVE, REJECT hoặc RESET_PENDING).',
      });
      return;
    }

    // Nếu REJECT: Bắt buộc responseNote không được để trống (tối thiểu 5 ký tự)
    if (action === 'REJECT' && responseNote.length < 5) {
      res.status(400).json({
        success: false,
        message: 'Lý do từ chối là bắt buộc và phải có tối thiểu 5 ký tự để nhân sự nắm được lý do.',
      });
      return;
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        task: true,
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!approval) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất phê duyệt này.' });
      return;
    }

    const previousStatus = approval.status;
    const isReReview = previousStatus !== 'PENDING';

    let newStatus = 'PENDING';
    let newReviewerId: string | null = user.id;
    let newResponseNote: string | null = null;

    if (action === 'APPROVE') {
      newStatus = 'APPROVED';
      newResponseNote = responseNote || 'Đã phê duyệt.';
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
      newResponseNote = responseNote;
    } else if (action === 'RESET_PENDING') {
      newStatus = 'PENDING';
      newReviewerId = null;
      newResponseNote = null;
    }

    // Cập nhật phê duyệt trong database
    const updatedApproval = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        responseNote: newResponseNote,
        reviewerId: newReviewerId,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { name: true } },
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    // TÍNH NĂNG THÔNG MINH (TASK INTEGRATION):
    // Nếu đề xuất là EXTEND_DEADLINE và được APPROVE, tự động cập nhật dueDate của Task liên quan sang ngày đề xuất mới
    if (approval.type === 'EXTEND_DEADLINE' && action === 'APPROVE' && approval.taskId && approval.endDate) {
      try {
        await prisma.task.update({
          where: { id: approval.taskId },
          data: {
            dueDate: approval.endDate,
          },
        });

        // Ghi nhật ký hoạt động
        if (approval.task?.id) {
          await logActivity({
            userId: user.id,
            action: 'UPDATE_TASK',
            entityType: 'TASK',
            entityId: approval.task.id,
            description: `Phê duyệt gia hạn deadline task "${approval.task.title}" đến ngày ${new Date(
              approval.endDate
            ).toLocaleDateString('vi-VN')}`,
          }).catch((e) => console.warn('Lỗi ghi log gia hạn:', e));
        }
      } catch (taskErr) {
        console.warn('Lỗi tự động cập nhật deadline task:', taskErr);
      }
    }

    // Ghi nhận nhật ký khi thay đổi quyết định (Re-evaluate)
    if (isReReview) {
      await logActivity({
        userId: user.id,
        action: 'UPDATE_APPROVAL',
        entityType: 'APPROVAL',
        entityId: approval.id,
        description: `Cập nhật lại quyết định xét duyệt đề xuất "${approval.title}" từ ${previousStatus} sang ${newStatus}`,
      }).catch((e) => console.warn('Lỗi ghi log re-evaluate:', e));
    }

    // Gửi thông báo thời gian thực cho người tạo đơn kèm lời nhắn phản hồi
    let notifTitle = '';
    let notifMessage = '';

    if (action === 'RESET_PENDING') {
      notifTitle = '🔄 Đề xuất đã được khôi phục về Chờ duyệt';
      notifMessage = `${user.name || 'Cấp trên'} đã khôi phục đề xuất "${approval.title}" về trạng thái Chờ phê duyệt để thẩm định lại.`;
    } else if (isReReview) {
      const statusText = newStatus === 'APPROVED' ? 'Đã phê duyệt' : 'Bị từ chối';
      notifTitle = '🔄 Quyết định xét duyệt đã được cập nhật lại!';
      notifMessage = `${user.name || 'Cấp trên'} đã cập nhật lại quyết định cho đề xuất "${approval.title}" thành [${statusText}].${
        responseNote ? ` Lời nhắn phản hồi: ${responseNote}` : ''
      }`;
    } else {
      const isApproved = action === 'APPROVE';
      notifTitle = isApproved ? '✅ Đề xuất của bạn đã được phê duyệt!' : '❌ Đề xuất của bạn đã bị từ chối';
      notifMessage = `${user.name || 'Cấp trên'} đã ${isApproved ? 'phê duyệt' : 'từ chối'} đề xuất "${approval.title}".${
        responseNote ? ` Lời nhắn phản hồi: ${responseNote}` : ''
      }`;
    }

    try {
      const io = req.app.get('io');
      const notif = await createNotification({
        userId: approval.requesterId,
        type: 'SYSTEM',
        title: notifTitle,
        message: notifMessage,
        relatedId: approval.id,
      });
      sendRealtimeNotification(io, approval.requesterId, notif);
    } catch (notifErr) {
      console.warn('Lỗi tạo notification kết quả duyệt:', notifErr);
    }

    const actionText =
      action === 'APPROVE'
        ? 'phê duyệt'
        : action === 'REJECT'
        ? 'từ chối'
        : 'khôi phục về chờ duyệt';

    res.status(200).json({
      success: true,
      message: `Đã ${actionText} đề xuất thành công.`,
      data: updatedApproval,
    });
  } catch (error: any) {
    console.error('Lỗi khi phê duyệt đề xuất:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xử lý phê duyệt đề xuất.',
      error: error?.message,
    });
  }
};

/**
 * 4. PATCH /api/approvals/:id/cancel - Người tạo đơn tự hủy yêu cầu khi còn PENDING
 */
export const cancelApproval = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { id } = req.params;
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { id: true, requesterId: true, status: true, title: true },
    });

    if (!approval) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất cần hủy.' });
      return;
    }

    // Chỉ người tạo đơn mới có quyền tự hủy (ADMIN cũng có thể hỗ trợ hủy)
    if (approval.requesterId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy đề xuất này (chỉ người tạo đơn mới có quyền hủy).',
      });
      return;
    }

    // Chỉ cho phép hủy khi đơn vẫn ở trạng thái PENDING
    if (approval.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: 'Không thể hủy đề xuất đã được xử lý (chỉ được hủy khi trạng thái là Chờ duyệt - PENDING).',
      });
      return;
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Đã hủy đề xuất thành công.',
      data: updated,
    });
  } catch (error: any) {
    console.error('Lỗi khi hủy đề xuất:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể hủy đề xuất.',
      error: error?.message,
    });
  }
};

/**
 * 5. POST /api/approvals/batch-review - Phê duyệt / Từ chối hàng loạt bằng Prisma $transaction (ADMIN, MANAGER)
 * Body: { ids: string[], action: 'APPROVE' | 'REJECT', responseNote?: string }
 */
export const batchReviewApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền phê duyệt hàng loạt (chỉ ADMIN hoặc MANAGER).',
      });
      return;
    }

    const { ids, action, responseNote } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 đề xuất để thao tác hàng loạt.',
      });
      return;
    }

    const cleanAction = String(action || '').trim().toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(cleanAction)) {
      res.status(400).json({
        success: false,
        message: 'Hành động không hợp lệ (chỉ hỗ trợ APPROVE hoặc REJECT).',
      });
      return;
    }

    const cleanNote = responseNote ? String(responseNote).trim() : '';
    if (cleanAction === 'REJECT' && cleanNote.length < 5) {
      res.status(400).json({
        success: false,
        message: 'Lý do từ chối hàng loạt là bắt buộc và phải có tối thiểu 5 ký tự.',
      });
      return;
    }

    // Tìm tất cả các đơn PENDING trong danh sách ids
    const pendingApprovals = await prisma.approvalRequest.findMany({
      where: {
        id: { in: ids },
        status: 'PENDING',
      },
      include: {
        task: true,
      },
    });

    if (pendingApprovals.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Không có đề xuất nào đang ở trạng thái Chờ duyệt (PENDING) để xử lý.',
      });
      return;
    }

    const newStatus = cleanAction === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const pendingIds = pendingApprovals.map((a) => a.id);

    // Thực hiện trong Prisma Transaction an toàn tuyệt đối
    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái các đề xuất
      await tx.approvalRequest.updateMany({
        where: { id: { in: pendingIds } },
        data: {
          status: newStatus,
          reviewerId: user.id,
          responseNote: cleanNote || (cleanAction === 'APPROVE' ? 'Phê duyệt hàng loạt.' : null),
        },
      });

      // 2. Nếu là APPROVE, tự động cập nhật dueDate cho các đơn EXTEND_DEADLINE
      if (cleanAction === 'APPROVE') {
        const extendRequests = pendingApprovals.filter(
          (a) => a.type === 'EXTEND_DEADLINE' && a.taskId && a.endDate
        );

        for (const ext of extendRequests) {
          if (ext.taskId && ext.endDate) {
            await tx.task.update({
              where: { id: ext.taskId },
              data: { dueDate: ext.endDate },
            });
          }
        }
      }
    });

    // 3. Gửi Realtime Notification cho từng người tạo đơn
    const io = req.app.get('io');
    const isApproved = cleanAction === 'APPROVE';
    const notifTitle = isApproved
      ? `✅ Đề xuất của bạn đã được phê duyệt!`
      : `❌ Đề xuất của bạn đã bị từ chối`;

    for (const appItem of pendingApprovals) {
      try {
        const notifMessage = `${user.name || 'Cấp trên'} đã ${isApproved ? 'phê duyệt' : 'từ chối'} đề xuất "${
          appItem.title
        }".${cleanNote ? ` Lời nhắn: ${cleanNote}` : ''}`;

        const notif = await createNotification({
          userId: appItem.requesterId,
          type: 'SYSTEM',
          title: notifTitle,
          message: notifMessage,
          relatedId: appItem.id,
        });
        sendRealtimeNotification(io, appItem.requesterId, notif);
      } catch (err) {
        console.warn('Lỗi gửi notification batch review:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: `Đã ${isApproved ? 'phê duyệt' : 'từ chối'} thành công ${pendingApprovals.length} đề xuất.`,
      processedCount: pendingApprovals.length,
    });
  } catch (error: any) {
    console.error('Lỗi khi xử lý thao tác hàng loạt:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xử lý thao tác hàng loạt.',
      error: error?.message,
    });
  }
};

/**
 * 6. POST /api/approvals/:id/ai-analyze - Thẩm định rủi ro và tác động của đề xuất bằng AI
 * Trả về: { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH', recommendation: string, summary: string }
 */
export const analyzeApprovalWithAI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { id } = req.params;
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: { select: { name: true } },
          },
        },
        task: {
          include: {
            project: { select: { id: true, name: true } },
            dependencies: true,
            dependedBy: true,
          },
        },
      },
    });

    if (!approval) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất cần phân tích.' });
      return;
    }

    // Lấy danh sách các task đang active của người gửi đơn để đánh giá xung đột tiến độ
    const activeTasks = await prisma.task.findMany({
      where: {
        assigneeId: approval.requesterId,
        status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    // Thẩm định Heuristic dự phòng chất lượng cao (Rule-based Enterprise Engine)
    let fallbackRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let fallbackSummary = '';
    let fallbackRecommendation = '';

    const reqStartDate = approval.startDate ? new Date(approval.startDate) : null;
    const reqEndDate = approval.endDate ? new Date(approval.endDate) : null;

    if (approval.type === 'LEAVE') {
      // Kiểm tra xem có task nào cận kề hoặc nằm trong khoảng ngày nghỉ không
      const conflictingTasks = activeTasks.filter((t) => {
        if (!t.dueDate || !reqStartDate || !reqEndDate) return false;
        const taskDue = new Date(t.dueDate);
        const bufferDays = 2 * 24 * 60 * 60 * 1000;
        return (
          (taskDue >= reqStartDate && taskDue <= reqEndDate) ||
          (taskDue.getTime() >= reqEndDate.getTime() &&
            taskDue.getTime() <= reqEndDate.getTime() + bufferDays)
        );
      });

      const highPriorityTasks = conflictingTasks.filter(
        (t) => t.priority === 'HIGH' || t.priority === 'URGENT'
      );

      if (highPriorityTasks.length > 0) {
        fallbackRiskLevel = 'HIGH';
        fallbackSummary = `Phát hiện rủi ro cao: Nhân sự có ${highPriorityTasks.length} công việc ưu tiên ${highPriorityTasks[0].priority} ("${highPriorityTasks[0].title}") có hạn chót rơi vào hoặc sát thời gian nghỉ phép.`;
        fallbackRecommendation = `Quản lý cần yêu cầu nhân sự bàn giao khẩn cấp công việc "${highPriorityTasks[0].title}" cho nhân sự khác hoặc đẩy nhanh hoàn thành trước khi nghỉ.`;
      } else if (conflictingTasks.length > 0) {
        fallbackRiskLevel = 'MEDIUM';
        fallbackSummary = `Nhân sự có ${conflictingTasks.length} công việc đang thực hiện ("${conflictingTasks[0].title}") có hạn chót trong đợt nghỉ phép.`;
        fallbackRecommendation = `Nên phê duyệt kèm điều kiện xác nhận bàn giao tiến độ cho thành viên khác trong nhóm phụ trách.`;
      } else {
        fallbackRiskLevel = 'LOW';
        fallbackSummary = `Lịch nghỉ phép không xung đột với các hạn chót công việc đang giao (${activeTasks.length} task đang phụ trách đều có tiến độ an toàn).`;
        fallbackRecommendation = `Đề xuất hợp lý, kế hoạch công việc đảm bảo an toàn. Đề xuất chấp thuận.`;
      }
    } else if (approval.type === 'EXTEND_DEADLINE') {
      if (approval.task) {
        const oldDue = approval.task.dueDate ? new Date(approval.task.dueDate) : new Date();
        const newDue = reqEndDate || new Date();
        const diffDays = Math.max(1, Math.ceil((newDue.getTime() - oldDue.getTime()) / (1000 * 60 * 60 * 24)));
        const isUrgent = approval.task.priority === 'URGENT' || approval.task.priority === 'HIGH';
        const hasBlockers = (approval.task.dependedBy && approval.task.dependedBy.length > 0);

        if (diffDays > 5 || (hasBlockers && isUrgent)) {
          fallbackRiskLevel = 'HIGH';
          fallbackSummary = `Yêu cầu lùi hạn thêm ${diffDays} ngày cho công việc ${approval.task.priority}. Việc trễ hạn này có thể làm gián đoạn các nhánh công việc kế tiếp của dự án "${approval.task.project?.name || ''}".`;
          fallbackRecommendation = `Khuyến nghị: Thay vì gia hạn dài ngày, nên cử thêm nhân sự hỗ trợ hoặc chia nhỏ task để giữ vững mốc bàn giao dự án.`;
        } else if (diffDays > 2) {
          fallbackRiskLevel = 'MEDIUM';
          fallbackSummary = `Gia hạn thêm ${diffDays} ngày đối với task "${approval.task.title}". Tác động ở mức vừa phải lên tiến độ chung.`;
          fallbackRecommendation = `Có thể phê duyệt, nhưng yêu cầu cập nhật tiến độ (Daily report) để kiểm soát chất lượng bàn giao.`;
        } else {
          fallbackRiskLevel = 'LOW';
          fallbackSummary = `Gia hạn thời gian ngắn (${diffDays} ngày) cho công việc "${approval.task.title}", tác động không đáng kể đến kế hoạch bàn giao.`;
          fallbackRecommendation = `Đề xuất chấp thuận gia hạn để đảm bảo chất lượng kiểm thử và độ hoàn thiện sản phẩm.`;
        }
      } else {
        fallbackRiskLevel = 'MEDIUM';
        fallbackSummary = `Đề xuất xin gia hạn nhưng chưa liên kết trực tiếp với mã công việc cụ thể trong hệ thống.`;
        fallbackRecommendation = `Yêu cầu nhân sự cung cấp mã task cần gia hạn để hệ thống tính toán chính xác mốc ảnh hưởng.`;
      }
    } else if (approval.type === 'OT') {
      fallbackRiskLevel = 'LOW';
      fallbackSummary = `Đăng ký làm thêm giờ (OT) nhằm tập trung tăng tốc giải phóng khối lượng công việc tồn đọng.`;
      fallbackRecommendation = `Khuyến nghị phê duyệt để đáp ứng tiến độ bàn giao, lưu ý tuân thủ quy định tối đa giờ làm thêm của doanh nghiệp.`;
    } else {
      // RESOURCE
      fallbackRiskLevel = 'LOW';
      fallbackSummary = `Đề xuất cấp thiết bị và tài nguyên phục vụ công tác kỹ thuật và nâng cao hiệu suất làm việc.`;
      fallbackRecommendation = `Đề xuất hợp lý. Quản lý có thể phê duyệt nếu phù hợp với định mức ngân sách của phòng ban.`;
    }

    // Cố gắng gọi Gemini AI với live context để tăng cường chiều sâu phân tích
    let aiResult = {
      riskLevel: fallbackRiskLevel,
      summary: fallbackSummary,
      recommendation: fallbackRecommendation,
    };

    try {
      const prompt = `
Bạn là Giám đốc Vận hành & Đánh giá Rủi ro Doanh nghiệp Cấp cao (Enterprise Operations & Risk Assessor).
Hãy thẩm định và phân tích mức độ rủi ro của đề xuất quy trình nội bộ sau:

THÔNG TIN ĐỀ XUẤT:
- Tiêu đề: "${approval.title}"
- Phân loại: ${approval.type} (${approval.type === 'LEAVE' ? 'Nghỉ phép' : approval.type === 'OT' ? 'Làm thêm giờ' : approval.type === 'EXTEND_DEADLINE' ? 'Gia hạn deadline' : 'Cấp tài nguyên'})
- Mức độ ưu tiên: ${approval.priority}
- Mô tả chi tiết: "${approval.description}"
- Thời gian bắt đầu: ${reqStartDate ? reqStartDate.toLocaleDateString('vi-VN') : 'Không có'}
- Thời gian kết thúc / Hạn mới: ${reqEndDate ? reqEndDate.toLocaleDateString('vi-VN') : 'Không có'}
- Người gửi: ${approval.requester.name} (${approval.requester.role}) - Phòng ban: ${approval.requester.department?.name || 'Chung'}
- Công việc liên quan trực tiếp: ${approval.task ? `"${approval.task.title}" (Hạn cũ: ${approval.task.dueDate ? new Date(approval.task.dueDate).toLocaleDateString('vi-VN') : 'N/A'}, Mức độ: ${approval.task.priority})` : 'Không'}
- Các công việc đang phụ trách trong hệ thống (${activeTasks.length} task):
${activeTasks.map((t, idx) => `  ${idx + 1}. "${t.title}" | Deadline: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'N/A'} | Ưu tiên: ${t.priority} | Trạng thái: ${t.status}`).join('\n')}

HƯỚNG DẪN ĐÁNH GIÁ:
1. Đánh giá rủi ro (riskLevel): Chỉ chọn 1 trong 3 mức "LOW", "MEDIUM", "HIGH".
   - HIGH: Có nguy cơ vỡ tiến độ dự án quan trọng, trùng deadline các task khẩn cấp, hoặc chậm trễ dây chuyền.
   - MEDIUM: Có rủi ro nhưng có thể quản lý được thông qua bàn giao hoặc theo dõi định kỳ.
   - LOW: Tác động tối thiểu, an toàn cho vận hành, hoàn toàn hợp lý.
2. Tóm tắt (summary): 1-2 câu tiếng Việt súc tích, phân tích trực diện vào số liệu ngày tháng và các task.
3. Khuyến nghị (recommendation): 1-2 câu tư vấn cho Quản lý/Ban Giám đốc (Nên duyệt, từ chối, hay duyệt có điều kiện).

YÊU CẦU ĐỊNH DẠNG TRẢ VỀ:
Chỉ trả về JSON thuần túy (không bọc trong \`\`\`json):
{
  "riskLevel": "LOW",
  "summary": "...",
  "recommendation": "..."
}
`;

      const response = await generateContentWithFallback(prompt);
      let cleanedText = response.text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanedText);
      if (parsed.riskLevel && ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.riskLevel.toUpperCase())) {
        aiResult = {
          riskLevel: parsed.riskLevel.toUpperCase(),
          summary: parsed.summary || fallbackSummary,
          recommendation: parsed.recommendation || fallbackRecommendation,
        };
      }
    } catch (aiErr) {
      console.warn('[AI Analyze] Không thể phân tích qua Gemini API, chuyển sang Heuristic Engine:', aiErr);
    }

    res.status(200).json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('Lỗi khi thẩm định AI đề xuất:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể phân tích đề xuất bằng AI.',
      error: error?.message,
    });
  }
};

/**
 * 7. DELETE /api/approvals/:id - Hủy hoặc xóa đề xuất
 */
export const deleteApproval = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { id } = req.params;
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { id: true, requesterId: true, status: true, title: true },
    });

    if (!approval) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất cần xóa.' });
      return;
    }

    // Người tạo chỉ được xóa/hủy khi đang PENDING, ADMIN có quyền xóa mọi lúc
    const isCreator = approval.requesterId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isAdmin) {
      if (!isCreator) {
        res.status(403).json({ success: false, message: 'Bạn không có quyền xóa đề xuất này.' });
        return;
      }
      if (approval.status !== 'PENDING') {
        res.status(400).json({
          success: false,
          message: 'Không thể xóa đề xuất đã được xử lý (đã duyệt hoặc bị từ chối).',
        });
        return;
      }
    }

    await prisma.approvalRequest.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Đã xóa đề xuất thành công.',
    });
  } catch (error: any) {
    console.error('Lỗi khi xóa đề xuất:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa đề xuất.',
      error: error?.message,
    });
  }
};

/**
 * 8. GET /api/approvals/my-tasks - Lấy danh sách task của user phục vụ chọn khi tạo đề xuất gia hạn
 */
export const getMyTasksForApproval = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: {
        OR: [{ assigneeId: user.id }, { createdById: user.id }],
        status: { not: 'DONE' },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách task:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách công việc.',
      error: error?.message,
    });
  }
};
