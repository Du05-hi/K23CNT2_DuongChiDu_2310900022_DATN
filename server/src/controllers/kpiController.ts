import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';

/**
 * 0. Lấy KPI cá nhân của user đang đăng nhập
 * - Lịch sử các kỳ KPI
 * - Các task đã hoàn thành tháng này
 * - So sánh với trung bình team
 */
export const getMyKpi = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực.' });
      return;
    }

    const { period } = req.query;
    const currentPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Lấy thông tin user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    // KPI record kỳ hiện tại
    const currentKpi = await prisma.kpiLog.findUnique({
      where: { userId_period: { userId, period: currentPeriod } },
    });

    // Lịch sử KPI 6 tháng gần nhất
    const kpiHistory = await prisma.kpiLog.findMany({
      where: { userId },
      orderBy: { period: 'desc' },
      take: 12,
    });

    // Trung bình team (cùng phòng ban nếu có)
    const teamKpiLogs = await prisma.kpiLog.findMany({
      where: {
        period: currentPeriod,
        user: user.departmentId ? { departmentId: user.departmentId } : undefined,
      },
    });

    const teamAvg =
      teamKpiLogs.length > 0
        ? Math.round(
            (teamKpiLogs.reduce((acc, k) => acc + k.totalScore, 0) / teamKpiLogs.length) * 10
          ) / 10
        : 0;

    // Vị trí xếp hạng trong team
    const myRankInTeam =
      teamKpiLogs.filter((k) => k.totalScore > (currentKpi?.totalScore || 0)).length + 1;

    // Tasks đang được giao
    const [yearStr, monthStr] = currentPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const myTasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const myActiveTasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        currentPeriod,
        currentKpi,
        kpiHistory,
        teamStats: {
          teamAvg,
          teamSize: teamKpiLogs.length,
          myRankInTeam,
        },
        myTasks: {
          thisMonth: myTasks,
          active: myActiveTasks,
        },
      },
    });
  } catch (error: any) {
    console.error('Lỗi getMyKpi:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy KPI cá nhân.',
      error: error.message,
    });
  }
};

/**
 * Hàm phụ trợ xác định hạng rank dựa trên tổng điểm
 */
function determineRank(totalScore: number): string {
  if (totalScore >= 90) return 'A (Xuất sắc)';
  if (totalScore >= 75) return 'B (Tốt)';
  if (totalScore >= 60) return 'C (Khá)';
  return 'D (Cần cải thiện)';
}

/**
 * 1. Tính toán KPI cho toàn bộ nhân viên trong một kỳ (period: YYYY-MM)
 * Điểm = (tasksCompleted * 10) + (tasksOnTime / tasksCompleted * 50) + bonus
 */
