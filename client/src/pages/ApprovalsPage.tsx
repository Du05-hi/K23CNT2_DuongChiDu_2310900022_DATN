import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileCheck2,
  Clock3,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Check,
  X,
  Trash2,
  Eye,
  RefreshCw,
  Send,
  Laptop,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  UserCheck,
  CalendarDays,
  FileText,
  BadgeAlert,
  CheckCheck,
  Ban,
  RotateCcw,
  Info,
  Edit3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppSelector } from '@/store';
import approvalService, {
  ApprovalRequest,
  ApprovalType,
  ApprovalPriority,
  ApprovalStatus,
  CreateApprovalDTO,
  ReviewApprovalDTO,
  BatchReviewDTO,
  AiAnalysisResult,
  TaskOption,
} from '@/services/approvalService';

export const ApprovalsPage: React.FC = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const userRole = currentUser?.role || 'EMPLOYEE';
  const isApprover = userRole === 'ADMIN' || userRole === 'MANAGER';

  // Filters & Search State
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isBatchRejectModalOpen, setIsBatchRejectModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isReevaluateModalOpen, setIsReevaluateModalOpen] = useState(false);

  // Active items for modals
  const [activeApproval, setActiveApproval] = useState<ApprovalRequest | null>(null);
  const [approvalToCancel, setApprovalToCancel] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [batchRejectReason, setBatchRejectReason] = useState<string>('');

  // Re-evaluate State
  const [reevaluateAction, setReevaluateAction] = useState<'APPROVE' | 'REJECT' | 'RESET_PENDING'>('REJECT');
  const [reevaluateNote, setReevaluateNote] = useState<string>('');

  // AI Analysis State
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<AiAnalysisResult | null>(null);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State for Create Modal
  const [formType, setFormType] = useState<ApprovalType>('LEAVE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<ApprovalPriority>('MEDIUM');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formTaskId, setFormTaskId] = useState('');
  const [formOtHours, setFormOtHours] = useState('2');
  const [formResourceCategory, setFormResourceCategory] = useState('Màn hình phụ');

  // Danh sách đề xuất & trạng thái dữ liệu
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    total: 0,
  });

  // Gợi ý lý do từ chối 1 chạm chuẩn mực Enterprise
  const QUICK_REJECT_PRESETS = [
    'Chưa sắp xếp được nhân sự thay thế.',
    'Vượt quá định mức ngân sách/giờ công.',
    'Vui lòng cập nhật lại kế hoạch chi tiết trước khi gửi lại.',
  ];

  // Hàm tải dữ liệu đề xuất xử lý linh hoạt mọi cấu trúc response
  const fetchApprovals = useCallback(
    async (isSilent = false) => {
      try {
        if (isSilent) {
          setIsRefetching(true);
        } else {
          setIsLoading(true);
        }

        const filters = {
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          type: selectedType !== 'ALL' ? selectedType : undefined,
          priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
          search: searchQuery.trim() || undefined,
        };

        const res = await approvalService.getApprovals(filters);

        const list: ApprovalRequest[] = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.data?.data)
          ? (res as any).data.data
          : Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.approvals)
          ? (res as any).approvals
          : [];

        setApprovals(list);

        // Xóa selection những id không còn trong danh sách hoặc không còn PENDING
        setSelectedIds((prev) =>
          prev.filter((id) => list.some((item) => item.id === id && item.status === 'PENDING'))
        );

        // Đếm đúng số đơn: Chờ duyệt (vàng), Đã duyệt (xanh), Bị từ chối (đỏ), Tổng số (xanh dương)
        const statsObj = (res as any)?.stats || (res as any)?.metrics;
        const pending =
          typeof statsObj?.pending === 'number'
            ? statsObj.pending
            : list.filter((item) => item.status === 'PENDING').length;
        const approved =
          typeof statsObj?.approved === 'number'
            ? statsObj.approved
            : list.filter((item) => item.status === 'APPROVED').length;
        const rejected =
          typeof statsObj?.rejected === 'number'
            ? statsObj.rejected
            : list.filter((item) => item.status === 'REJECTED').length;
        const cancelled =
          typeof statsObj?.cancelled === 'number'
            ? statsObj.cancelled
            : list.filter((item) => item.status === 'CANCELLED').length;
        const total = typeof statsObj?.total === 'number' ? statsObj.total : list.length;

        setStats({
          pending,
          approved,
          rejected,
          cancelled,
          total,
        });
      } catch (err: any) {
        console.error('Lỗi khi fetch danh sách đề xuất:', err);
        toast.error(err?.response?.data?.message || 'Không thể tải danh sách đề xuất.');
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    },
    [selectedStatus, selectedType, selectedPriority, searchQuery]
  );

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Query: Lấy danh sách tasks cá nhân khi mở modal
  const { data: myTasks = [] } = useQuery({
    queryKey: ['my-tasks-for-approval'],
    queryFn: () => approvalService.getMyTasks(),
    enabled: isCreateModalOpen && formType === 'EXTEND_DEADLINE',
  });

  // Mutation: Tạo đề xuất
  const createMutation = useMutation({
    mutationFn: (payload: CreateApprovalDTO) => approvalService.createApproval(payload),
    onSuccess: async () => {
      toast.success('Gửi đề xuất thành công! Đã chuyển tiếp tới cấp trên.');
      setIsCreateModalOpen(false);
      resetForm();
      await fetchApprovals(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể tạo đề xuất.');
    },
  });

  // Mutation: Duyệt, Từ chối hoặc Đổi quyết định xét duyệt
  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewApprovalDTO }) =>
      approvalService.reviewApproval(id, payload),
    onSuccess: async (_, variables) => {
      const action = variables.payload.action || variables.payload.status;
      if (action === 'APPROVE' || action === 'APPROVED') {
        toast.success('Đã phê duyệt đề xuất thành công!');
      } else if (action === 'REJECT' || action === 'REJECTED') {
        toast.success('Đã từ chối đề xuất và gửi phản hồi.');
      } else {
        toast.success('Đã khôi phục đề xuất về trạng thái Chờ duyệt.');
      }
      setIsRejectModalOpen(false);
      setIsAiModalOpen(false);
      setIsReevaluateModalOpen(false);
      setActiveApproval(null);
      setRejectReason('');
      setReevaluateNote('');
      await fetchApprovals(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Lỗi khi xử lý phê duyệt.');
    },
  });

  // Mutation: Người gửi tự hủy đề xuất (khi PENDING)
  const cancelMutation = useMutation({
    mutationFn: (id: string) => approvalService.cancelApproval(id),
    onSuccess: async () => {
      toast.success('Đã hủy đề xuất thành công.');
      setIsCancelModalOpen(false);
      setApprovalToCancel(null);
      await fetchApprovals(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể hủy đề xuất này.');
    },
  });

  // Mutation: Thao tác hàng loạt (Batch Review)
  const batchReviewMutation = useMutation({
    mutationFn: (payload: BatchReviewDTO) => approvalService.batchReviewApprovals(payload),
    onSuccess: async (data, variables) => {
      const isApproved = variables.action === 'APPROVE';
      toast.success(
        isApproved
          ? `Đã phê duyệt thành công ${data.processedCount || selectedIds.length} đề xuất!`
          : `Đã từ chối ${data.processedCount || selectedIds.length} đề xuất với phản hồi.`
      );
      setSelectedIds([]);
      setIsBatchRejectModalOpen(false);
      setBatchRejectReason('');
      await fetchApprovals(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể xử lý thao tác hàng loạt.');
    },
  });

  // Mutation: Xóa vĩnh viễn (ADMIN hoặc chủ đơn khi PENDING)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => approvalService.deleteApproval(id),
    onSuccess: async () => {
      toast.success('Đã xóa đề xuất khỏi hệ thống.');
      setIsDetailModalOpen(false);
      setActiveApproval(null);
      await fetchApprovals(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể xóa đề xuất này.');
    },
  });

  const resetForm = () => {
    setFormType('LEAVE');
    setFormTitle('');
    setFormDescription('');
    setFormPriority('MEDIUM');
    setFormStartDate('');
    setFormEndDate('');
    setFormTaskId('');
    setFormOtHours('2');
    setFormResourceCategory('Màn hình phụ');
  };

  // Mở Popup Từ Chối
  const handleOpenRejectModal = (approval: ApprovalRequest) => {
    setActiveApproval(approval);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  // Xác nhận Từ Chối Đơn lẻ
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApproval) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      toast.error('Lý do từ chối là bắt buộc (tối thiểu 5 ký tự).');
      return;
    }
    reviewMutation.mutate({
      id: activeApproval.id,
      payload: {
        action: 'REJECT',
        responseNote: rejectReason.trim(),
      },
    });
  };

  // Duyệt Nhanh 1 đơn
  const handleQuickApprove = (approval: ApprovalRequest) => {
    reviewMutation.mutate({
      id: approval.id,
      payload: {
        action: 'APPROVE',
        responseNote: 'Đã phê duyệt yêu cầu.',
      },
    });
  };

  // Mở Modal Đổi Quyết Định (Re-evaluate)
  const handleOpenReevaluate = (approval: ApprovalRequest) => {
    setActiveApproval(approval);
    if (approval.status === 'APPROVED') {
      setReevaluateAction('REJECT');
      setReevaluateNote('');
    } else if (approval.status === 'REJECTED') {
      setReevaluateAction('APPROVE');
      setReevaluateNote('Phê duyệt lại sau khi trao đổi.');
    } else {
      setReevaluateAction('RESET_PENDING');
      setReevaluateNote('');
    }
    setIsReevaluateModalOpen(true);
  };

  // Xác nhận Đổi Quyết Định
  const handleConfirmReevaluate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApproval) return;

    if (reevaluateAction === 'REJECT' && (!reevaluateNote.trim() || reevaluateNote.trim().length < 5)) {
      toast.error('Lý do từ chối là bắt buộc (tối thiểu 5 ký tự).');
      return;
    }

    reviewMutation.mutate({
      id: activeApproval.id,
      payload: {
        action: reevaluateAction,
        responseNote: reevaluateNote.trim(),
      },
    });
  };

  // Mở Modal Hủy Đơn cho Employee
  const handleOpenCancelModal = (approval: ApprovalRequest) => {
    setApprovalToCancel(approval);
    setIsCancelModalOpen(true);
  };

  // Xác nhận Hủy Đơn
  const handleConfirmCancel = () => {
    if (!approvalToCancel) return;
    cancelMutation.mutate(approvalToCancel.id);
  };

  // Xem Chi Tiết
  const handleOpenDetail = (approval: ApprovalRequest) => {
    setActiveApproval(approval);
    setIsDetailModalOpen(true);
  };

  // Phân Tích AI
  const handleAnalyzeAI = async (approval: ApprovalRequest) => {
    setActiveApproval(approval);
    setIsAiModalOpen(true);
    setAiLoading(true);
    setAiAnalysisData(null);

    try {
      const data = await approvalService.analyzeApprovalWithAI(approval.id);
      setAiAnalysisData(data);
    } catch (err: any) {
      console.error('Lỗi khi phân tích AI:', err);
      toast.error(err?.response?.data?.message || 'Không thể thẩm định đề xuất bằng AI.');
    } finally {
      setAiLoading(false);
    }
  };

  // Xử lý Batch Selection Checkbox
  const pendingApprovalsOnScreen = useMemo(
    () => approvals.filter((a) => a.status === 'PENDING'),
    [approvals]
  );

  const isAllPendingSelected = useMemo(
    () =>
      pendingApprovalsOnScreen.length > 0 &&
      pendingApprovalsOnScreen.every((a) => selectedIds.includes(a.id)),
    [pendingApprovalsOnScreen, selectedIds]
  );

  const handleToggleSelectAll = () => {
    if (isAllPendingSelected) {
      const currentPendingIds = new Set(pendingApprovalsOnScreen.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !currentPendingIds.has(id)));
    } else {
      const currentPendingIds = pendingApprovalsOnScreen.map((a) => a.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPendingIds])));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Thao tác hàng loạt: Duyệt tất cả
  const handleBatchApprove = () => {
    if (selectedIds.length === 0) return;
    if (
      window.confirm(
        `Bạn có chắc chắn muốn phê duyệt đồng loạt ${selectedIds.length} đề xuất đã chọn?`
      )
    ) {
      batchReviewMutation.mutate({
        ids: selectedIds,
        action: 'APPROVE',
        responseNote: 'Phê duyệt đồng loạt theo thẩm định.',
      });
    }
  };

  // Thao tác hàng loạt: Xác nhận từ chối
  const handleConfirmBatchReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchRejectReason.trim() || batchRejectReason.trim().length < 5) {
      toast.error('Lý do từ chối hàng loạt là bắt buộc (tối thiểu 5 ký tự).');
      return;
    }
    batchReviewMutation.mutate({
      ids: selectedIds,
      action: 'REJECT',
      responseNote: batchRejectReason.trim(),
    });
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề đề xuất.');
      return;
    }
    if (!formDescription.trim()) {
      toast.error('Vui lòng nhập mô tả chi tiết lý do đề xuất.');
      return;
    }

    if (formType === 'EXTEND_DEADLINE') {
      if (!formTaskId) {
        toast.error('Vui lòng chọn công việc cần xin gia hạn deadline.');
        return;
      }
      if (!formEndDate) {
        toast.error('Vui lòng chọn hạn chót mới mong muốn.');
        return;
      }
    }

    if (formType === 'LEAVE' && (!formStartDate || !formEndDate)) {
      toast.error('Vui lòng chọn ngày bắt đầu và ngày kết thúc nghỉ phép.');
      return;
    }

    let payloadDescription = formDescription.trim();
    if (formType === 'OT') {
      payloadDescription = `[Đăng ký ${formOtHours} giờ OT] ${payloadDescription}`;
    } else if (formType === 'RESOURCE') {
      payloadDescription = `[Hạng mục: ${formResourceCategory}] ${payloadDescription}`;
    }

    createMutation.mutate({
      title: formTitle.trim(),
      type: formType,
      description: payloadDescription,
      priority: formPriority,
      startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
      endDate: formEndDate ? new Date(formEndDate).toISOString() : null,
      taskId: formType === 'EXTEND_DEADLINE' ? formTaskId : null,
    });
  };

  // Helper Badge Colors
  const getTypeBadge = (type: ApprovalType) => {
    switch (type) {
      case 'LEAVE':
        return {
          label: 'Nghỉ phép',
          icon: '🏖️',
          className:
            'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
        };
      case 'OT':
        return {
          label: 'Làm thêm giờ OT',
          icon: '⏰',
          className:
            'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        };
      case 'EXTEND_DEADLINE':
        return {
          label: 'Gia hạn Deadline',
          icon: '⏳',
          className:
            'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        };
      case 'RESOURCE':
        return {
          label: 'Cấp tài nguyên',
          icon: '💻',
          className:
            'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        };
      default:
        return {
          label: type,
          icon: '📋',
          className: 'bg-slate-100 text-slate-700 border border-slate-200',
        };
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Chờ duyệt',
          icon: Clock3,
          className:
            'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 animate-pulse',
        };
      case 'APPROVED':
        return {
          label: 'Đã duyệt',
          icon: CheckCircle2,
          className:
            'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        };
      case 'REJECTED':
        return {
          label: 'Bị từ chối',
          icon: XCircle,
          className:
            'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy',
          icon: RotateCcw,
          className:
            'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
      default:
        return {
          label: status,
          icon: AlertCircle,
          className: 'bg-slate-100 text-slate-600 border border-slate-200',
        };
    }
  };

  const getPriorityBadge = (priority: ApprovalPriority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/80 dark:text-red-300 font-bold';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/80 dark:text-orange-300';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300';
      case 'LOW':
        return 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 max-w-7xl mx-auto pb-24">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Phê Duyệt & Đề Xuất
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {userRole === 'ADMIN'
                    ? 'Toàn doanh nghiệp'
                    : userRole === 'MANAGER'
                    ? 'Phòng ban & Dự án'
                    : 'Cá nhân'}
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Quản lý xét duyệt nghỉ phép, làm thêm giờ, xin gia hạn tiến độ và cấp tài nguyên
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchApprovals(true)}
            disabled={isRefetching}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-semibold shadow-md shadow-indigo-500/25 transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo Đề Xuất Mới</span>
          </button>
        </div>
      </div>

      {/* 2. TOP METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Chờ Phê Duyệt (Vàng) */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedStatus === 'PENDING'
              ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Chờ Phê Duyệt
            </span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
              <Clock3 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {stats.pending}
            </span>
            <span className="text-xs text-slate-500">yêu cầu</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Cần cấp trên xem xét</p>
        </div>

        {/* Đã Phê Duyệt (Xanh lục) */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedStatus === 'APPROVED'
              ? 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-400/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Đã Phê Duyệt
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.approved}
            </span>
            <span className="text-xs text-slate-500">hồ sơ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Đã được thông qua</p>
        </div>

        {/* Bị Từ Chối (Đỏ) */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'REJECTED' ? 'ALL' : 'REJECTED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedStatus === 'REJECTED'
              ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-400/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Bị Từ Chối
            </span>
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300">
              <XCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {stats.rejected}
            </span>
            <span className="text-xs text-slate-500">yêu cầu</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Có lý do phản hồi</p>
        </div>

        {/* Tổng Số Đề Xuất (Xanh dương) */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedStatus === 'ALL'
              ? 'border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-400/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Tổng Số Đề Xuất
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
              <FileCheck2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {stats.total}
            </span>
            <span className="text-xs text-slate-500">toàn bộ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {stats.cancelled > 0 ? `Bao gồm ${stats.cancelled} đơn đã hủy` : 'Quy mô theo phân quyền'}
          </p>
        </div>
      </div>

      {/* 3. TOOLBAR: SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, người gửi, lý do..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl text-xs md:text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Lọc theo loại đề xuất"
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">Tất cả phân loại</option>
            <option value="LEAVE">🏖️ Nghỉ phép / Remote</option>
            <option value="OT">⏰ Làm thêm giờ (OT)</option>
            <option value="EXTEND_DEADLINE">⏳ Gia hạn Deadline Task</option>
            <option value="RESOURCE">💻 Cấp tài nguyên</option>
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Lọc theo trạng thái"
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ phê duyệt</option>
            <option value="APPROVED">Đã phê duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          {/* Filter Priority */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            aria-label="Lọc theo mức độ ưu tiên"
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">Mức độ ưu tiên</option>
            <option value="URGENT">Khẩn cấp</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select>

          {(selectedStatus !== 'ALL' ||
            selectedType !== 'ALL' ||
            selectedPriority !== 'ALL' ||
            searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus('ALL');
                setSelectedType('ALL');
                setSelectedPriority('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition font-medium"
            >
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* 4. COMPACT ENTERPRISE TABLE (KHÔNG BỊ TRÀN NGANG) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="h-7 w-7 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Đang tải danh sách đề xuất quy trình...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <FileCheck2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Không tìm thấy đề xuất nào
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                Hiện tại không có đề xuất nào khớp với điều kiện lọc.
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo Đề Xuất Đầu Tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {/* Checkbox Header chọn tất cả */}
                  {isApprover && (
                    <th className="py-2.5 px-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={isAllPendingSelected}
                        onChange={handleToggleSelectAll}
                        disabled={pendingApprovalsOnScreen.length === 0}
                        title="Chọn tất cả đơn chờ duyệt"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                  )}
                  <th className="py-2.5 px-3 w-20">Mã Đơn</th>
                  <th className="py-2.5 px-3 w-40">Người Gửi</th>
                  <th className="py-2.5 px-3 w-32">Phân Loại</th>
                  <th className="py-2.5 px-3">Tiêu Đề & Chi Tiết</th>
                  <th className="py-2.5 px-3 w-28">Thời Gian</th>
                  <th className="py-2.5 px-3 w-28">Trạng Thái</th>
                  <th className="py-2.5 px-3 w-44 text-right whitespace-nowrap">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {approvals.map((req) => {
                  const typeBadge = getTypeBadge(req.type);
                  const statusBadge = getStatusBadge(req.status);
                  const StatusIcon = statusBadge.icon;
                  const isPending = req.status === 'PENDING';
                  const isCreator = req.requesterId === currentUser?.id;
                  const isSelected = selectedIds.includes(req.id);

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox từng dòng (chỉ cho phép chọn đơn PENDING) */}
                      {isApprover && (
                        <td className="py-2.5 px-3 text-center">
                          {isPending ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectItem(req.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 text-xs">-</span>
                          )}
                        </td>
                      )}

                      {/* Mã Đơn */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                          #{req.id.slice(0, 6)}
                        </span>
                      </td>

                      {/* Người Gửi */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {req.requester?.avatar ? (
                            <img
                              src={req.requester.avatar}
                              alt={req.requester.name}
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">
                              {req.requester?.name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[110px] text-xs">
                              {req.requester?.name || 'Vô danh'}
                            </p>
                            <span className="text-[10px] text-slate-400 capitalize truncate block">
                              {req.requester?.role === 'ADMIN'
                                ? 'Quản trị'
                                : req.requester?.role === 'MANAGER'
                                ? 'Quản lý'
                                : 'Nhân viên'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phân Loại */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${typeBadge.className}`}
                          >
                            <span>{typeBadge.icon}</span>
                            <span className="truncate max-w-[90px]">{typeBadge.label}</span>
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold tracking-tight ${getPriorityBadge(
                              req.priority
                            )}`}
                          >
                            {req.priority}
                          </span>
                        </div>
                      </td>

                      {/* Tiêu Đề & Chi Tiết (Thu gọn không làm tràn bảng) */}
                      <td className="py-2.5 px-3 max-w-xs md:max-w-sm">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">
                          {req.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {req.description}
                        </p>

                        {/* Đính kèm Task nếu gia hạn deadline */}
                        {req.type === 'EXTEND_DEADLINE' && req.task && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Calendar className="h-2.5 w-2.5" />
                            <span className="font-medium truncate max-w-[150px]">
                              {req.task.title}
                            </span>
                            {req.endDate && (
                              <span className="font-bold">
                                ➔ {formatDate(req.endDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Thời Gian & Reviewer */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-500">
                        <div>{formatDate(req.createdAt)}</div>
                        {req.reviewer && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 truncate max-w-[110px]">
                            <UserCheck className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{req.reviewer.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Trạng Thái Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusBadge.label}</span>
                        </span>
                      </td>

                      {/* THAO TÁC CỰC KỲ GỌN GÀNG (COMPACT ACTION BAR) */}
                      <td className="py-2.5 px-3 w-44 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* ĐƠN PENDING */}
                          {isPending ? (
                            <>
                              {/* Role ADMIN / MANAGER: Nút Icon nhỏ gọn có Tooltip */}
                              {isApprover && (
                                <>
                                  {/* 1. Nút Duyệt: Icon Check xanh */}
                                  <button
                                    onClick={() => handleQuickApprove(req)}
                                    disabled={reviewMutation.isPending}
                                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95"
                                    title="Phê duyệt nhanh"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>

                                  {/* 2. Nút Từ chối: Icon X đỏ */}
                                  <button
                                    onClick={() => handleOpenRejectModal(req)}
                                    disabled={reviewMutation.isPending}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs transition active:scale-95"
                                    title="Từ chối đề xuất"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>

                                  {/* 3. Nút AI: Icon Sparkles tím */}
                                  <button
                                    onClick={() => handleAnalyzeAI(req)}
                                    className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-xs transition active:scale-95"
                                    title="✨ AI Thẩm định tác động"
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}

                              {/* Role EMPLOYEE: Nút Hủy đơn */}
                              {isCreator && !isApprover && (
                                <button
                                  onClick={() => handleOpenCancelModal(req)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title="Hủy đề xuất này"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Nút Chi tiết */}
                              <button
                                onClick={() => handleOpenDetail(req)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Xem chi tiết đề xuất"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            /* ĐƠN ĐÃ DUYỆT (APPROVED), TỪ CHỐI (REJECTED) HOẶC HỦY (CANCELLED):
                               Admin/Manager có quyền ĐỔI QUYẾT ĐỊNH (Re-evaluate) + Xem chi tiết */
                            <>
                              {isApprover && (
                                <button
                                  onClick={() => handleOpenReevaluate(req)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold transition active:scale-95"
                                  title="Đổi quyết định xét duyệt / Thẩm định lại"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Đổi duyệt</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenDetail(req)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Xem chi tiết đề xuất"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. FLOATING ACTION BAR THAO TÁC HÀNG LOẠT (Khi chọn từ 2 đơn trở lên) */}
      {selectedIds.length >= 2 && isApprover && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold whitespace-nowrap">
              Đã chọn {selectedIds.length} đơn
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchApprove}
              disabled={batchReviewMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition active:scale-95"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Duyệt tất cả đã chọn</span>
            </button>

            <button
              onClick={() => {
                setBatchRejectReason('');
                setIsBatchRejectModalOpen(true);
              }}
              disabled={batchReviewMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition active:scale-95"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>Từ chối tất cả đã chọn</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white transition"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* 6. MODAL: "ĐỔI QUYẾT ĐỊNH XÉT DUYỆT" (RE-EVALUATE MODAL) */}
      {isReevaluateModalOpen && activeApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-indigo-200 dark:border-indigo-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <button
              onClick={() => setIsReevaluateModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Đổi Quyết Định Xét Duyệt
                </h3>
                <p className="text-xs text-slate-500">
                  Điều chỉnh hoặc khôi phục trạng thái cho đề xuất đã qua xử lý
                </p>
              </div>
            </div>

            {/* Thông tin vắn tắt đơn & Trạng thái hiện tại */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Trạng thái hiện tại:</span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    getStatusBadge(activeApproval.status).className
                  }`}
                >
                  {getStatusBadge(activeApproval.status).label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Người gửi:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeApproval.requester?.name} ({activeApproval.requester?.role})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tiêu đề:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[260px]">
                  {activeApproval.title}
                </span>
              </div>
              {activeApproval.responseNote && (
                <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700">
                  Ghi chú trước đó: <em>"{activeApproval.responseNote}"</em>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmReevaluate} className="space-y-4">
              {/* Chọn quyết định mới */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Lựa chọn trạng thái điều chỉnh mới:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Option 1: Nếu đang APPROVED -> Chuyển thành REJECT; Nếu REJECTED -> Chuyển thành APPROVE */}
                  {activeApproval.status === 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => setReevaluateAction('REJECT')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
                        reevaluateAction === 'REJECT'
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold ring-1 ring-rose-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <XCircle className="h-5 w-5 text-rose-600" />
                      <div>
                        <div className="text-xs font-bold">Chuyển sang Từ Chối</div>
                        <div className="text-[10px] text-slate-400 font-normal">Hủy quyền đã duyệt</div>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReevaluateAction('APPROVE')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
                        reevaluateAction === 'APPROVE'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold">Chuyển sang Phê Duyệt</div>
                        <div className="text-[10px] text-slate-400 font-normal">Thông qua đề xuất</div>
                      </div>
                    </button>
                  )}

                  {/* Option 2: Khôi phục về Chờ duyệt (PENDING) */}
                  <button
                    type="button"
                    onClick={() => setReevaluateAction('RESET_PENDING')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
                      reevaluateAction === 'RESET_PENDING'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Clock3 className="h-5 w-5 text-amber-600" />
                    <div>
                      <div className="text-xs font-bold">Về Chờ Phê Duyệt</div>
                      <div className="text-[10px] text-slate-400 font-normal">Thẩm định lại từ đầu</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Ô nhập lý do nếu chọn REJECT hoặc ghi chú nếu chọn APPROVE */}
              {reevaluateAction === 'REJECT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lý do từ chối mới <span className="text-rose-500">* (Bắt buộc, tối thiểu 5 ký tự)</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reevaluateNote}
                    onChange={(e) => setReevaluateNote(e.target.value)}
                    placeholder="Nêu rõ lý do điều chỉnh sang từ chối..."
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                  />
                  {/* Gợi ý chọn nhanh */}
                  <div className="flex flex-col gap-1 mt-1.5">
                    {QUICK_REJECT_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReevaluateNote(preset)}
                        className="text-left text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50/50 text-slate-600 dark:text-slate-300"
                      >
                        • {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {reevaluateAction === 'APPROVE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú phê duyệt bổ sung (Tùy chọn)
                  </label>
                  <textarea
                    rows={2}
                    value={reevaluateNote}
                    onChange={(e) => setReevaluateNote(e.target.value)}
                    placeholder="Nhập dặn dò nhân viên nếu có..."
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}

              {reevaluateAction === 'RESET_PENDING' && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Đơn sẽ được hoàn tác về danh sách <strong>Chờ phê duyệt</strong>, thông báo cho người gửi và người quản lý có thể thẩm định lại bất cứ lúc nào.
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReevaluateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition"
                >
                  {reviewMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Xác Nhận Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: "TỪ CHỐI ĐỀ XUẤT" ĐƠN LẺ */}
      {isRejectModalOpen && activeApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <Ban className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Từ Chối Đề Xuất
                </h3>
                <p className="text-xs text-slate-500">
                  Vui lòng cung cấp lý do từ chối để nhân viên nắm rõ và điều chỉnh
                </p>
              </div>
            </div>

            {/* Thông tin vắn tắt */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-4 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Người gửi:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeApproval.requester?.name} ({activeApproval.requester?.role})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tiêu đề:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[260px]">
                  {activeApproval.title}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lý do từ chối <span className="text-rose-500">* (Bắt buộc, tối thiểu 5 ký tự)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do hoặc chọn nhanh từ gợi ý bên dưới..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs md:text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Các gợi ý chọn nhanh 1 chạm */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  💡 Gợi ý lý do nhanh (bấm để chọn):
                </span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_REJECT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 bg-slate-50/60 dark:bg-slate-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-300 transition"
                    >
                      • {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 transition"
                >
                  {reviewMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Xác Nhận Từ Chối Đơn</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: TỪ CHỐI HÀNG LOẠT (BATCH REJECT MODAL) */}
      {isBatchRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsBatchRejectModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <Ban className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Từ Chối {selectedIds.length} Đề Xuất Đã Chọn
                </h3>
                <p className="text-xs text-slate-500">
                  Gửi lý do phản hồi chung tới tất cả những người gửi các đơn này
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmBatchReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lý do từ chối chung <span className="text-rose-500">* (Bắt buộc, tối thiểu 5 ký tự)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={batchRejectReason}
                  onChange={(e) => setBatchRejectReason(e.target.value)}
                  placeholder="Nhập lý do từ chối đồng loạt..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs md:text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Các gợi ý chọn nhanh 1 chạm */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  💡 Gợi ý nhanh:
                </span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_REJECT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBatchRejectReason(preset)}
                      className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 bg-slate-50/60 dark:bg-slate-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-300 transition"
                    >
                      • {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBatchRejectModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={batchReviewMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 transition"
                >
                  {batchReviewMutation.isPending && (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Xác Nhận Từ Chối Tất Cả</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: HỦY ĐƠN DÀNH CHO EMPLOYEE */}
      {isCancelModalOpen && approvalToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsCancelModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Xác Nhận Hủy Đề Xuất
                </h3>
                <p className="text-xs text-slate-500">
                  Đơn sẽ được chuyển sang trạng thái "Đã hủy" (CANCELLED)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Bạn có chắc chắn muốn hủy đề xuất{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                "{approvalToCancel.title}"
              </strong>
              ? Cấp trên sẽ không nhận được yêu cầu này nữa.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs"
              >
                {cancelMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Xác Nhận Hủy Đơn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL: "✨ THẨM ĐỊNH TÁC ĐỘNG BẰNG AI" (AI IMPACT & RISK ANALYZER) */}
      {isAiModalOpen && activeApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header Modal AI */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Thẩm Định Đề Xuất Bằng AI
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    Copilot Advisor
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Phân tích tự động rủi ro tiến độ, xung đột nhân sự và nguồn lực
                </p>
              </div>
            </div>

            {/* Đang phân tích */}
            {aiLoading ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="h-7 w-7 text-purple-600 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  AI đang thẩm định dữ liệu lịch trình & tiến độ...
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Kiểm tra xung đột mốc hoàn thành các công việc liên quan và đánh giá tính hợp lý tài nguyên.
                </p>
              </div>
            ) : aiAnalysisData ? (
              <div className="space-y-4">
                {/* Thẻ Mức độ rủi ro (Risk Level Badge) */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    aiAnalysisData.riskLevel === 'HIGH'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                      : aiAnalysisData.riskLevel === 'MEDIUM'
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {aiAnalysisData.riskLevel === 'HIGH' ? (
                      <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0" />
                    ) : aiAnalysisData.riskLevel === 'MEDIUM' ? (
                      <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
                    ) : (
                      <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Đánh giá mức độ rủi ro
                      </span>
                      <h4
                        className={`text-sm md:text-base font-extrabold ${
                          aiAnalysisData.riskLevel === 'HIGH'
                            ? 'text-rose-700 dark:text-rose-400'
                            : aiAnalysisData.riskLevel === 'MEDIUM'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {aiAnalysisData.riskLevel === 'HIGH'
                          ? 'RỦI RO CAO - CÓ NGUY CƠ CHẬM TIẾN ĐỘ'
                          : aiAnalysisData.riskLevel === 'MEDIUM'
                          ? 'RỦI RO VỪA PHẢI - CẦN LƯU Ý KHI DUYỆT'
                          : 'RỦI RO THẤP - AN TOÀN CHO DỰ ÁN'}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Tóm tắt đánh giá (Summary) */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="h-3 w-3 text-indigo-500" />
                    Tóm tắt phân tích tác động
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {aiAnalysisData.summary}
                  </p>
                </div>

                {/* Khuyến nghị của AI (Recommendation) */}
                <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-purple-600" />
                    Khuyến nghị dành cho Quản lý
                  </span>
                  <p className="text-xs text-purple-950 dark:text-purple-200 leading-relaxed">
                    {aiAnalysisData.recommendation}
                  </p>
                </div>

                {/* Quick Actions ngay trong Modal AI */}
                {isApprover && activeApproval.status === 'PENDING' && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(activeApproval)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition"
                    >
                      Từ chối đề xuất
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAiModalOpen(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Đóng
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickApprove(activeApproval)}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Phê duyệt ngay</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Không thể tải kết quả thẩm định. Vui lòng thử lại sau.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 11. MODAL: XEM CHI TIẾT ĐỀ XUẤT */}
      {isDetailModalOpen && activeApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="text-2xl">{getTypeBadge(activeApproval.type).icon}</span>
              <div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Mã: #{activeApproval.id.slice(0, 10)}
                </span>
                <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                  {activeApproval.title}
                </h3>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  getStatusBadge(activeApproval.status).className
                }`}
              >
                {getStatusBadge(activeApproval.status).label}
              </span>

              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  getTypeBadge(activeApproval.type).className
                }`}
              >
                {getTypeBadge(activeApproval.type).label}
              </span>

              <span
                className={`text-[10px] px-2 py-0.5 rounded-sm uppercase font-bold ${getPriorityBadge(
                  activeApproval.priority
                )}`}
              >
                Ưu tiên {activeApproval.priority}
              </span>
            </div>

            {/* Khối Ghi Chú Phản Hồi Nổi Bật */}
            {activeApproval.status === 'REJECTED' && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span>Lý do từ chối của cấp trên:</span>
                </div>
                <p className="text-rose-900 dark:text-rose-200 pl-5 italic font-medium leading-relaxed">
                  "{activeApproval.responseNote || 'Không có lý do chi tiết.'}"
                </p>
                {activeApproval.reviewer && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 pl-5 pt-0.5">
                    Xử lý bởi: <strong>{activeApproval.reviewer.name}</strong>
                  </p>
                )}
              </div>
            )}

            {activeApproval.status === 'APPROVED' && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Phản hồi phê duyệt từ cấp trên:</span>
                </div>
                <p className="text-emerald-900 dark:text-emerald-200 pl-5 italic font-medium leading-relaxed">
                  "{activeApproval.responseNote || 'Đã phê duyệt đề xuất.'}"
                </p>
                {activeApproval.reviewer && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-5 pt-0.5">
                    Phê duyệt bởi: <strong>{activeApproval.reviewer.name}</strong>
                  </p>
                )}
              </div>
            )}

            {activeApproval.status === 'CANCELLED' && (
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                  <RotateCcw className="h-4 w-4 text-slate-500" />
                  <span>Trạng thái: Đơn đã được người tạo chủ động hủy</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 pl-5 italic text-[11px]">
                  Đơn này không còn nằm trong danh sách cần cấp trên xem xét.
                </p>
              </div>
            )}

            {/* Nội dung chi tiết */}
            <div className="space-y-2.5 py-2 border-y border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Mô tả đề xuất:
                </span>
                <p className="mt-1 text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed text-xs">
                  {activeApproval.description}
                </p>
              </div>

              {activeApproval.task && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                  <span className="font-bold">Công việc liên quan:</span> {activeApproval.task.title}
                  {activeApproval.endDate && (
                    <div className="mt-0.5 font-bold">
                      Hạn chót mới đề xuất: <strong>{formatDate(activeApproval.endDate)}</strong>
                    </div>
                  )}
                </div>
              )}

              {activeApproval.startDate && activeApproval.endDate && (
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Khoảng thời gian:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(activeApproval.startDate)} ➔ {formatDate(activeApproval.endDate)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Người tạo:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeApproval.requester?.name} ({activeApproval.requester?.role})
                </span>
              </div>
            </div>

            {/* Actions in Detail Modal */}
            <div className="flex items-center justify-between pt-1">
              {isApprover && activeApproval.status !== 'PENDING' ? (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenReevaluate(activeApproval);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Đổi quyết định xét duyệt</span>
                </button>
              ) : activeApproval.status === 'PENDING' &&
                activeApproval.requesterId === currentUser?.id &&
                !isApprover ? (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenCancelModal(activeApproval);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Hủy yêu cầu này</span>
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. MODAL: TẠO ĐỀ XUẤT MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 my-8">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Khởi Tạo Đề Xuất Mới
                </h2>
                <p className="text-xs text-slate-500">
                  Gửi yêu cầu tới cấp trên để được phê duyệt theo quy trình chuẩn
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              {/* Chọn Loại Đề Xuất (Tabs) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Phân loại đề xuất
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'LEAVE', icon: '🏖️', title: 'Nghỉ phép / Remote' },
                    { type: 'OT', icon: '⏰', title: 'Làm thêm giờ (OT)' },
                    { type: 'EXTEND_DEADLINE', icon: '⏳', title: 'Gia hạn Deadline' },
                    { type: 'RESOURCE', icon: '💻', title: 'Cấp tài nguyên' },
                  ].map((tab) => (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => {
                        setFormType(tab.type as ApprovalType);
                        if (!formTitle) {
                          if (tab.type === 'LEAVE') setFormTitle('Đơn xin nghỉ phép cá nhân');
                          if (tab.type === 'OT') setFormTitle('Đăng ký làm thêm ngoài giờ (OT)');
                          if (tab.type === 'EXTEND_DEADLINE')
                            setFormTitle('Yêu cầu gia hạn Deadline công việc');
                          if (tab.type === 'RESOURCE')
                            setFormTitle('Đề xuất cấp thiết bị làm việc');
                        }
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
                        formType === tab.type
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-xl">{tab.icon}</span>
                      <span className="text-xs">{tab.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tiêu đề & Mức độ ưu tiên */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu đề đề xuất <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="VD: Xin nghỉ phép 2 ngày việc gia đình..."
                    className="w-full px-3 py-2 rounded-xl text-xs md:text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as ApprovalPriority)}
                    className="w-full px-3 py-2 rounded-xl text-xs md:text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="LOW">Thấp (Low)</option>
                    <option value="MEDIUM">Trung bình (Medium)</option>
                    <option value="HIGH">Cao (High)</option>
                    <option value="URGENT">Khẩn cấp (Urgent)</option>
                  </select>
                </div>
              </div>

              {/* 1. NGHỈ PHÉP */}
              {formType === 'LEAVE' && (
                <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-3">
                  <h4 className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <span>🏖️</span> Thời gian nghỉ phép dự kiến
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Đến hết ngày
                      </label>
                      <input
                        type="date"
                        required
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. LÀM THÊM GIỜ (OT) */}
              {formType === 'OT' && (
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
                  <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <span>⏰</span> Đăng ký làm thêm ngoài giờ
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Ngày làm thêm
                      </label>
                      <input
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => {
                          setFormStartDate(e.target.value);
                          setFormEndDate(e.target.value);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Số giờ dự kiến
                      </label>
                      <select
                        value={formOtHours}
                        onChange={(e) => setFormOtHours(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                      >
                        <option value="1">1 Giờ</option>
                        <option value="2">2 Giờ</option>
                        <option value="3">3 Giờ (Tiêu chuẩn OT tối đa)</option>
                        <option value="4">4 Giờ (Đặc biệt thứ 7/CN)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. GIA HẠN DEADLINE TASK */}
              {formType === 'EXTEND_DEADLINE' && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <span>⏳</span> Chọn Task & Hạn Chót Mới Mong Muốn
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Chọn công việc đang phụ trách <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formTaskId}
                        onChange={(e) => {
                          const chosenId = e.target.value;
                          setFormTaskId(chosenId);
                          const t = myTasks.find((task) => task.id === chosenId);
                          if (t) {
                            setFormTitle(`Xin gia hạn deadline task: ${t.title}`);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      >
                        <option value="">-- Chọn công việc trong danh sách --</option>
                        {myTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} (Hạn cũ: {formatDate(t.dueDate) || 'Chưa set'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Hạn chót mới mong muốn <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. CẤP THIẾT BỊ / TÀI NGUYÊN */}
              {formType === 'RESOURCE' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <span>💻</span> Danh mục tài nguyên cần cấp
                  </h4>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Loại thiết bị / Tài nguyên
                    </label>
                    <select
                      value={formResourceCategory}
                      onChange={(e) => {
                        setFormResourceCategory(e.target.value);
                        setFormTitle(`Đề xuất cấp ${e.target.value}`);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg text-xs border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900"
                    >
                      <option value="Màn hình phụ (24/27 inch 4K)">
                        Màn hình phụ (24/27 inch 4K)
                      </option>
                      <option value="Laptop / Máy tính cấu hình cao">
                        Laptop / Máy tính cấu hình cao
                      </option>
                      <option value="Tài khoản Cloud AWS / GCP / Azure GPU">
                        Tài khoản Cloud AWS / GCP / Azure GPU
                      </option>
                      <option value="Bản quyền phần mềm / IDE / Tool bản quyền">
                        Bản quyền phần mềm / IDE / Tool bản quyền
                      </option>
                      <option value="Thiết bị kiểm thử Mobile / IoT">
                        Thiết bị kiểm thử Mobile / IoT
                      </option>
                    </select>
                  </div>
                </div>
              )}

              {/* Mô tả chi tiết & lý do */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả chi tiết & Lý do đề xuất <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ghi rõ lý do, kế hoạch bàn giao công việc hoặc mục đích sử dụng..."
                  className="w-full px-3 py-2 rounded-xl text-xs md:text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition"
                >
                  {createMutation.isPending ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Gửi Đề Xuất</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
