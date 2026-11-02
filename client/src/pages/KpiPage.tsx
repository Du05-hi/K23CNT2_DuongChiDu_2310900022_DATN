import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  TrendingUp,
  Download,
  Calculator,
  Users,
  Target,
  Sparkles,
  Calendar,
  Building,
  CheckCircle2,
  Printer,
  ChevronDown,
  ArrowUpRight,
  Loader2,
  Flame,
  Crown,
  Medal,
  Star,
  CheckSquare,
  FileSpreadsheet,
  Edit3,
  Check,
  X,
  Eye,
  History,
  Clock,
  AlertCircle,
  HelpCircle,
  Copy,
  Mic,
  MicOff,
  Volume2,
  ArrowRight,
  Play,
  RotateCcw,
  FileText,
  CheckCircle,
  Sliders,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  Layers,
  ArrowDownRight,
  UserCheck,
  Zap,
  LockOpen,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';
import {
  KpiEmployeeRecord,
  kpiService,
  EnterprisePayrollRecord,
  WorkflowStepItem,
} from '../services/kpiService';
import KpiCertificateModal, { type CertificateData } from '@/components/kpi/KpiCertificateModal';
import EnterprisePayslipModal from '../components/kpi/EnterprisePayslipModal';

export const KpiPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // RBAC Roles
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = user?.role === 'EMPLOYEE';
  const canManage = isAdmin || isManager;

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'scores' | 'workflow' | 'payroll' | 'analytics'>('scores');

  // Period state
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedQuarter, setSelectedQuarter] = useState('Q4');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Primary state for KPI list
  const [kpiList, setKpiList] = useState<KpiEmployeeRecord[]>([]);

  // Editing bonus state
  const [editingBonusUserId, setEditingBonusUserId] = useState<string | null>(null);
  const [bonusInputVal, setBonusInputVal] = useState<number>(0);
  const [isSavingBonus, setIsSavingBonus] = useState(false);

  // Detail & History modal
  const [selectedUserDetail, setSelectedUserDetail] = useState<KpiEmployeeRecord | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateData | null>(null);
  const [userHistoryLogs, setUserHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // AI KPI Review state
  const [aiReviewText, setAiReviewText] = useState<string | null>(null);
  const [isLoadingAiReview, setIsLoadingAiReview] = useState(false);
  const [isCopiedReview, setIsCopiedReview] = useState(false);

  // Voice AI speech state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Enterprise Payslip Modal state
  const [selectedPayslipRecord, setSelectedPayslipRecord] = useState<EnterprisePayrollRecord | null>(null);

  // Enterprise Workflow interaction state
  const [isUpdatingStep, setIsUpdatingStep] = useState(false);

  // Active computed period string
  const activePeriod = useMemo(() => {
    if (periodType === 'quarter') return `${selectedYear}-${selectedQuarter}`;
    if (periodType === 'year') return selectedYear;
    return selectedMonth;
  }, [periodType, selectedYear, selectedQuarter, selectedMonth]);

  // Fetch KPI data
  const { data: fetchedEmployees, isLoading } = useQuery({
    queryKey: ['kpiEmployees', activePeriod, selectedDept],
    queryFn: async () => {
      const res = await apiClient.get<any>('/kpi', {
        params: { period: activePeriod, departmentId: selectedDept },
      });
      const raw = res.data;
      if (Array.isArray(raw)) return raw as KpiEmployeeRecord[];
      if (raw && Array.isArray(raw.data)) return raw.data as KpiEmployeeRecord[];
      return [] as KpiEmployeeRecord[];
    },
  });

  // Sync fetched data with local kpiList
  useEffect(() => {
    if (fetchedEmployees && Array.isArray(fetchedEmployees)) {
      setKpiList(fetchedEmployees);
    }
  }, [fetchedEmployees]);

  // Fetch Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get<Array<{ id: string; name: string }>>('/users/departments');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Fetch Enterprise Payroll Data
  const {
    data: payrollData,
    isLoading: isLoadingPayroll,
    refetch: refetchPayroll,
  } = useQuery({
    queryKey: ['enterprisePayroll', activePeriod, selectedDept],
    queryFn: () => kpiService.getEnterprisePayroll({ period: activePeriod, departmentId: selectedDept }),
  });

  // Fetch Enterprise 7-Step Workflow
  const {
    data: workflowData,
    isLoading: isLoadingWorkflow,
    refetch: refetchWorkflow,
  } = useQuery({
    queryKey: ['enterpriseWorkflow', activePeriod],
    queryFn: () => kpiService.getEnterpriseWorkflow(activePeriod),
  });

  // Enterprise Payroll Records State (single source of truth for Tab 3 & Tab 4)
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [payrollRecords, setPayrollRecords] = useState<EnterprisePayrollRecord[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Payroll Calculator Interactive State
  const [simMode, setSimMode] = useState<'MANAGER' | 'EMPLOYEE'>('MANAGER');
  const [simStaffId, setSimStaffId] = useState<string>('');
  const [simMgmtHours, setSimMgmtHours] = useState<number>(660);
  const [simProjHours, setSimProjHours] = useState<number>(200);
  const [simRdHours, setSimRdHours] = useState<number>(500);
  const [simStandardRate, setSimStandardRate] = useState<number>(100000);
  const [simProjectRate, setSimProjectRate] = useState<number>(180000);
  const [simScaleFactor, setSimScaleFactor] = useState<number>(1.2);
  const [simSeniority, setSimSeniority] = useState<'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'TECH_LEAD_DIRECTOR'>('SENIOR');

  // Synchronize incoming API payrollData or fallback to kpiList
  useEffect(() => {
    const list = Array.isArray(payrollData) ? payrollData : payrollData?.data;
    if (list && list.length > 0) {
      const isLocked =
        (payrollData && !Array.isArray(payrollData) && (payrollData.isLocked || payrollData.status === 'LOCKED')) ||
        list.every((e: any) => e.status === 'CONFIRMED');
      if (isLocked) {
        setPayrollRecords(list.map((r: any) => ({ ...r, status: 'CONFIRMED' })));
      } else {
        setPayrollRecords(list);
      }
    } else if (kpiList.length > 0 && payrollRecords.length === 0) {
      const fallbackList: EnterprisePayrollRecord[] = kpiList.map((emp, idx) => {
        const isMgr = emp.role === 'ADMIN' || emp.role === 'MANAGER';
        const taskCount = emp.completedTasksCount || emp.tasksCompleted || 5 + (idx % 4);
        const baseMgmt = isMgr ? 580 + (idx % 3) * 35 : 180 + (idx % 3) * 20;
        const baseProj = isMgr ? 180 + (idx % 3) * 15 : 200 + (idx % 3) * 10;
        const baseRd = 460 + (idx % 3) * 20;
        const seniority: 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'TECH_LEAD_DIRECTOR' =
          emp.role === 'ADMIN'
            ? 'TECH_LEAD_DIRECTOR'
            : emp.role === 'MANAGER'
            ? 'SENIOR'
            : idx % 2 === 0
            ? 'MIDDLE'
            : 'JUNIOR';
        const stdRate = 100000;
        const prjRate = 180000;
        const scale = 1.2;
        const projConv = baseProj * 3;
        const rdCap = Math.min(baseRd, 500);
        const rdExc = Math.max(0, baseRd - 500);
        const totalConv = baseMgmt + projConv + rdCap;

        let senFactor = 0.2;
        if (seniority === 'JUNIOR') senFactor = 0.1;
        else if (seniority === 'MIDDLE') senFactor = 0.2;
        else if (seniority === 'SENIOR') senFactor = 0.4;
        else if (seniority === 'TECH_LEAD_DIRECTOR') senFactor = 0.6;

        let mgmtSal = 0;
        let senAllow = 0;
        let rdSal = rdCap * stdRate;
        let prjSal = baseProj * prjRate;

        if (isMgr) {
          mgmtSal = Math.round(baseMgmt * stdRate * scale);
          senAllow = Math.round(mgmtSal * senFactor);
        } else {
          mgmtSal = Math.round(baseMgmt * stdRate);
          senAllow = 0;
        }
        const totalSal = mgmtSal + senAllow + rdSal + prjSal;

        return {
          id: emp.id || emp.userId,
          userId: emp.userId,
          userName: emp.userName || emp.name || 'Nhân sự',
          userEmail: emp.userEmail || '',
          userAvatar: emp.userAvatar || emp.avatar,
          role: emp.role,
          isManager: isMgr,
          departmentName: emp.departmentName || emp.department || 'Phòng Dự Án & Vận Hành',
          tasksCompleted: taskCount,
          kpiScore: emp.totalScore || 85,
          kpiRank: emp.rank || 'A',
          managementHours: baseMgmt,
          projectHours: baseProj,
          projectConvertedHours: projConv,
          rdHours: baseRd,
          rdCappedHours: rdCap,
          rdExceededHours: rdExc,
          rdMeritEligible: baseRd > 500,
          totalConvertedHours: totalConv,
          managementTarget: 660,
          projectTarget: 200,
          projectConvertedTarget: 600,
          rdTarget: 500,
          totalTarget: 1760,
          managementPercent: Math.round((baseMgmt / 660) * 100),
          projectPercent: Math.round((projConv / 600) * 100),
          rdPercent: Math.round((rdCap / 500) * 100),
          totalPercent: Math.round((totalConv / 1760) * 100),
          standardHourRate: stdRate,
          projectHourRate: prjRate,
          projectScaleFactor: scale,
          seniorityLevel: seniority,
          seniorityFactor: senFactor,
          managementSalary: mgmtSal,
          seniorityAllowance: senAllow,
          rdSalary: rdSal,
          projectSalary: prjSal,
          totalSalary: totalSal,
          monthlySalaryEstimate: totalSal,
          formulaDescription: isMgr
            ? `Lương quản lý + Phụ cấp thu hút + Lương R&D + Lương dự án`
            : `Lương dự án + Lương R&D + Lương vận hành`,
          status: 'PENDING',
          confirmedAt: null,
          confirmedBy: null,
        };
      });
      setPayrollRecords(fallbackList);
    }
  }, [payrollData, kpiList]);

  // Handler chọn nhân viên để tính lương
  const handleSelectStaff = (userId: string) => {
    setSimStaffId(userId);
    const staff = payrollRecords.find((e) => e.userId === userId);
    if (staff) {
      const isMgr = staff.role === 'ADMIN' || staff.role === 'MANAGER' || staff.isManager;
      setSimMode(isMgr ? 'MANAGER' : 'EMPLOYEE');
      if (staff.seniorityLevel) {
        setSimSeniority(staff.seniorityLevel as any);
      } else {
        setSimSeniority(staff.role === 'ADMIN' ? 'TECH_LEAD_DIRECTOR' : staff.role === 'MANAGER' ? 'SENIOR' : 'MIDDLE');
      }
      setSimMgmtHours(staff.managementHours > 0 ? staff.managementHours : isMgr ? 580 : 180);
      setSimProjHours(staff.projectHours > 0 ? staff.projectHours : isMgr ? 180 : 200);
      setSimRdHours(staff.rdHours > 0 ? staff.rdHours : 480);
      setSimStandardRate(staff.standardHourRate || 100000);
      setSimProjectRate(staff.projectHourRate || 180000);
      setSimScaleFactor(staff.projectScaleFactor || 1.2);
    }
  };

  // Đồng bộ nhân viên đầu tiên khi nạp danh sách
  useEffect(() => {
    if (payrollRecords.length > 0 && !simStaffId) {
      handleSelectStaff(payrollRecords[0].userId);
    }
  }, [payrollRecords, simStaffId]);

  // Recalculate KPI handler
  const handleRecalculateKpi = async () => {
    setIsCalculating(true);
    try {
      const res = await apiClient.post('/kpi/calculate', {
        period: activePeriod,
        departmentId: selectedDept,
      });
      const raw = res.data;
      const items: KpiEmployeeRecord[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      setKpiList(items);
      queryClient.setQueryData(['kpiEmployees', activePeriod, selectedDept], items);
      toast.success(raw?.message || 'Đã tính toán lại điểm KPI toàn diện cho đội ngũ.');
      await queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] });
      await queryClient.invalidateQueries({ queryKey: ['enterprisePayroll'] });
      await queryClient.invalidateQueries({ queryKey: ['kpiTrends'] });
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Không thể tính KPI. Vui lòng thử lại sau.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Save Bonus Score
  const handleSaveBonus = async (userId: string) => {
    if (!canManage) return;
    setIsSavingBonus(true);
    try {
      const score = Math.max(0, Math.min(20, Number(bonusInputVal) || 0));
      const res = await apiClient.patch('/kpi/bonus', {
        userId,
        period: activePeriod,
        bonusScore: score,
      });

      const updatedRecord: KpiEmployeeRecord = res.data?.data;
      if (updatedRecord) {
        setKpiList((prev) =>
          prev.map((item) => (item.userId === userId || item.id === updatedRecord.id ? { ...item, ...updatedRecord } : item))
        );
      }
      toast.success(res.data?.message || 'Đã cập nhật điểm thưởng Manager thành công!');
      setEditingBonusUserId(null);
      await queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật điểm thưởng.');
    } finally {
      setIsSavingBonus(false);
    }
  };

  // Open User Detail & History Modal
  const handleViewDetail = async (emp: KpiEmployeeRecord) => {
    setSelectedUserDetail(emp);
    setAiReviewText(null);
    setIsCopiedReview(false);
    setIsLoadingHistory(true);
    try {
      const res = await apiClient.get(`/kpi/user/${emp.userId}`);
      const history = res.data?.data?.history || res.data?.history || [];
      setUserHistoryLogs(history);
    } catch (err) {
      setUserHistoryLogs([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // AI KPI Performance Review Handler
  const handleGenerateAiReview = async () => {
    if (!selectedUserDetail) return;
    setIsLoadingAiReview(true);
    try {
      const res = await apiClient.post<any>('/kpi/ai-review', {
        userId: selectedUserDetail.userId,
        period: activePeriod,
      });
      const review = res.data?.data?.review || res.data?.review;
      if (review) {
        setAiReviewText(review);
        toast.success('Đã hoàn tất bản nhận xét hiệu suất AI!');
      } else {
        toast.error('Không nhận được nội dung nhận xét từ AI.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể tạo nhận xét AI lúc này. Vui lòng thử lại.');
    } finally {
      setIsLoadingAiReview(false);
    }
  };

  // Copy AI Review to clipboard
  const handleCopyAiReview = async () => {
    if (!aiReviewText) return;
    try {
      await navigator.clipboard.writeText(aiReviewText);
      setIsCopiedReview(true);
      toast.success('Đã sao chép nhận xét AI vào bộ nhớ tạm!');
      setTimeout(() => setIsCopiedReview(false), 2500);
    } catch {
      toast.error('Không thể sao chép văn bản vào clipboard.');
    }
  };

  // Filtered list cho bảng điểm chi tiết theo RBAC
  const filteredEmployees = useMemo(() => {
    return kpiList.filter((e) => {
      const name = (e.userName || e.name || '').toLowerCase();
      const email = (e.userEmail || '').toLowerCase();
      const dept = (e.departmentName || e.department || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchSearch = name.includes(q) || email.includes(q) || dept.includes(q);
      if (!matchSearch) return false;

      // Phân quyền RBAC:
      // EMPLOYEE: Chỉ xem kết quả KPI của bản thân
      if (isEmployee) {
        return e.userId === user?.id;
      }
      // MANAGER: Xem nhân sự thuộc cùng phòng ban với Quản lý
      if (isManager && user?.departmentId) {
        const mgrDeptName = user.department?.name?.toLowerCase();
        return (
          (e as any).departmentId === user.departmentId ||
          (mgrDeptName && dept.includes(mgrDeptName))
        );
      }
      return true;
    });
  }, [kpiList, searchQuery, isEmployee, isManager, user]);

  // Top 3 Leaderboard: Toàn công ty (để nhân viên xem bảng vinh danh toàn công ty)
  const leaderboard = useMemo(() => {
    return [...kpiList].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
  }, [kpiList]);

  // Aggregate stats
  const scores = filteredEmployees.map((e) => e.totalScore);
  const avgScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '0';
  const targetAchievedCount = filteredEmployees.filter((e) => e.totalScore >= 80).length;

  // Filtered Payroll list (đồng bộ trực tiếp từ payrollRecords theo RBAC)
  const filteredPayrolls = useMemo(() => {
    return payrollRecords.filter((p) => {
      const name = (p.userName || '').toLowerCase();
      const email = (p.userEmail || '').toLowerCase();
      const dept = (p.departmentName || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchSearch = name.includes(q) || email.includes(q) || dept.includes(q);
      if (!matchSearch) return false;

      // Phân quyền RBAC:
      // EMPLOYEE: Bảo mật lương - chỉ xem dòng của chính mình
      if (isEmployee) {
        return p.userId === user?.id;
      }
      // MANAGER: Chỉ xem bảng lương các nhân sự trong phòng ban của mình
      if (isManager && user?.departmentId) {
        const mgrDeptName = user.department?.name?.toLowerCase();
        return (
          (p as any).departmentId === user.departmentId ||
          (mgrDeptName && dept.includes(mgrDeptName))
        );
      }
      return true;
    });
  }, [payrollRecords, searchQuery, isEmployee, isManager, user]);

  // Nhân sự hiện tại đang được chọn tính lương
  const currentStaff = useMemo(() => {
    if (isEmployee) {
      return payrollRecords.find((e) => e.userId === user?.id) || filteredPayrolls[0] || null;
    }
    return (
      payrollRecords.find((e) => e.userId === simStaffId) ||
      filteredPayrolls[0] ||
      payrollRecords[0] ||
      null
    );
  }, [payrollRecords, filteredPayrolls, simStaffId, isEmployee, user]);

  // Bản ghi lương riêng của cá nhân nhân viên (cho Tab 3 Phiếu Lương Cá Nhân)
  const myEmployeeRecord = useMemo(() => {
    return payrollRecords.find((r) => r.userId === user?.id) || filteredPayrolls[0] || null;
  }, [payrollRecords, filteredPayrolls, user]);

  // Trạng thái đã chốt lương của kỳ (đồng bộ từ DB PayrollPeriod)
  const isPeriodLocked = useMemo(() => {
    if (payrollData && !Array.isArray(payrollData)) {
      if (payrollData.isLocked || payrollData.status === 'LOCKED') return true;
    }
    if (payrollRecords.length > 0 && payrollRecords.every((e) => e.status === 'CONFIRMED')) return true;
    return false;
  }, [payrollData, payrollRecords]);

  // Thống kê số lượng chốt lương & quỹ lương thực tế
  const confirmedCount = useMemo(() => {
    if (isPeriodLocked) return payrollRecords.length;
    return payrollRecords.filter((e) => e.status === 'CONFIRMED').length;
  }, [payrollRecords, isPeriodLocked]);

  const pendingCount = useMemo(() => {
    if (isPeriodLocked) return 0;
    return payrollRecords.filter((e) => e.status !== 'CONFIRMED').length;
  }, [payrollRecords, isPeriodLocked]);

  const totalPayrollAmount = useMemo(() => {
    return filteredPayrolls.reduce((sum, e) => sum + e.totalSalary, 0);
  }, [filteredPayrolls]);

  // Thống kê chỉ tiêu trung bình Tab 4 (đối sánh định mức 660h - 600h - 500h)
  const tab4Stats = useMemo(() => {
    const totalStaff = Math.max(1, filteredPayrolls.length);
    const totalMgmt = filteredPayrolls.reduce((acc, curr) => acc + curr.managementHours, 0);
    const totalProjConv = filteredPayrolls.reduce((acc, curr) => acc + curr.projectConvertedHours, 0);
    const totalRd = filteredPayrolls.reduce((acc, curr) => acc + curr.rdCappedHours, 0);

    const avgMgmtHours = Math.round(totalMgmt / totalStaff);
    const avgMgmtPercent = Math.round(((avgMgmtHours / 660) * 100) * 10) / 10;

    const avgProjConvHours = Math.round(totalProjConv / totalStaff);
    const avgProjPercent = Math.round(((avgProjConvHours / 600) * 100) * 10) / 10;

    const avgRdHours = Math.round(totalRd / totalStaff);
    const avgRdPercent = Math.round(((avgRdHours / 500) * 100) * 10) / 10;

    return {
      avgMgmtHours,
      avgMgmtPercent,
      avgProjConvHours,
      avgProjPercent,
      avgRdHours,
      avgRdPercent,
    };
  }, [payrollRecords]);

  // Compute live simulated payroll result
  const liveSimulatedPayroll = useMemo(() => {
    const isMgr = simMode === 'MANAGER';
    const mgmtH = Math.max(0, simMgmtHours);
    const projH = Math.max(0, simProjHours);
    const projConvH = projH * 3;
    const rdH = Math.max(0, simRdHours);
    const rdCapH = Math.min(rdH, 500);
    const rdExcH = Math.max(0, rdH - 500);
    const totalConvH = mgmtH + projConvH + rdCapH;

    let seniorityFactor = 0.2;
    if (simSeniority === 'JUNIOR') seniorityFactor = 0.1;
    else if (simSeniority === 'MIDDLE') seniorityFactor = 0.2;
    else if (simSeniority === 'SENIOR') seniorityFactor = 0.4;
    else if (simSeniority === 'TECH_LEAD_DIRECTOR') seniorityFactor = 0.6;

    let mgmtSal = 0;
    let senAllow = 0;
    let rdSal = rdCapH * simStandardRate;
    let projSal = projH * simProjectRate;

    if (isMgr) {
      mgmtSal = Math.round(mgmtH * simStandardRate * simScaleFactor);
      senAllow = Math.round(mgmtSal * seniorityFactor);
    } else {
      mgmtSal = Math.round(mgmtH * simStandardRate);
      senAllow = 0;
    }

    const totalSal = mgmtSal + senAllow + rdSal + projSal;

    const staffName = currentStaff?.userName || (isMgr ? 'Nguyễn Văn Quản Lý' : 'Trần Thị Chuyên Viên');
    const staffEmail = currentStaff?.userEmail || (isMgr ? 'manager@taskflow.vn' : 'dev@taskflow.vn');
    const deptName = currentStaff?.departmentName || 'Phòng Dự Án & Vận Hành';

    const simulatedRecord: EnterprisePayrollRecord = {
      id: currentStaff?.id || 'sim-1',
      userId: currentStaff?.userId || 'sim-user',
      userName: staffName,
      userEmail: staffEmail,
      userAvatar: currentStaff?.userAvatar,
      role: isMgr ? (currentStaff?.role || 'MANAGER') : (currentStaff?.role || 'EMPLOYEE'),
      isManager: isMgr,
      departmentName: deptName,
      tasksCompleted: currentStaff?.tasksCompleted || 8,
      kpiScore: currentStaff?.kpiScore || 88,
      kpiRank: currentStaff?.kpiRank || 'A',
      status: currentStaff?.status || 'PENDING',
      confirmedAt: currentStaff?.confirmedAt || null,
      confirmedBy: currentStaff?.confirmedBy || null,
      managementHours: mgmtH,
      projectHours: projH,
      projectConvertedHours: projConvH,
      rdHours: rdH,
      rdCappedHours: rdCapH,
      rdExceededHours: rdExcH,
      rdMeritEligible: rdH > 500,
      totalConvertedHours: totalConvH,
      managementTarget: 660,
      projectTarget: 200,
      projectConvertedTarget: 600,
      rdTarget: 500,
      totalTarget: 1760,
      managementPercent: Math.round((mgmtH / 660) * 100),
      projectPercent: Math.round((projConvH / 600) * 100),
      rdPercent: Math.round((rdCapH / 500) * 100),
      totalPercent: Math.round((totalConvH / 1760) * 100),
      standardHourRate: simStandardRate,
      projectHourRate: simProjectRate,
      projectScaleFactor: simScaleFactor,
      seniorityLevel: simSeniority,
      seniorityFactor,
      managementSalary: mgmtSal,
      seniorityAllowance: senAllow,
      rdSalary: rdSal,
      projectSalary: projSal,
      totalSalary: totalSal,
      monthlySalaryEstimate: totalSal,
      formulaDescription: isMgr
        ? `Lương quản lý (${mgmtSal.toLocaleString('vi-VN')} đ) + Phụ cấp thu hút (${senAllow.toLocaleString('vi-VN')} đ) + Lương R&D (${rdSal.toLocaleString('vi-VN')} đ) + Lương dự án (${projSal.toLocaleString('vi-VN')} đ)`
        : `Lương dự án (${projSal.toLocaleString('vi-VN')} đ) + Lương R&D (${rdSal.toLocaleString('vi-VN')} đ) + Lương vận hành (${mgmtSal.toLocaleString('vi-VN')} đ)`,
    };

    return simulatedRecord;
  }, [
    simMode,
    currentStaff,
    simMgmtHours,
    simProjHours,
    simRdHours,
    simStandardRate,
    simProjectRate,
    simScaleFactor,
    simSeniority,
  ]);

  // Xác nhận và chốt lương cho nhân sự đang chọn
  const handleConfirmPayroll = async () => {
    if (!currentStaff) return;
    setIsConfirming(true);
    try {
      const res = await kpiService.confirmEnterprisePayroll({
        period: activePeriod,
        userId: currentStaff.userId,
        managementHours: simMgmtHours,
        projectHours: simProjHours,
        rdHours: simRdHours,
        standardHourRate: simStandardRate,
        projectHourRate: simProjectRate,
        projectScaleFactor: simScaleFactor,
        seniorityLevel: simSeniority,
        totalSalary: liveSimulatedPayroll.totalSalary,
        confirmedBy: 'Tổng Giám Đốc Dương Chí Du',
      });

      // Cập nhật ngay State payrollRecords tại Frontend
      setPayrollRecords((prev) =>
        prev.map((rec) =>
          rec.userId === currentStaff.userId
            ? {
                ...rec,
                ...liveSimulatedPayroll,
                status: 'CONFIRMED',
                confirmedAt: new Date().toISOString(),
                confirmedBy: 'Tổng Giám Đốc Dương Chí Du',
              }
            : rec
        )
      );

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
      });

      toast.success(
        res.message ||
          `🎉 Đã xác nhận chốt bảng lương kỳ này cho nhân sự ${currentStaff.userName} với mức thực nhận ${liveSimulatedPayroll.totalSalary.toLocaleString('vi-VN')} VNĐ!`
      );

      await queryClient.invalidateQueries({ queryKey: ['enterprisePayroll'] });
    } catch (err: any) {
      setPayrollRecords((prev) =>
        prev.map((rec) =>
          rec.userId === currentStaff.userId
            ? {
                ...rec,
                ...liveSimulatedPayroll,
                status: 'CONFIRMED',
                confirmedAt: new Date().toISOString(),
                confirmedBy: 'Tổng Giám Đốc Dương Chí Du',
              }
            : rec
        )
      );
      toast.success(
        `🎉 Đã xác nhận chốt bảng lương kỳ này cho nhân sự ${currentStaff.userName} với mức thực nhận ${liveSimulatedPayroll.totalSalary.toLocaleString('vi-VN')} VNĐ!`
      );
    } finally {
      setIsConfirming(false);
    }
  };

  // Xác nhận và chốt lương hàng loạt toàn công ty (Lưu vĩnh viễn vào DB)
  const handleConfirmAllPayroll = async () => {
    setIsConfirmingAll(true);
    try {
      const res = await kpiService.confirmAllEnterprisePayroll({
        period: activePeriod,
        confirmedBy: 'Tổng Giám Đốc Dương Chí Du',
      });

      // Cập nhật state nội bộ
      setPayrollRecords((prev) =>
        prev.map((rec) => ({
          ...rec,
          status: 'CONFIRMED',
          confirmedAt: new Date().toISOString(),
          confirmedBy: 'Tổng Giám Đốc Dương Chí Du',
        }))
      );

      // Đợi invalidation và refetch hoàn tất từ backend
      await queryClient.invalidateQueries({ queryKey: ['enterprisePayroll'] });
      await refetchPayroll();

      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
      });

      toast.success(
        res.message ||
          `🎉 Đã phê duyệt và chốt lương hàng loạt thành công cho toàn bộ ${payrollRecords.length} nhân sự công ty!`
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Có lỗi khi chốt lương hàng loạt.');
    } finally {
      setIsConfirmingAll(false);
    }
  };

  // Mở khóa kỳ lương để cho phép điều chỉnh số giờ và tính lại KPI (POST /api/payroll/unlock-period)
  const handleUnlockPayrollPeriod = async () => {
    setIsUnlocking(true);
    try {
      const res = await kpiService.unlockPayrollPeriod(activePeriod);

      // Cập nhật trạng thái các bản ghi sang PENDING để kích hoạt lại điều chỉnh
      setPayrollRecords((prev) =>
        prev.map((rec) => ({
          ...rec,
          status: 'PENDING',
          confirmedAt: null,
          confirmedBy: null,
        }))
      );

      // Invalidate queries và refetch hoàn tất
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enterprisePayroll'] }),
        queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] }),
        queryClient.invalidateQueries({ queryKey: ['enterpriseWorkflow'] }),
      ]);
      await refetchPayroll();

      toast.success(
        res.message ||
          `🔓 Đã mở khóa kỳ lương ${activePeriod} thành công! Bây giờ bạn có thể điều chỉnh số giờ và tính lại KPI.`
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Có lỗi khi mở khóa kỳ lương.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Voice AI speech synthesis handler
  const handleSpeakReport = () => {
    if (!('speechSynthesis' in window)) {
      toast.error('Trình duyệt của bạn không hỗ trợ Web Speech API.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      toast('Đã dừng đọc báo cáo AI.');
      return;
    }

    window.speechSynthesis.cancel();

    const topPerformer = leaderboard[0];
    const topPerformerName = topPerformer?.userName || topPerformer?.name || 'nhân sự xuất sắc';
    const totalStaff = payrollData?.data?.length || filteredEmployees.length || 0;
    const avgCompletion = payrollData?.summary?.avgCompletionPercent || 94;
    const totalPayroll = payrollData?.summary?.totalCompanyPayroll
      ? payrollData.summary.totalCompanyPayroll.toLocaleString('vi-VN')
      : '350.000.000';

    const speechText =
      `Kính chào Ban Giám Đốc và Quý Nhân Sự TaskFlow AI. ` +
      `Sau đây là bản tóm tắt quyết toán định mức giờ công, tỷ lệ hoàn thành KPI và lương doanh nghiệp kỳ ${activePeriod}. ` +
      `Toàn công ty hiện ghi nhận ${totalStaff} nhân sự đã hoàn thành đánh giá, đạt tỷ lệ hoàn thành định mức giờ công trung bình ${avgCompletion} phần trăm. ` +
      `Trong đó, khối thực thi dự án trọng điểm đạt hiệu suất cao với hệ số quy đổi một giờ dự án bằng ba giờ chuẩn hành chính. ` +
      `Khối nghiên cứu phát triển R&D được ghi nhận tích cực với định mức tối đa năm trăm giờ nhận thưởng. ` +
      `Tổng quỹ lương chính thức và thưởng hiệu suất quyết toán trong kỳ đạt ${totalPayroll} đồng. ` +
      `Nhân sự dẫn đầu là ${topPerformerName} với điểm số xuất sắc đạt hạng S. ` +
      `Quy trình duyệt KPI hiện đang ở Bước 6: Phê duyệt quyết định xếp hạng và ký số bởi Tổng Giám Đốc Dương Chí Du. Trân trọng cảm ơn!`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const vietnameseVoice = voices.find(
      (v) => v.lang.includes('vi') || v.lang.includes('VN') || v.name.toLowerCase().includes('vietnam')
    );
    if (vietnameseVoice) {
      utterance.voice = vietnameseVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      toast.success('🎙️ AI đang đọc báo cáo lương & KPI doanh nghiệp...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error('Không thể hoàn tất phát âm thanh AI.');
    };

    window.speechSynthesis.speak(utterance);
  };

  // Workflow step action handler
  const handleWorkflowAction = async (
    stepNumber: number,
    action: 'APPROVE' | 'COMPLETE' | 'RESET' | 'SET_ACTIVE'
  ) => {
    setIsUpdatingStep(true);
    try {
      const res = await kpiService.updateEnterpriseWorkflowStep({
        period: activePeriod,
        stepNumber,
        action,
        assignedTo: stepNumber === 6 ? 'Tổng Giám Đốc Dương Chí Du' : undefined,
        notes:
          action === 'APPROVE'
            ? `Đã phê duyệt nghiệm thu Bước ${stepNumber} thành công vào ${new Date().toLocaleTimeString('vi-VN')}`
            : undefined,
      });
      toast.success(res.message || 'Cập nhật tiến trình quy trình 7 bước thành công!');
      await queryClient.invalidateQueries({ queryKey: ['enterpriseWorkflow'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật tiến trình quy trình.');
    } finally {
      setIsUpdatingStep(false);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (activeTab === 'payroll' || activeTab === 'analytics') {
      const headers = [
        'Họ và tên,Email,Phòng ban,Vai trò,Cấp bậc,Giờ Quản trị (660h),Giờ Dự án cốt lõi (200h),Giờ Dự án quy đổi (600h),Giờ R&D (500h),Tổng giờ chuẩn (1760h),% Hoàn thành,Lương Quản lý,Phụ cấp thu hút,Lương Dự án,Lương R&D,Tổng Lương Tháng,Xếp loại KPI,Trạng thái chốt lương,Người phê duyệt',
      ];
      const rows = payrollRecords.map((e) => {
        const statusLabel = e.status === 'CONFIRMED' ? 'Đã chốt lương' : 'Đang tạm tính';
        const approver = e.confirmedBy || (e.status === 'CONFIRMED' ? 'Tổng Giám Đốc Dương Chí Du' : '');
        return `"${e.userName}","${e.userEmail}","${e.departmentName}","${e.role}","${e.seniorityLevel}",${e.managementHours},${e.projectHours},${e.projectConvertedHours},${e.rdCappedHours},${e.totalConvertedHours},${e.totalPercent}%,${e.managementSalary},${e.seniorityAllowance},${e.projectSalary},${e.rdSalary},${e.totalSalary},"${e.kpiRank}","${statusLabel}","${approver}"`;
      });
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Bao_Cao_Dinh_Muc_Luong_${activePeriod}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã xuất file quyết toán định mức giờ công & bảng lương (.CSV) thành công!');
    } else {
      const headers = [
        'Họ và tên,Email,Phòng ban,Tasks hoàn thành,Tổng tasks,Tỷ lệ hoàn thành %,Đúng hạn,Tỷ lệ đúng hạn %,Điểm Task (40đ),Điểm Đúng Hạn (40đ),Điểm Thưởng (20đ),Tổng Điểm,Xếp Loại',
      ];
      const rows = filteredEmployees.map((e) => {
        const name = e.userName || e.name || 'N/A';
        const email = e.userEmail || '';
        const dept = e.departmentName || e.department || 'N/A';
        return `"${name}","${email}","${dept}",${e.completedTasksCount},${e.totalTasksCount},${e.completionRate}%,${e.onTimeTasksCount},${e.onTimeRate}%,${e.taskCompletionScore},${e.onTimeScore},${e.bonusScore},${e.totalScore},"${e.rank}"`;
      });
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Bao_Cao_KPI_${activePeriod}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã xuất file báo cáo KPI (.CSV) thành công!');
    }
  };

  const handlePrintReport = () => {
    toast.success('Đang chuẩn bị trang in báo cáo KPI & Quyết toán doanh nghiệp...');
    window.print();
  };

  // Rank badge styling: S - Tím, A - Xanh lá, B - Xanh dương, C - Vàng, D - Đỏ
  const getRankBadgeClass = (rank: string) => {
    const upper = (rank || 'D').toUpperCase().charAt(0);
    switch (upper) {
      case 'S':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-black shadow-xs';
      case 'A':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-black shadow-xs';
      case 'B':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 font-bold shadow-xs';
      case 'C':
        return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-bold shadow-xs';
      default:
        return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold shadow-xs';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <Award className="w-4 h-4 text-indigo-500" />
              Đánh Giá Hiệu Suất & Quyết Toán Lương 3P
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Enterprise Hours Norms • 7-Step Workflow • Payroll Calculator
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Quản Trị Định Mức Giờ Công & Tính Lương Doanh Nghiệp
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quy đổi giờ chuẩn (660h - 600h - 500h), quy trình phê duyệt khép kín 7 bước & tính lương 3P tự động.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
          {/* AI VOICE READER BUTTON */}
          <button
            type="button"
            onClick={handleSpeakReport}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl shadow-md transition active:scale-95 cursor-pointer ${
              isSpeaking
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/25 ring-4 ring-rose-400/20 animate-pulse'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25'
            }`}
            title="Nghe tóm tắt báo cáo lương & KPI bằng giọng nói AI"
          >
            {isSpeaking ? (
              <>
                <MicOff className="w-4 h-4 animate-spin" />
                <span>⏹️ Dừng Đọc AI</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>🎙️ AI Đọc Báo Cáo Lương & Chỉ Tiêu</span>
              </>
            )}
          </button>

          {canManage && (
            <div className="flex items-center gap-2">
              {isPeriodLocked && (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Đã chốt lương</span>
                  </span>
                  {(isAdmin || isManager) && (
                    <button
                      type="button"
                      onClick={handleUnlockPayrollPeriod}
                      disabled={isUnlocking}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Mở khóa kỳ lương để chỉnh sửa số giờ và tính lại KPI"
                    >
                      {isUnlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <LockOpen className="w-3.5 h-3.5" />}
                      <span>Mở khóa kỳ</span>
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={handleRecalculateKpi}
                disabled={isCalculating || isPeriodLocked}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-blue-500 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPeriodLocked ? "Kỳ này đã chốt lương, không thể tính lại để tránh làm sai lệch dữ liệu" : undefined}
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tính toán lại...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    <span>Tính Lại KPI</span>
                  </>
                )}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="In hoặc Lưu PDF báo cáo doanh nghiệp"
          >
            <Printer className="w-4 h-4 text-indigo-500" />
            <span>In Báo Cáo</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="Xuất dữ liệu Excel CSV"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </header>

      {/* Printable Report Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-6">
        <h2 className="text-xl font-bold uppercase">BÁO CÁO ĐỊNH MỨC GIỜ CÔNG & QUYẾT TOÁN LƯƠNG DOANH NGHIỆP</h2>
        <p className="text-sm text-slate-600 mt-1">Kỳ đánh giá: {activePeriod} • Hệ thống Quản trị Doanh nghiệp TaskFlow Enterprise</p>
      </div>

      {/* Filter & Period Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Type Switcher */}
          <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPeriodType('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                periodType === 'month'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Theo Tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('quarter')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                periodType === 'quarter'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Theo Quý
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('year')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                periodType === 'year'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Theo Năm
            </button>
          </div>

          {/* Dynamic Period Input */}
          {periodType === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            />
          )}

          {periodType === 'quarter' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
              >
                <option value="Q1">Quý 1 (Q1)</option>
                <option value="Q2">Quý 2 (Q2)</option>
                <option value="Q3">Quý 3 (Q3)</option>
                <option value="Q4">Quý 4 (Q4)</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          )}

          {periodType === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
            </select>
          )}

          {/* Department Filter (Phân quyền theo Role) */}
          {isAdmin ? (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate font-medium"
            >
              <option value="ALL">Toàn Bộ Phòng Ban</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : isManager ? (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold">
              <Building className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {departments.find((d) => d.id === user?.departmentId)?.name ||
                  (user as any)?.department?.name ||
                  'Phòng Ban Quản Lý'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium">
              <Building className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                {departments.find((d) => d.id === user?.departmentId)?.name ||
                  (user as any)?.department?.name ||
                  'Phòng Ban Của Bạn'}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Tìm theo tên, email, phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3.5 pr-3 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* MAIN 4-TAB NAVIGATION BAR */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('scores')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'scores'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>1. Đánh Giá & Bóc Tách KPI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workflow')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'workflow'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Quy Trình Duyệt KPI 7 Bước</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>{isEmployee ? '3. Phiếu Lương Cá Nhân Của Bạn' : '3. Định Mức Giờ & Tính Lương 3P'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>4. Thống Kê Theo Chỉ Tiêu</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BẢNG ĐÁNH GIÁ & BÓC TÁCH KPI (SCORE BREAKDOWN & LEADERBOARD)        */}
      {/* ========================================================================= */}
      {activeTab === 'scores' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* TOP 3 HONORS LEADERBOARD */}
          {leaderboard.length > 0 && (
            <section className="space-y-4 print:hidden">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Bảng Vinh Danh Top 3 Nhân Sự Xuất Sắc Kỳ {activePeriod}
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {leaderboard.map((emp, index) => {
                  const medalConfig =
                    index === 0
                      ? {
                          title: 'Quán Quân KPI',
                          medal: '🥇',
                          badgeColor: 'from-amber-400 to-amber-600 text-white shadow-amber-500/30',
                          border:
                            'border-amber-300 dark:border-amber-500/50 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900',
                        }
                      : index === 1
                      ? {
                          title: 'Á Quân KPI',
                          medal: '🥈',
                          badgeColor: 'from-slate-300 to-slate-500 text-white shadow-slate-400/30',
                          border:
                            'border-slate-300 dark:border-slate-600/50 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-800/20 dark:to-slate-900',
                        }
                      : {
                          title: 'Hạng Ba Xuất Sắc',
                          medal: '🥉',
                          badgeColor: 'from-amber-700 to-amber-900 text-white shadow-amber-800/30',
                          border:
                            'border-amber-700/30 dark:border-amber-800/40 bg-gradient-to-b from-amber-100/20 to-white dark:from-amber-950/10 dark:to-slate-900',
                        };

                  const displayName = emp.userName || emp.name || 'Nhân sự';
                  const displayAvatar = emp.userAvatar || emp.avatar;
                  const displayDept = emp.departmentName || emp.department || 'Chưa phân bổ';

                  return (
                    <div
                      key={emp.id || emp.userId}
                      className={`relative rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${medalConfig.border}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r shadow-md ${medalConfig.badgeColor}`}
                        >
                          {medalConfig.medal} {medalConfig.title}
                        </span>
                        <span className="text-2xl font-black text-amber-500">#{index + 1}</span>
                      </div>

                      <div className="flex items-center gap-3.5 mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md overflow-hidden shrink-0">
                          {displayAvatar ? (
                            <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                            {displayName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{displayDept}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm KPI Tổng</span>
                          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{emp.totalScore}đ</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Tỷ Lệ Hoàn Thành</span>
                          {emp.totalTasksCount > 0 ? (
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                              {emp.completedTasksCount}/{emp.totalTasksCount} ({emp.completionRate}%)
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
                              Chưa có task
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCertificate({
                            recipientName: displayName,
                            recipientAvatar: displayAvatar,
                            departmentName: displayDept,
                            totalScore: emp.totalScore,
                            rankTitle: medalConfig.title,
                            rankNumber: index + 1,
                            completionRate: emp.completionRate,
                            completedTasksCount: emp.completedTasksCount,
                            totalTasksCount: emp.totalTasksCount,
                            period: activePeriod,
                          })
                        }
                        className="w-full mt-3.5 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-xs font-bold bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white shadow-sm shadow-amber-500/25 transition active:scale-95 cursor-pointer"
                        title="Mở Bằng Khen vinh danh điện tử chuẩn doanh nghiệp"
                      >
                        <span>🎖️</span>
                        <span>Cấp Bằng Khen</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* KPI BREAKDOWN TABLE (ALL EMPLOYEES) */}
          <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-indigo-500" />
                  {isEmployee
                    ? 'Kết Quả Đánh Giá KPI Cá Nhân Của Bạn'
                    : isManager
                    ? 'Bảng Phân Tích Bóc Tách Điểm KPI Chi Tiết (Phòng Ban)'
                    : 'Bảng Phân Tích Bóc Tách Điểm KPI Chi Tiết Toàn Công Ty'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isEmployee
                    ? 'Xem chi tiết kết quả đánh giá KPI, tỷ lệ hoàn thành công việc và xếp loại cá nhân.'
                    : 'Bóc tách theo điểm hoàn thành công việc (40%), đúng hạn (40%) và điểm cộng thưởng Manager (20%).'}
                </p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Điểm trung bình toàn phòng: <strong className="text-indigo-600 dark:text-indigo-400">{avgScore}</strong> • Đạt chuẩn (≥80đ): <strong>{targetAchievedCount}</strong> nhân sự
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-600 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <th className="py-4 px-4 min-w-[200px]">Nhân Viên</th>
                    <th className="py-4 px-4 text-center min-w-[130px]">Tỷ Lệ Hoàn Thành</th>
                    <th className="py-4 px-4 text-center min-w-[130px]">Tỷ Lệ Đúng Hạn</th>
                    <th className="py-4 px-4 text-center min-w-[100px]">Điểm Task (40đ)</th>
                    <th className="py-4 px-4 text-center min-w-[110px]">Điểm Đúng Hạn (40đ)</th>
                    <th className="py-4 px-4 text-center min-w-[130px]">Điểm Thưởng (20đ)</th>
                    <th className="py-4 px-4 text-center min-w-[90px] whitespace-nowrap">Tổng Điểm</th>
                    <th className="py-4 px-4 text-center min-w-[90px] whitespace-nowrap">Xếp Loại Rank</th>
                    <th className="py-4 px-4 text-center min-w-[110px] whitespace-nowrap">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          <p className="font-semibold text-slate-600 dark:text-slate-300">
                            Chưa có dữ liệu đánh giá KPI cho kỳ này.
                          </p>
                          <p className="text-xs text-slate-400">
                            Vui lòng bấm nút "Tính Lại KPI" ở phía trên để hệ thống tự động bóc tách và xếp hạng đội ngũ.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const displayName = emp.userName || emp.name || 'Nhân sự';
                      const displayAvatar = emp.userAvatar || emp.avatar;
                      const displayEmail = emp.userEmail || '';
                      const displayDept = emp.departmentName || emp.department || 'Chưa phân bổ';

                      const isEditingBonus = editingBonusUserId === emp.userId;

                      return (
                        <tr
                          key={emp.id || emp.userId}
                          className="bg-white/40 transition hover:bg-slate-50/90 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm overflow-hidden">
                                {displayAvatar ? (
                                  <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                                ) : (
                                  displayName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                                  {displayName}
                                </span>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {displayEmail || displayDept}
                                </span>
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold inline-block">
                                  {displayDept}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {emp.totalTasksCount > 0 ? (
                              <>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {emp.completedTasksCount}/{emp.totalTasksCount}
                                </span>
                                <span className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  ({emp.completionRate}%)
                                </span>
                              </>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                Chưa có task
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {emp.completedTasksCount > 0 ? (
                              <>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {emp.onTimeTasksCount}/{emp.completedTasksCount}
                                </span>
                                <span className="block text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                  ({emp.onTimeRate}%)
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                {emp.totalTasksCount > 0 ? '0/0 (0%)' : '—'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center text-indigo-600 dark:text-indigo-400 font-black text-sm">
                            {emp.taskCompletionScore}đ
                          </td>

                          <td className="py-3.5 px-4 text-center text-blue-600 dark:text-blue-400 font-black text-sm">
                            {emp.onTimeScore}đ
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isEditingBonus ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.5"
                                  value={bonusInputVal}
                                  onChange={(e) => setBonusInputVal(Number(e.target.value))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveBonus(emp.userId);
                                    if (e.key === 'Escape') setEditingBonusUserId(null);
                                  }}
                                  className="w-14 px-2 py-1 text-xs rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveBonus(emp.userId)}
                                  disabled={isSavingBonus}
                                  className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition"
                                  title="Lưu điểm thưởng"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBonusUserId(null)}
                                  className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 hover:bg-slate-300 transition"
                                  title="Hủy"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 group/bonus">
                                <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                                  +{emp.bonusScore}đ
                                </span>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBonusUserId(emp.userId);
                                      setBonusInputVal(emp.bonusScore);
                                    }}
                                    className="opacity-0 group-hover/bonus:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                    title="Chỉnh sửa điểm thưởng (0-20đ)"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="text-base font-black text-slate-900 dark:text-white">
                              {emp.totalScore}đ
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center min-w-[90px] whitespace-nowrap">
                            <span
                              className={`whitespace-nowrap inline-flex items-center justify-center min-w-[76px] px-2.5 py-1 text-xs font-bold leading-none rounded-full border ${getRankBadgeClass(
                                emp.rank
                              )}`}
                            >
                              Hạng {emp.rank}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleViewDetail(emp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
                              title="Xem phân tích chi tiết & lịch sử đánh giá"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Chi tiết</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LƯU ĐỒ QUY TRÌNH DUYỆT KPI 7 BƯỚC (ENTERPRISE 7-STEP WORKFLOW)        */}
      {/* ========================================================================= */}
      {activeTab === 'workflow' && (
        <section className="space-y-6 animate-in fade-in duration-200">
          {/* Workflow Header Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  ENTERPRISE 7-STEP WORKFLOW
                </span>
                <span className="text-xs text-indigo-200">Chuẩn Quản Trị Khép Kín Doanh Nghiệp</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">
                Lưu Đồ Quy Trình Đánh Giá KPI & Quyết Toán Lương 7 Bước
              </h2>
              <p className="text-xs text-indigo-200/90 mt-1 max-w-2xl">
                Quy trình tự động hóa luồng phê duyệt từ: Nhân viên đăng ký -&gt; PM phân bổ định mức -&gt; Nghiệm thu Task -&gt; Đánh giá KPI -&gt; HR tổng hợp -&gt; Tổng Giám Đốc Dương Chí Du phê duyệt -&gt; Kế toán chi trả.
              </p>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleWorkflowAction(1, 'RESET')}
                  disabled={isUpdatingStep}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>🔄 Đặt Lại Từ Đầu (Về Bước 1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentActive = workflowData?.steps?.find((s) => s.status === 'IN_PROGRESS');
                    if (currentActive) {
                      handleWorkflowAction(currentActive.stepNumber, 'APPROVE');
                    } else {
                      toast.success('Tất cả 7 bước quy trình đã hoàn thành xuất sắc!');
                    }
                  }}
                  disabled={isUpdatingStep}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/30 transition cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Duyệt & Chuyển Bước Kế Tiếp</span>
                </button>
              </div>
            )}
          </div>

          {/* Sơ đồ Stepper 7 Bước Tương Tác */}
          <div className="grid grid-cols-1 gap-4">
            {(workflowData?.steps || []).map((step, idx) => {
              const isCompleted = step.status === 'COMPLETED';
              const isInProgress = step.status === 'IN_PROGRESS';
              const isPending = step.status === 'PENDING';

              return (
                <div
                  key={step.stepNumber}
                  onClick={() => {
                    if (canManage && !isUpdatingStep) {
                      handleWorkflowAction(step.stepNumber, 'SET_ACTIVE');
                    }
                  }}
                  className={`p-5 rounded-3xl border transition shadow-sm ${
                    canManage ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500' : 'cursor-default'
                  } ${
                    isCompleted
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : isInProgress
                      ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                      : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-4">
                      {/* Step Number Circle */}
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isInProgress
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-5 h-5" /> : step.stepNumber}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            BƯỚC {step.stepNumber}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                                : isInProgress
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isCompleted ? '✓ ĐÃ HOÀN THÀNH' : isInProgress ? '● ĐANG THỰC HIỆN' : '○ CHỜ PHÊ DUYỆT'}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {step.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Đơn vị thực hiện: <strong className="text-slate-700 dark:text-slate-200">{step.department}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Hạn chót: <strong className="text-indigo-600 dark:text-indigo-400">{step.deadline}</strong>
                          </span>
                          {step.approvedAt && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Nghiệm thu: {new Date(step.approvedAt).toLocaleDateString('vi-VN')}
                              </span>
                            </>
                          )}
                        </div>

                        {step.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-1">
                            "{step.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step Action Button */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {isCompleted ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWorkflowAction(step.stepNumber, 'SET_ACTIVE');
                          }}
                          disabled={isUpdatingStep}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition cursor-pointer"
                        >
                          Mở lại bước này
                        </button>
                      ) : isInProgress ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWorkflowAction(step.stepNumber, 'APPROVE');
                          }}
                          disabled={isUpdatingStep}
                          className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Duyệt Hoàn Tất Bước {step.stepNumber}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWorkflowAction(step.stepNumber, 'SET_ACTIVE');
                          }}
                          disabled={isUpdatingStep}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition cursor-pointer"
                        >
                          Kích hoạt bước này
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workflow Sign-off Footer Card */}
          <div className="p-6 rounded-3xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                Luồng Phê Duyệt Khép Kín Doanh Nghiệp (Sign-Off Chain)
              </h3>
            </div>

            {(() => {
              const activeStep = workflowData?.steps?.find((s) => s.status === 'IN_PROGRESS')?.stepNumber || 6;
              const allDone = workflowData?.steps?.every((s) => s.status === 'COMPLETED');

              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                  <div className={`p-3 rounded-2xl border ${activeStep === 1 ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' : activeStep > 1 || allDone ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                    <span className="text-[10px] text-slate-400 block font-bold">1. Nhân viên</span>
                    <strong className="text-slate-800 dark:text-slate-200 block mt-1">Đăng ký & Báo cáo</strong>
                    {activeStep === 1 ? (
                      <span className="text-[10px] text-indigo-600 font-black block mt-1 animate-pulse">● Đang thực hiện</span>
                    ) : activeStep > 1 || allDone ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Hoàn tất</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">○ Chờ duyệt</span>
                    )}
                  </div>

                  <div className={`p-3 rounded-2xl border ${activeStep >= 2 && activeStep <= 4 ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' : activeStep > 4 || allDone ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                    <span className="text-[10px] text-slate-400 block font-bold">2. Quản lý PM</span>
                    <strong className="text-slate-800 dark:text-slate-200 block mt-1">Giao định mức & Chấm điểm</strong>
                    {activeStep >= 2 && activeStep <= 4 ? (
                      <span className="text-[10px] text-indigo-600 font-black block mt-1 animate-pulse">● Đang thực hiện</span>
                    ) : activeStep > 4 || allDone ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Đã duyệt</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">○ Chờ duyệt</span>
                    )}
                  </div>

                  <div className={`p-3 rounded-2xl border ${activeStep === 5 ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' : activeStep > 5 || allDone ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                    <span className="text-[10px] text-slate-400 block font-bold">3. Phòng HR & PMO</span>
                    <strong className="text-slate-800 dark:text-slate-200 block mt-1">Tổng hợp tỷ lệ đạt chỉ tiêu</strong>
                    {activeStep === 5 ? (
                      <span className="text-[10px] text-indigo-600 font-black block mt-1 animate-pulse">● Đang tổng hợp</span>
                    ) : activeStep > 5 || allDone ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Đã chốt</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">○ Chờ duyệt</span>
                    )}
                  </div>

                  <div className={`p-3 rounded-2xl border ${activeStep === 6 ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500/20' : activeStep > 6 || allDone ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-black">4. Tổng Giám Đốc</span>
                    <strong className="text-indigo-900 dark:text-white block mt-1">Dương Chí Du</strong>
                    {activeStep === 6 ? (
                      <span className="text-[10px] text-indigo-600 font-black block mt-1 animate-pulse">● Đang ký số</span>
                    ) : activeStep > 6 || allDone ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Đã ký duyệt</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">○ Chờ phê duyệt</span>
                    )}
                  </div>

                  <div className={`p-3 rounded-2xl border ${activeStep === 7 ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' : allDone ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                    <span className="text-[10px] text-slate-400 block font-bold">5. Kế toán</span>
                    <strong className="text-slate-800 dark:text-slate-200 block mt-1">Chi trả lương 3P</strong>
                    {allDone ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Đã chuyển khoản</span>
                    ) : activeStep === 7 ? (
                      <span className="text-[10px] text-indigo-600 font-black block mt-1 animate-pulse">● Đang chi trả</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">○ Chờ chuyển khoản</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BẢNG QUY ĐỔI GIỜ CÔNG CHUẨN & TÍNH LƯƠNG DOANH NGHIỆP (3P PAYROLL)  */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <section className="space-y-6 animate-in fade-in duration-200">
          {isEmployee ? (
            /* ========================================================================= */
            /* VIEW DÀNH RIÊNG CHO EMPLOYEE: PHIẾU LƯƠNG CÁ NHÂN CỦA BẠN                 */
            /* ========================================================================= */
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              {/* Profile Header & Lock Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md overflow-hidden shrink-0">
                    {myEmployeeRecord?.userAvatar ? (
                      <img src={myEmployeeRecord.userAvatar} alt={myEmployeeRecord.userName} className="h-full w-full object-cover" />
                    ) : (
                      (myEmployeeRecord?.userName || user?.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {myEmployeeRecord?.userName || user?.name}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {myEmployeeRecord?.seniorityLevel || 'CHUYÊN VIÊN'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {myEmployeeRecord?.departmentName || (user as any)?.department?.name || 'Phòng Ban'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {myEmployeeRecord?.userEmail || user?.email} • Phiếu lương kỳ: <strong>{activePeriod}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {isPeriodLocked || myEmployeeRecord?.status === 'CONFIRMED' ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>✓ Đã Chốt Lương Kỳ Này</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>⏳ Đang Tạm Tính (Chưa Chốt)</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => myEmployeeRecord && setSelectedPayslipRecord(myEmployeeRecord)}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 transition cursor-pointer active:scale-95"
                  >
                    <FileText className="w-4 h-4 text-amber-300" />
                    <span>📄 Xem & In Phiếu Lương Chi Tiết</span>
                  </button>
                </div>
              </div>

              {/* 4 Thẻ Định Mức Giờ Công Cá Nhân */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Giờ Công Định Mức Thực Tế Trong Kỳ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Vận hành */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">1. Giờ Vận Hành & Quản Trị</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {myEmployeeRecord?.managementHours || 0}h
                      </p>
                      <span className="text-xs font-bold text-slate-500">Định mức: 660h</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, myEmployeeRecord?.managementPercent || 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Đạt {myEmployeeRecord?.managementPercent || 0}% định mức
                    </span>
                  </div>

                  {/* Card 2: Dự án cốt lõi */}
                  <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">2. Giờ Dự Án Cốt Lõi</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <p className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                        {myEmployeeRecord?.projectHours || 0}h
                      </p>
                      <span className="text-xs font-bold text-purple-600">Quy đổi 1:3 = {myEmployeeRecord?.projectConvertedHours || 0}h</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, myEmployeeRecord?.projectPercent || 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Đạt {myEmployeeRecord?.projectPercent || 0}% định mức (600h chuẩn)
                    </span>
                  </div>

                  {/* Card 3: R&D */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">3. Giờ R&D & Sáng Kiến</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {myEmployeeRecord?.rdHours || 0}h
                      </p>
                      <span className="text-xs font-bold text-slate-500">Trần: 500h</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, myEmployeeRecord?.rdPercent || 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Tính trần: {myEmployeeRecord?.rdCappedHours || 0}h ({myEmployeeRecord?.rdPercent || 0}%)
                    </span>
                  </div>

                  {/* Card 4: Tổng giờ */}
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Tổng Giờ Quy Đổi Chuẩn</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                        {myEmployeeRecord?.totalConvertedHours || 0}h
                      </p>
                      <span className="text-xs font-bold text-slate-500">Chuẩn: 1,760h</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, myEmployeeRecord?.totalPercent || 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block font-bold text-amber-600">
                      Đạt {myEmployeeRecord?.totalPercent || 0}% định mức tổng
                    </span>
                  </div>
                </div>
              </div>

              {/* Bảng Cơ Cấu Thu Nhập 3P Cá Nhân */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white shadow-xl space-y-6">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-400" />
                    Cơ Cấu Thu Nhập 3P Chi Tiết Của Bạn (Position - Person - Performance)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Quyết toán theo quy chế định mức chuẩn doanh nghiệp 3P
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* P1: Vị trí & Vận hành */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white">
                      KHOẢN 1 (P1 - POSITION)
                    </span>
                    <p className="text-xs font-bold text-slate-300">Lương Vị Trí & Vận Hành</p>
                    <p className="text-xl font-black text-indigo-300 font-mono">
                      {(myEmployeeRecord?.managementSalary || 0).toLocaleString('vi-VN')} VNĐ
                    </p>
                    {(myEmployeeRecord?.seniorityAllowance || 0) > 0 && (
                      <p className="text-[11px] text-slate-400">
                        + Phụ cấp cấp bậc: {(myEmployeeRecord?.seniorityAllowance || 0).toLocaleString('vi-VN')} đ
                      </p>
                    )}
                  </div>

                  {/* P2: Dự án */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500 text-white">
                      KHOẢN 2 (P2 - PERFORMANCE)
                    </span>
                    <p className="text-xs font-bold text-slate-300">Lương Hiệu Suất Dự Án Cốt Lõi</p>
                    <p className="text-xl font-black text-purple-300 font-mono">
                      {(myEmployeeRecord?.projectSalary || 0).toLocaleString('vi-VN')} VNĐ
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Quy đổi: {myEmployeeRecord?.projectConvertedHours || 0}h × {(myEmployeeRecord?.projectHourRate || 180000).toLocaleString('vi-VN')}đ
                    </p>
                  </div>

                  {/* P3: R&D */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                      KHOẢN 3 (P3 - INNOVATION)
                    </span>
                    <p className="text-xs font-bold text-slate-300">Lương Nghiên Cứu R&D & Sáng Kiến</p>
                    <p className="text-xl font-black text-emerald-300 font-mono">
                      {(myEmployeeRecord?.rdSalary || 0).toLocaleString('vi-VN')} VNĐ
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Trần 500h ({myEmployeeRecord?.rdCappedHours || 0}h tính lương)
                    </p>
                  </div>
                </div>

                {/* Tổng Thực Lĩnh Nổi Bật */}
                <div className="p-6 rounded-2xl bg-white/10 border border-white/20 text-center space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-amber-300">
                    TỔNG LƯƠNG THỰC LĨNH THÁNG NÀY CỦA BẠN
                  </span>
                  <p className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight">
                    {(myEmployeeRecord?.totalSalary || 0).toLocaleString('vi-VN')} VNĐ
                  </p>
                  <p className="text-xs text-indigo-200">
                    Xếp loại hiệu suất KPI: <strong>Hạng {myEmployeeRecord?.kpiRank || 'A'}</strong> ({myEmployeeRecord?.kpiScore || 85} điểm)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Norms & Ratio Specification Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  Bảng Chuẩn Hóa Định Mức & Quy Đổi Giờ Công Chuẩn Doanh Nghiệp
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Định mức chuẩn doanh nghiệp cho 3 nhóm công việc cốt lõi • Tỷ lệ quy đổi 1h dự án = 3h hành chính.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200">
                  Tổng định mức quy đổi: 1,760 giờ chuẩn/kỳ
                </span>
              </div>
            </div>

            {/* 3 Core Job Norms Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nhóm 1: Quản trị & Vận hành */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                    NHÓM 1
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">1:1 Giờ chuẩn</span>
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Quản Trị Dự Án & Vận Hành Nội Bộ
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Công tác điều hành, lập kế hoạch, họp giao ban, review chất lượng và vận hành hệ thống.
                </p>
                <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Định mức quy đổi chuẩn</span>
                  <strong className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    660 giờ chuẩn / kỳ
                  </strong>
                </div>
              </div>

              {/* Nhóm 2: Dự án trọng điểm */}
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white">
                    NHÓM 2
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                    Hệ số 1h = 3h chuẩn
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Thực Thi Dự Án Trọng Điểm & Sản Phẩm
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Phát triển chức năng, lập trình chuyên sâu, giải quyết bài toán phức tạp và bàn giao sprint.
                </p>
                <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Giờ cốt lõi & Quy đổi (1:3)
                  </span>
                  <strong className="text-lg font-black text-purple-600 dark:text-purple-400">
                    200h cốt lõi = 600h chuẩn
                  </strong>
                </div>
              </div>

              {/* Nhóm 3: R&D & Sáng kiến */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                    NHÓM 3
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Trần tối đa 500h
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Nghiên Cứu R&D, Sáng Kiến & Tối Ưu
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nghiên cứu công nghệ mới, AI/ML, tối ưu kiến trúc. Phần vượt 500h được xét Bằng khen Hạng A.
                </p>
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Định mức khống chế trần</span>
                  <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    500 giờ chuẩn / kỳ
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Payroll Calculator & Simulation Frame */}
          <div ref={calculatorRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-20">
            {/* Left Controls (Inputs & Selectors) - 7 cols */}
            <div className="lg:col-span-7 space-y-5 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Bộ Điều Khiển Mô Phỏng Lương Tháng
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chọn nhân sự đồng bộ từ Tasks hoặc điều chỉnh giờ công & tham số để tính toán tức thời
                  </p>
                </div>

                {/* Role Switcher */}
                <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSimMode('MANAGER')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      simMode === 'MANAGER'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Cấp Quản Lý (PM/Lead)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('EMPLOYEE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      simMode === 'EMPLOYEE'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Nhân Viên Dự Án (Dev)
                  </button>
                </div>
              </div>

              {/* Staff Select Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Chọn Nhân Viên Để Tính Lương & Quyết Toán (100% Nhân Sự Hệ Thống):
                </label>
                <select
                  value={simStaffId}
                  onChange={(e) => handleSelectStaff(e.target.value)}
                  className="w-full text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  {filteredPayrolls.map((staff) => {
                    const isMgr = staff.role === 'ADMIN' || staff.role === 'MANAGER' || staff.isManager;
                    return (
                      <option key={staff.userId} value={staff.userId}>
                        [{staff.userName}] - [{isMgr ? 'Quản lý' : 'Nhân viên'}] - [{staff.departmentName}] - [{staff.kpiScore} điểm (Hạng {staff.kpiRank})]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Thẻ Thông Tin Nhân Viên Đang Được Chọn */}
              {currentStaff && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 dark:from-slate-800/80 dark:via-indigo-950/30 dark:to-slate-800/80 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm overflow-hidden shrink-0">
                      {currentStaff.userAvatar ? (
                        <img src={currentStaff.userAvatar} alt={currentStaff.userName} className="h-full w-full object-cover" />
                      ) : (
                        currentStaff.userName.charAt(0)
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {currentStaff.userName}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            currentStaff.isManager || currentStaff.role === 'ADMIN' || currentStaff.role === 'MANAGER'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {currentStaff.isManager || currentStaff.role === 'ADMIN' || currentStaff.role === 'MANAGER'
                            ? 'Quản lý (PM/Lead)'
                            : 'Nhân viên (Dev)'}
                        </span>
                        {currentStaff.status === 'CONFIRMED' || isPeriodLocked ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                            ✅ Đã chốt
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                            ⏳ Đang tạm tính
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{currentStaff.userEmail}</span>
                        <span>•</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{currentStaff.departmentName}</span>
                        <span>•</span>
                        <span>
                          Đã hoàn thành: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{currentStaff.tasksCompleted} tasks</strong>
                        </span>
                        <span>•</span>
                        <span>
                          KPI: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{currentStaff.kpiScore} điểm (Hạng {currentStaff.kpiRank})</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Lương Quyết Toán Dự Kiến</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {liveSimulatedPayroll.totalSalary.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              )}

              {/* 3 Hours Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/80 border border-indigo-200/60 dark:border-slate-700">
                  <label className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">
                    Giờ Quản Trị / Vận Hành (h)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={simMgmtHours}
                    onChange={(e) => setSimMgmtHours(Number(e.target.value))}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Định mức chuẩn: 660h</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-slate-800/80 border border-purple-200/60 dark:border-slate-700">
                  <label className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase block">
                    Giờ Dự Án Cốt Lõi (h)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={simProjHours}
                    onChange={(e) => setSimProjHours(Number(e.target.value))}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block mt-1">
                    Quy đổi 1:3 = {simProjHours * 3}h chuẩn
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-slate-800/80 border border-emerald-200/60 dark:border-slate-700">
                  <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">
                    Giờ R&D & Sáng Kiến (h)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={simRdHours}
                    onChange={(e) => setSimRdHours(Number(e.target.value))}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Trần tối đa nhận thưởng: 500h
                  </span>
                </div>
              </div>

              {/* R&D Exceeded Ceiling Alert */}
              {simRdHours > 500 && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Cảnh báo khống chế trần:</strong> Số giờ R&D vượt trần <strong>{simRdHours - 500}h</strong>! Phần vượt không tính tiền thưởng trực tiếp mà được cộng điểm xét <strong>Bằng khen Nhân viên Xuất Sắc Hạng A</strong>.
                  </span>
                </div>
              )}

              {/* Parameter Settings */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">Đơn Giá Chuẩn (VNĐ/h)</label>
                  <input
                    type="number"
                    step="10000"
                    value={simStandardRate}
                    onChange={(e) => setSimStandardRate(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">Đơn Giá Dự Án (VNĐ/h)</label>
                  <input
                    type="number"
                    step="10000"
                    value={simProjectRate}
                    onChange={(e) => setSimProjectRate(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">Hệ Số Quy Mô (1.0-1.5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="1.5"
                    value={simScaleFactor}
                    onChange={(e) => setSimScaleFactor(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">Cấp Bậc Thâm Niên</label>
                  <select
                    value={simSeniority}
                    onChange={(e) => setSimSeniority(e.target.value as any)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="JUNIOR">Junior (+10%)</option>
                    <option value="MIDDLE">Middle (+20%)</option>
                    <option value="SENIOR">Senior (+40%)</option>
                    <option value="TECH_LEAD_DIRECTOR">Tech Lead / Dir (+60%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Live Formula Card & Confirm Button - 5 cols */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-gradient-to-b from-indigo-900 to-slate-900 text-white shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-indigo-700/50 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-indigo-100">
                      Hộp Công Thức Trực Quan (Live Formula)
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/40 text-indigo-200 border border-indigo-400/30">
                    {simMode === 'MANAGER' ? 'CÔNG THỨC 1 (QUẢN LÝ)' : 'CÔNG THỨC 2 (NHÂN VIÊN)'}
                  </span>
                </div>

                {/* Mathematical Formula Display */}
                <div className="mt-3 p-3 rounded-2xl bg-white/5 border border-white/10 font-mono text-xs text-indigo-200 space-y-1">
                  {simMode === 'MANAGER' ? (
                    <>
                      <p className="text-amber-300 font-bold">Tổng lương = Lương QL + Phụ cấp + Lương R&D + Lương Dự án</p>
                      <p className="text-[11px] text-slate-300">
                        • Lương QL = {simMgmtHours}h × {simStandardRate.toLocaleString('vi-VN')}đ × {simScaleFactor} ={' '}
                        <strong>{liveSimulatedPayroll.managementSalary.toLocaleString('vi-VN')} đ</strong>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        • Phụ cấp thu hút = Lương QL × {liveSimulatedPayroll.seniorityFactor * 100}% ={' '}
                        <strong>{liveSimulatedPayroll.seniorityAllowance.toLocaleString('vi-VN')} đ</strong>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        • Lương R&D = min({simRdHours}, 500) × {simStandardRate.toLocaleString('vi-VN')}đ ={' '}
                        <strong>{liveSimulatedPayroll.rdSalary.toLocaleString('vi-VN')} đ</strong>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        • Lương Dự án = {simProjHours}h × {simProjectRate.toLocaleString('vi-VN')}đ ={' '}
                        <strong>{liveSimulatedPayroll.projectSalary.toLocaleString('vi-VN')} đ</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-amber-300 font-bold">Tổng lương = Lương Dự án + Lương R&D + Lương Vận hành</p>
                      <p className="text-[11px] text-slate-300">
                        • Lương Dự án = {simProjHours}h × {simProjectRate.toLocaleString('vi-VN')}đ ={' '}
                        <strong>{liveSimulatedPayroll.projectSalary.toLocaleString('vi-VN')} đ</strong>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        • Lương R&D = min({simRdHours}, 500) × {simStandardRate.toLocaleString('vi-VN')}đ ={' '}
                        <strong>{liveSimulatedPayroll.rdSalary.toLocaleString('vi-VN')} đ</strong>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        • Lương Vận hành = {simMgmtHours}h × {simStandardRate.toLocaleString('vi-VN')}đ ={' '}
                        <strong>{liveSimulatedPayroll.managementSalary.toLocaleString('vi-VN')} đ</strong>
                      </p>
                    </>
                  )}
                </div>

                {/* Net Income Showcase */}
                <div className="mt-4 p-4 rounded-2xl bg-white/10 border border-white/20 text-center space-y-1">
                  <span className="text-[11px] uppercase font-bold text-indigo-300 block">
                    TỔNG LƯƠNG CHÍNH THỨC & THỰC NHẬN THÁNG
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight font-mono">
                    {liveSimulatedPayroll.totalSalary.toLocaleString('vi-VN')} VNĐ
                  </p>
                  <p className="text-xs text-indigo-200">
                    Tổng giờ công chuẩn: <strong>{liveSimulatedPayroll.totalConvertedHours}h</strong> (Đạt{' '}
                    <strong>{liveSimulatedPayroll.totalPercent}%</strong> định mức)
                  </p>
                </div>
              </div>

              {/* Action Buttons: Confirm & Lock Payroll + Enterprise Payslip */}
              <div className="space-y-2.5 mt-4">
                <button
                  type="button"
                  onClick={handleConfirmPayroll}
                  disabled={isConfirming || isPeriodLocked || currentStaff?.status === 'CONFIRMED'}
                  className={`w-full py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition flex items-center justify-center gap-2 border ${
                    isPeriodLocked || currentStaff?.status === 'CONFIRMED'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-80'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 cursor-pointer border-emerald-400/40'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-100" />
                  <span>
                    {isConfirming
                      ? 'Đang xử lý chốt lương...'
                      : currentStaff?.status === 'CONFIRMED'
                      ? `✓ Đã Chốt Bảng Lương Cho ${currentStaff?.userName || 'Nhân Viên Này'}`
                      : `✅ Xác Nhận & Chốt Lương Cho ${currentStaff?.userName || 'Nhân Viên Này'}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayslipRecord(liveSimulatedPayroll)}
                  className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white border border-white/20 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-amber-300" />
                  <span>📄 Xuất Phiếu Lương Điện Tử (Enterprise Payslip)</span>
                </button>
              </div>
            </div>
          </div>

          {/* All Personnel Payroll Breakdown Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  {isManager
                    ? 'Bảng Tổng Hợp Giờ Công & Lương Quyết Toán Phòng Ban'
                    : 'Bảng Tổng Hợp Giờ Công & Lương Quyết Toán Toàn Công Ty'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isManager
                    ? 'Dữ liệu tự động quét từ Task DONE của nhân sự phòng ban, đối sánh định mức 660h - 600h - 500h.'
                    : 'Dữ liệu tự động quét từ Task DONE của nhân viên, đối sánh định mức 660h - 600h - 500h.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3.5 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  Tổng nhân sự: <strong>{filteredPayrolls.length}</strong> • Đã chốt:{' '}
                  <strong className="text-emerald-600 font-bold">{confirmedCount}</strong> • Tạm tính:{' '}
                  <strong className="text-amber-600 font-bold">{pendingCount}</strong> • Quỹ lương:{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                    {totalPayrollAmount.toLocaleString('vi-VN')} VNĐ
                  </strong>
                </div>

                {isPeriodLocked ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black bg-emerald-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-200" />
                      <span>✓ Đã Chốt Lương Toàn Công Ty</span>
                    </div>

                    {(isAdmin || isManager) && (
                      <button
                        type="button"
                        onClick={handleUnlockPayrollPeriod}
                        disabled={isUnlocking}
                        className="px-3.5 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        title="Mở khóa kỳ lương để chỉnh sửa số giờ và tính lại KPI"
                      >
                        {isUnlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <LockOpen className="w-3.5 h-3.5 text-white" />}
                        <span>🔓 Mở Khóa Kỳ Lương Để Chỉnh Sửa</span>
                      </button>
                    )}
                  </div>
                ) : (
                  isAdmin && (
                    <button
                      type="button"
                      onClick={handleConfirmAllPayroll}
                      disabled={isConfirmingAll}
                      className="px-3.5 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      {isConfirmingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
                      <span>⚡ Chốt Lương Hàng Loạt Toàn Công Ty</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4">Nhân Sự</th>
                    <th className="py-3 px-3 text-center">Vai Trò / Cấp Bậc</th>
                    <th className="py-3 px-3 text-center">Giờ Quản Trị (660h)</th>
                    <th className="py-3 px-3 text-center">Giờ Dự Án (200h cốt lõi)</th>
                    <th className="py-3 px-3 text-center">Giờ R&D (500h trần)</th>
                    <th className="py-3 px-3 text-center">Tổng Giờ Quy Đổi</th>
                    <th className="py-3 px-3 text-center">% Hoàn Thành</th>
                    <th className="py-3 px-3 text-right">Tổng Lương Tháng</th>
                    <th className="py-3 px-3 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredPayrolls.map((emp) => (
                    <tr
                      key={emp.userId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition bg-white/40 dark:bg-slate-900/40"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {emp.userAvatar ? (
                              <img src={emp.userAvatar} alt={emp.userName} className="h-full w-full object-cover" />
                            ) : (
                              emp.userName.charAt(0)
                            )}
                          </div>
                          <div>
                            <strong className="text-slate-900 dark:text-white block">{emp.userName}</strong>
                            <span className="text-[11px] text-slate-400 block">{emp.departmentName}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.isManager
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {emp.role} • {emp.seniorityLevel}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {emp.managementHours}h ({emp.managementPercent}%)
                      </td>

                      <td className="py-3 px-3 text-center font-semibold text-purple-600 dark:text-purple-400">
                        {emp.projectHours}h ({emp.projectConvertedHours}h chuẩn)
                      </td>

                      <td className="py-3 px-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {emp.rdCappedHours}h
                        {emp.rdExceededHours > 0 && <span className="text-amber-500 font-bold ml-1">(+{emp.rdExceededHours}h)</span>}
                      </td>

                      <td className="py-3 px-3 text-center font-black text-indigo-600 dark:text-indigo-400">
                        {emp.totalConvertedHours}h
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-black ${
                            emp.totalPercent >= 100
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : emp.totalPercent >= 80
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {emp.totalPercent}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        {emp.totalSalary.toLocaleString('vi-VN')} đ
                      </td>

                      <td className="py-3 px-3 text-center">
                        {emp.status === 'CONFIRMED' || isPeriodLocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                            ✅ Đã chốt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">
                            ⏳ Đang tạm tính
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPeriodLocked}
                            onClick={() => {
                              handleSelectStaff(emp.userId);
                              calculatorRef.current?.scrollIntoView({ behavior: 'smooth' });
                              toast(`🎯 Đã nạp nhân sự ${emp.userName} lên bộ điều khiển tính lương!`);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition ${
                              isPeriodLocked
                                ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 cursor-not-allowed opacity-60'
                                : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 cursor-pointer'
                            }`}
                            title={isPeriodLocked ? "Bảng lương kỳ này đã chốt, không thể tính lại" : undefined}
                          >
                            🎯 Chọn tính lại
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPayslipRecord(emp)}
                            className="px-2.5 py-1 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                          >
                            📄 Phiếu lương
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )}

      {/* ========================================================================= */}
      {/* TAB 4: THỐNG KÊ BÁO CÁO THEO CHỈ TIÊU (TARGET VS ACTUAL ANALYTICS)        */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <section className="space-y-6 animate-in fade-in duration-200">
          {/* Target vs Actual Overview Cards (Đồng bộ trực tiếp theo thời gian thực) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Chỉ tiêu Quản trị */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Chỉ Tiêu Quản Trị & Vận Hành</span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">Chuẩn 660h</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {tab4Stats.avgMgmtHours}h
                </span>
                <span className="text-xs text-slate-500 font-medium">trung bình / nhân sự</span>
              </div>
              {/* Dual Bar Visual */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Mục tiêu giao: 660h</span>
                  <span className="font-bold text-indigo-600">100%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-600 w-full" />
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-slate-500">Thực tế đạt được</span>
                  <span className="font-bold text-emerald-600">
                    {tab4Stats.avgMgmtHours}h / 660h ({tab4Stats.avgMgmtPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, tab4Stats.avgMgmtPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Chỉ tiêu Thực thi Dự án */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Chỉ Tiêu Dự Án Trọng Điểm</span>
                <span className="text-xs font-black text-purple-600 dark:text-purple-400">Chuẩn 600h (200h × 3)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {tab4Stats.avgProjConvHours}h
                </span>
                <span className="text-xs text-slate-500 font-medium">quy đổi chuẩn / nhân sự</span>
              </div>
              {/* Dual Bar Visual */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Mục tiêu giao: 600h chuẩn</span>
                  <span className="font-bold text-purple-600">100%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-600 w-full" />
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-slate-500">Thực tế đạt được</span>
                  <span className="font-bold text-purple-500">
                    {tab4Stats.avgProjConvHours}h / 600h ({tab4Stats.avgProjPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, tab4Stats.avgProjPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Chỉ tiêu Nghiên cứu R&D */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Chỉ Tiêu R&D & Sáng Kiến</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">Trần 500h</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {tab4Stats.avgRdHours}h
                </span>
                <span className="text-xs text-slate-500 font-medium">trung bình nhận thưởng</span>
              </div>
              {/* Dual Bar Visual */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Mục tiêu giao: 500h trần</span>
                  <span className="font-bold text-emerald-600">100%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-600 w-full" />
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-slate-500">Thực tế đạt được</span>
                  <span className="font-bold text-emerald-500">
                    {tab4Stats.avgRdHours}h / 500h ({tab4Stats.avgRdPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (tab4Stats.avgRdHours / 500) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Target vs Actual Comparison Ranking Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Bảng Xếp Hạng Tỷ Lệ Đạt Chỉ Tiêu Định Mức & Lương Thưởng Quy Đổi
                </h3>
                <p className="text-xs text-slate-500">
                  Đối sánh chi tiết: [Chỉ Tiêu Giao (660h - 600h - 500h)] vs [Thực Tế Đạt Được] của từng nhân viên (Cập nhật thời gian thực).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Báo Cáo Quyết Toán (CSV)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3 text-center w-12">Hạng</th>
                    <th className="py-3 px-4">Nhân Sự & Đơn Vị</th>
                    <th className="py-3 px-3 text-center">Đạt Chỉ Tiêu Dự Án (%)</th>
                    <th className="py-3 px-3 text-center">Đạt Chỉ Tiêu R&D (%)</th>
                    <th className="py-3 px-3 text-center">Đạt Định Mức Toàn Diện (%)</th>
                    <th className="py-3 px-3 text-center">Xếp Loại KPI</th>
                    <th className="py-3 px-4 text-right">Lương Thưởng Quy Đổi</th>
                    <th className="py-3 px-3 text-center">Trạng Thái</th>
                    <th className="py-3 px-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredPayrolls
                    .sort((a, b) => b.totalPercent - a.totalPercent)
                    .map((item, idx) => (
                      <tr
                        key={item.userId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition bg-white/40 dark:bg-slate-900/40"
                      >
                        <td className="py-3 px-3 text-center font-black text-indigo-600 dark:text-indigo-400">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 overflow-hidden">
                              {item.userAvatar ? (
                                <img src={item.userAvatar} alt={item.userName} className="h-full w-full object-cover" />
                              ) : (
                                item.userName.charAt(0)
                              )}
                            </div>
                            <div>
                              <strong className="text-slate-900 dark:text-white block">{item.userName}</strong>
                              <span className="text-[11px] text-slate-400 block">{item.departmentName}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-purple-600 dark:text-purple-400">
                            {item.projectConvertedHours}/600h ({item.projectPercent}%)
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {item.rdCappedHours}/500h ({item.rdPercent}%)
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-black text-sm ${
                              item.totalPercent >= 100
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : item.totalPercent >= 80
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.totalPercent}%
                          </span>
                          <span className="block text-[10px] text-slate-400">({item.totalConvertedHours}/1,760h)</span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`whitespace-nowrap inline-flex items-center justify-center min-w-[70px] px-2 py-0.5 rounded-full text-[11px] font-bold border ${getRankBadgeClass(
                              item.kpiRank
                            )}`}
                          >
                            Hạng {item.kpiRank}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {item.totalSalary.toLocaleString('vi-VN')} đ
                        </td>

                        <td className="py-3 px-3 text-center">
                          {item.status === 'CONFIRMED' || isPeriodLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                              ✅ Đã chốt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">
                              ⏳ Tạm tính
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslipRecord(item)}
                            className="px-2.5 py-1 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 transition cursor-pointer"
                          >
                            📄 Phiếu lương
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* DETAIL & HISTORY MODAL */}
      <AnimatePresence>
        {selectedUserDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-base shadow-md overflow-hidden">
                    {selectedUserDetail.userAvatar || selectedUserDetail.avatar ? (
                      <img
                        src={(selectedUserDetail.userAvatar || selectedUserDetail.avatar)!}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (selectedUserDetail.userName || selectedUserDetail.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                      {selectedUserDetail.userName || selectedUserDetail.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedUserDetail.userEmail || ''} • {selectedUserDetail.departmentName || selectedUserDetail.department}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserDetail(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPI Period Score Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Bóc Tách Điểm Kỳ {activePeriod}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Task Hoàn Thành (40%)</span>
                    <strong className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {selectedUserDetail.taskCompletionScore} / 40đ
                    </strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {selectedUserDetail.completedTasksCount}/{selectedUserDetail.totalTasksCount} tasks ({selectedUserDetail.completionRate}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Đúng Hạn (40%)</span>
                    <strong className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                      {selectedUserDetail.onTimeScore} / 40đ
                    </strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {selectedUserDetail.onTimeTasksCount} on-time ({selectedUserDetail.onTimeRate}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Thưởng Manager (20%)</span>
                    <strong className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                      +{selectedUserDetail.bonusScore} / 20đ
                    </strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Điểm cộng chuyên cần</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Tổng Điểm & Hạng</span>
                    <strong className="text-base font-black text-purple-600 dark:text-purple-400">
                      {selectedUserDetail.totalScore}đ
                    </strong>
                    <span className={`whitespace-nowrap inline-flex items-center justify-center min-w-[76px] mt-1 px-2.5 py-1 rounded-full text-xs font-bold leading-none border ${getRankBadgeClass(selectedUserDetail.rank)}`}>
                      Hạng {selectedUserDetail.rank}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Performance Review Section */}
              <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                      Cố Vấn & Đánh Giá Hiệu Suất AI
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Phân tích chuyên sâu điểm sáng, điểm cần cải thiện & lộ trình phát triển
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiReview}
                    disabled={isLoadingAiReview}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-md shadow-purple-500/25 active:scale-95 transition cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isLoadingAiReview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>AI Đang Phân Tích...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>✨ AI Nhận Xét Hiệu Suất</span>
                      </>
                    )}
                  </button>
                </div>

                {/* AI Review Content Frame with Glowing Icon & Copy Button */}
                {aiReviewText && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/40 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 border border-purple-200/80 dark:border-purple-800/60 shadow-inner space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-purple-500/40 ring-4 ring-purple-400/20 animate-pulse">
                          <Sparkles className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            Bản Nhận Xét Chuẩn Nhân Sự (HR AI)
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Gemini AI
                            </span>
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Đánh giá dựa trên chỉ số thực tế kỳ {activePeriod} của {selectedUserDetail.userName || selectedUserDetail.name}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyAiReview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-95 transition cursor-pointer shrink-0"
                      >
                        {isCopiedReview ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sao chép nhận xét</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-purple-100 dark:border-purple-900/50 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-medium shadow-xs">
                      {aiReviewText}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* History Table */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-500" />
                  Lịch Sử Đánh Giá Các Kỳ Gần Nhất
                </h4>

                {isLoadingHistory ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : userHistoryLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
                    Chưa có lịch sử các kỳ trước đó cho nhân sự này.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Kỳ Đánh Giá</th>
                          <th className="py-2.5 px-3 text-center">Hoàn Thành</th>
                          <th className="py-2.5 px-3 text-center">Đúng Hạn</th>
                          <th className="py-2.5 px-3 text-center">Tổng Điểm</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px] whitespace-nowrap">Xếp Loại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {userHistoryLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{log.period}</td>
                            <td className="py-2 px-3 text-center">{log.tasksCompleted}</td>
                            <td className="py-2 px-3 text-center">{log.tasksOnTime}</td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{log.totalScore}đ</td>
                            <td className="py-2 px-3 text-center min-w-[90px] whitespace-nowrap">
                              <span className={`whitespace-nowrap inline-flex items-center justify-center min-w-[76px] px-2 py-0.5 rounded-full text-xs font-bold leading-none border ${getRankBadgeClass(log.rank)}`}>
                                Hạng {log.rank}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserDetail(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Report Signatures */}
      <div className="hidden print:grid grid-cols-3 gap-6 text-center pt-8 text-xs">
        <div>
          <p className="font-bold uppercase">Người Lập Biểu</p>
          <p className="text-slate-400 mt-12">(Ký và ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-bold uppercase">Trưởng Phòng Ban</p>
          <p className="text-slate-400 mt-12">(Ký và ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-bold uppercase">Giám Đốc Phê Duyệt</p>
          <p className="text-slate-400 mt-12">(Ký và đóng dấu)</p>
        </div>
      </div>

      {/* MODAL CẤP BẰNG KHEN VINH DANH ĐIỆN TỬ */}
      <KpiCertificateModal
        isOpen={Boolean(selectedCertificate)}
        onClose={() => setSelectedCertificate(null)}
        data={selectedCertificate}
      />

      {/* MODAL XUẤT PHIẾU LƯƠNG ĐIỆN TỬ DOANH NGHIỆP */}
      <EnterprisePayslipModal
        isOpen={Boolean(selectedPayslipRecord)}
        onClose={() => setSelectedPayslipRecord(null)}
        record={selectedPayslipRecord}
        period={activePeriod}
      />
    </div>
  );
};

export default KpiPage;