export const calculateKPI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const requestedPeriod = req.body?.period;
    let period: string;
    if (requestedPeriod === undefined) {
      const now = new Date();
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (
      typeof requestedPeriod === 'string' &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod)
    ) {
      period = requestedPeriod;
    } else {
      res.status(400).json({ success: false, message: 'Kỳ KPI không hợp lệ. Định dạng yêu cầu: YYYY-MM.' });
      return;
    }

    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const userWhere: any = { isActive: true, role: 'EMPLOYEE' };
    if (req.user?.role === 'MANAGER') {
      userWhere.departmentId = req.user.departmentId || '__no_department__';
    } else if (
      req.user?.role === 'ADMIN' &&
      typeof req.body?.departmentId === 'string' &&
      req.body.departmentId !== 'ALL'
    ) {
      userWhere.departmentId = req.body.departmentId;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      include: { department: true },
    });

    const completedTasks = users.length
      ? await prisma.task.findMany({
          where: {
            assigneeId: { in: users.map((user) => user.id) },
            status: 'DONE',
            updatedAt: { gte: startOfMonth, lte: endOfMonth },
          },
        })
      : [];
    const tasksByUser = new Map<string, typeof completedTasks>();
    for (const task of completedTasks) {
      if (!task.assigneeId) continue;
      const userTasks = tasksByUser.get(task.assigneeId) ?? [];
      userTasks.push(task);
      tasksByUser.set(task.assigneeId, userTasks);
    }

    const calculatedResults = await Promise.all(users.map(async (user) => {
      const userTasks = tasksByUser.get(user.id) ?? [];
      const tasksCompleted = userTasks.length;
      let tasksOnTime = 0;
      let bonus = 0;

      for (const t of userTasks) {
        const onTime = !t.dueDate || new Date(t.updatedAt) <= new Date(t.dueDate);
        if (onTime) {
          tasksOnTime++;
          if (t.priority === 'URGENT') bonus += 2;
          else if (t.priority === 'HIGH') bonus += 1;
        }
      }

      const onTimeRatio = tasksCompleted > 0 ? tasksOnTime / tasksCompleted : 0;
      const baseCompletionScore = tasksCompleted * 10;
      const onTimeScore = onTimeRatio * 50;

      let totalScore = Math.round((baseCompletionScore + onTimeScore + bonus) * 10) / 10;
      if (totalScore > 100) totalScore = 100;

      const rank = determineRank(totalScore);

      await prisma.kpiLog.upsert({
        where: {
          userId_period: {
            userId: user.id,
            period,
          },
        },
        update: {
          tasksCompleted,
          tasksOnTime,
          totalScore,
          rank,
          details: {
            bonus,
            onTimeRatio: Math.round(onTimeRatio * 100),
            taskIds: userTasks.map((t) => t.id),
          },
        },
        create: {
          userId: user.id,
          period,
          tasksCompleted,
          tasksOnTime,
          totalScore,
          rank,
          details: {
            bonus,
            onTimeRatio: Math.round(onTimeRatio * 100),
            taskIds: userTasks.map((t) => t.id),
          },
        },
      });

      return {
        userId: user.id,
        userName: user.name,
        department: user.department?.name || 'Chưa phân bổ',
        period,
        tasksCompleted,
        tasksOnTime,
        totalScore,
        rank,
      };
    }));

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'KPI_CALCULATED',
        entityType: 'KPI',
        entityId: period,
        description: `Thực hiện tính toán và cập nhật KPI cho ${users.length} nhân viên kỳ ${period}`,
        metadata: { period, userCount: users.length, departmentId: req.user?.role === 'MANAGER' ? req.user.departmentId : req.body?.departmentId },
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã tính toán và cập nhật KPI thành công cho kỳ ${period}!`,
      totalUsers: calculatedResults.length,
      data: calculatedResults,
    });
  } catch (error: any) {
    console.error('Lỗi calculateKPI:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tính KPI.',
      error: error.message,
    });
  }
};

/**
 * 2. Lấy Dashboard KPI tổng quan, Top Performers, dữ liệu biểu đồ xu hướng
 */
export const getKpiDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { period } = req.query;

    const currentPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const userScope: any = user?.role === 'ADMIN'
      ? {}
      : user?.role === 'MANAGER'
      ? { departmentId: user.departmentId || '__no_department__' }
      : { id: user?.id };
    const kpiLogs = await prisma.kpiLog.findMany({
      where: { period: currentPeriod, user: userScope },
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
      orderBy: { totalScore: 'desc' },
    });

    const totalEvaluated = kpiLogs.length;
    const avgScore =
      totalEvaluated > 0
        ? Math.round(
            (kpiLogs.reduce((acc, curr) => acc + curr.totalScore, 0) / totalEvaluated) * 10
          ) / 10
        : 0;

    const rankDistribution = {
      A: kpiLogs.filter((k) => k.rank.startsWith('A')).length,
      B: kpiLogs.filter((k) => k.rank.startsWith('B')).length,
      C: kpiLogs.filter((k) => k.rank.startsWith('C')).length,
      D: kpiLogs.filter((k) => k.rank.startsWith('D')).length,
    };

    const topPerformers = kpiLogs.slice(0, 5);

    // Xu hướng 6 tháng gần nhất
    const trendLogs = await prisma.kpiLog.findMany({
      where: { user: userScope },
      take: 100,
      orderBy: { period: 'desc' },
      select: { period: true, totalScore: true },
    });

    const monthlyTrends: Record<string, { total: number; count: number }> = {};
    for (const log of trendLogs) {
      if (!monthlyTrends[log.period]) {
        monthlyTrends[log.period] = { total: 0, count: 0 };
      }
      monthlyTrends[log.period].total += log.totalScore;
      monthlyTrends[log.period].count += 1;
    }

    const trendData = Object.keys(monthlyTrends)
      .sort()
      .slice(-6)
      .map((p) => ({
        period: p,
        averageScore: Math.round((monthlyTrends[p].total / monthlyTrends[p].count) * 10) / 10,
      }));

    res.status(200).json({
      success: true,
      data: {
        period: currentPeriod,
        summary: {
          totalEvaluated,
          averageScore: avgScore,
          rankDistribution,
        },
        topPerformers,
        trends: trendData,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getKpiDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy dữ liệu KPI Dashboard.',
      error: error.message,
    });
  }
};

export const getKpiReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const period = typeof req.query.period === 'string'
      ? req.query.period
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    const userScope: any = { role: 'EMPLOYEE', isActive: true };

    if (user?.role === 'EMPLOYEE') {
      userScope.id = user.id;
    } else if (user?.role === 'MANAGER') {
      userScope.departmentId = user.departmentId || '__no_department__';
    } else if (departmentId && departmentId !== 'ALL') {
      userScope.departmentId = departmentId;
    }

    const entries = await prisma.kpiLog.findMany({
      where: { period, user: userScope },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ totalScore: 'desc' }, { tasksCompleted: 'desc' }],
    });

    res.status(200).json({
      success: true,
      data: entries.map((entry) => ({
        id: entry.user.id,
        name: entry.user.name,
        avatar: entry.user.avatar,
        departmentId: entry.user.departmentId,
        department: entry.user.department?.name || 'Chưa phân bổ',
        tasksCompleted: entry.tasksCompleted,
        tasksOnTime: entry.tasksOnTime,
        qualityScore: entry.tasksCompleted
          ? Math.round((entry.tasksOnTime / entry.tasksCompleted) * 100)
          : 0,
        scoreBreakdown: {
          taskCompletion: entry.tasksCompleted * 10,
          onTime: entry.tasksCompleted
            ? Math.round((entry.tasksOnTime / entry.tasksCompleted) * 50 * 10) / 10
            : 0,
          bonus:
            entry.details &&
            typeof entry.details === 'object' &&
            !Array.isArray(entry.details) &&
            typeof entry.details.bonus === 'number'
              ? entry.details.bonus
              : 0,
        },
        kpiScore: entry.totalScore,
        rank: entry.rank.split(' ')[0],
        badges: [],
      })),
    });
  } catch (error: any) {
    console.error('Lỗi getKpiReport:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy báo cáo KPI.',
      error: error.message,
    });
  }
};

/**
 * 3. Lịch sử KPI của một người dùng theo nhiều tháng
 */
export const getUserKpiHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, departmentId: true, department: true },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    if (
      req.user?.role === 'EMPLOYEE' && req.user.id !== userId ||
      req.user?.role === 'MANAGER' && req.user.departmentId !== user.departmentId
    ) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch sử KPI này.' });
      return;
    }

    const history = await prisma.kpiLog.findMany({
      where: { userId },
      orderBy: { period: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        history,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getUserKpiHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy lịch sử KPI của người dùng.',
      error: error.message,
    });
  }
};

/**
 * 4. Bảng xếp hạng thi đua (Leaderboard) theo tháng
 */
export const getLeaderboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { period } = req.query;

    const targetPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const leaderboard = await prisma.kpiLog.findMany({
      where: {
        period: targetPeriod,
        user: user?.role === 'ADMIN'
          ? {}
          : user?.role === 'MANAGER'
          ? { departmentId: user.departmentId || '__no_department__' }
          : { id: user?.id },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
            role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ totalScore: 'desc' }, { tasksCompleted: 'desc' }],
    });

    const rankedList = leaderboard.map((item, index) => ({
      position: index + 1,
      ...item,
    }));

    res.status(200).json({
      success: true,
      period: targetPeriod,
      data: rankedList,
    });
  } catch (error: any) {
    console.error('Lỗi getLeaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy bảng xếp hạng KPI.',
      error: error.message,
    });
  }
};

/**
 * 5. Xuất báo cáo KPI ra file Excel (.xlsx) chuẩn hóa bằng ExcelJS
 * - Sheet 1: Bảng tổng hợp tất cả nhân viên
 * - Sheet 2: Chi tiết các công việc hoàn thành của từng nhân viên
 * - Styling: Header màu xanh, alternating row colors, auto column widths
 */
export const exportKpiExcel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { period } = req.query;

    const targetPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const userWhere: any = { role: 'EMPLOYEE', isActive: true };
    if (req.user?.role === 'MANAGER') {
        userWhere.departmentId = req.user.departmentId || '__no_department__';
    } else if (
        req.user?.role === 'ADMIN' &&
        typeof req.query.departmentId === 'string' &&
        req.query.departmentId !== 'ALL'
    ) {
        userWhere.departmentId = req.query.departmentId;
    }

    const kpiLogs = await prisma.kpiLog.findMany({
        where: { period: targetPeriod, user: userWhere },
      include: {
        user: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Work & KPI System';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: BẢNG TỔNG HỢP KPI NHÂN VIÊN
    // ==========================================
    const summarySheet = workbook.addWorksheet('Tổng Hợp KPI');

    summarySheet.columns = [
      { header: 'Hạng', key: 'rankPos', width: 8 },
      { header: 'Mã Nhân Viên', key: 'userId', width: 20 },
      { header: 'Họ và Tên', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phòng Ban', key: 'department', width: 20 },
      { header: 'Công Việc Hoàn Thành', key: 'tasksCompleted', width: 22 },
      { header: 'Đúng Hạn (On-time)', key: 'tasksOnTime', width: 20 },
      { header: 'Tỷ Lệ Đúng Hạn (%)', key: 'onTimeRate', width: 20 },
      { header: 'Tổng Điểm KPI', key: 'totalScore', width: 15 },
      { header: 'Xếp Loại', key: 'rank', width: 18 },
    ];

    // Style Header Sheet 1
    const headerRow1 = summarySheet.getRow(1);
    headerRow1.height = 26;
    headerRow1.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' }, // Xanh dương đậm chuẩn Material
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    // Điền dữ liệu và tạo Alternating rows
    kpiLogs.forEach((log, index) => {
      const onTimeRate =
        log.tasksCompleted > 0
          ? `${Math.round((log.tasksOnTime / log.tasksCompleted) * 100)}%`
          : '0%';

      const row = summarySheet.addRow({
        rankPos: index + 1,
        userId: log.user.id.slice(0, 8),
        name: log.user.name,
        email: log.user.email,
        department: log.user.department?.name || 'N/A',
        tasksCompleted: log.tasksCompleted,
        tasksOnTime: log.tasksOnTime,
        onTimeRate,
        totalScore: log.totalScore,
        rank: log.rank,
      });

      row.height = 22;
      const isEven = index % 2 === 1;

      row.eachCell((cell, colNumber) => {
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF4F8FB' }, // Màu xám nhạt xen kẽ
          };
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 6, 7, 8, 9, 10].includes(colNumber) ? 'center' : 'left',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    });

    // ==========================================
    // SHEET 2: CHI TIẾT TỪNG NHIỆM VỤ
    // ==========================================
    const detailSheet = workbook.addWorksheet('Chi Tiết Nhiệm Vụ');

    detailSheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Nhân Viên Thực Hiện', key: 'assigneeName', width: 25 },
      { header: 'Tên Công Việc', key: 'taskTitle', width: 35 },
      { header: 'Dự Án', key: 'projectName', width: 22 },
      { header: 'Mức Độ Ưu Tiên', key: 'priority', width: 16 },
      { header: 'Hạn Chót (Deadline)', key: 'dueDate', width: 18 },
      { header: 'Ngày Hoàn Thành', key: 'completedDate', width: 18 },
      { header: 'Đúng Hạn', key: 'isOnTime', width: 12 },
    ];

    const headerRow2 = detailSheet.getRow(1);
    headerRow2.height = 26;
    headerRow2.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D47A1' }, // Xanh navy đậm
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Lấy danh sách tasks đã hoàn thành của kỳ đó
    const [yearStr, monthStr] = targetPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const completedTasks = await prisma.task.findMany({
      where: {
        status: 'DONE',
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
        assignee: userWhere,
      },
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    completedTasks.forEach((task, idx) => {
      const isOnTime = !task.dueDate || new Date(task.updatedAt) <= new Date(task.dueDate);
      const row = detailSheet.addRow({
        stt: idx + 1,
        assigneeName: task.assignee?.name || 'Chưa gán',
        taskTitle: task.title,
        projectName: task.project.name,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : 'Không có',
        completedDate: task.updatedAt.toISOString().slice(0, 10),
        isOnTime: isOnTime ? 'Có' : 'Trễ',
      });

      row.height = 20;
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
        });
      }
    });

    // Auto Column Widths cho cả 2 sheet
    [summarySheet, detailSheet].forEach((sheet) => {
      sheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.max(maxLength + 4, 12);
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Bao_Cao_KPI_${targetPeriod}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Lỗi exportKpiExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xuất báo cáo KPI Excel.',
      error: error.message,
    });
  }
};
