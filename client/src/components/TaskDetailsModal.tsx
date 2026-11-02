import React, { FormEvent, useEffect, useState, useRef } from 'react';
import {
  Check,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  UploadCloud,
  UserRound,
  X,
  Clock,
  Briefcase,
  AlertCircle,
  History,
  Calendar,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Sparkles,
  FolderTree,
  ListChecks,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertTriangle,
  Flag,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import taskService, {
  type Task,
  type TaskStatus,
  type UserSummary,
  type TaskCategory,
  type TaskPriority,
  type WorkLog,
  type TaskActivityItem,
  type Milestone,
  type TaskChecklist,
  type TaskDependency,
  type DependencyType,
} from '../services/taskService';
import { useAuth } from '../hooks/useAuth';
import CountdownBadge from './ui/CountdownBadge';

interface TaskDetailsModalProps {
  taskId: string;
  canEditSubtasks: boolean;
  canAssignTask: boolean;
  usersList: UserSummary[];
  onTaskUpdated: (task: Task) => void;
  onClose: () => void;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  taskId,
  canEditSubtasks,
  canAssignTask,
  usersList,
  onTaskUpdated,
  onClose,
}) => {
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [category, setCategory] = useState<TaskCategory>('CORE_PROJECT');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [kpiBonusScore, setKpiBonusScore] = useState<number>(0);
  const [kpiPenaltyScore, setKpiPenaltyScore] = useState<number>(0);
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Tab switch: 'comments' | 'audit' | 'worklogs'
  const [activeRightTab, setActiveRightTab] = useState<'comments' | 'audit' | 'worklogs'>('comments');

  // Comment state
  const [commentText, setCommentText] = useState('');

  // Loading & Action states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(taskId);

  // Project data for relations
  const [projectMilestones, setProjectMilestones] = useState<Milestone[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);

  // DoD Checklists
  const [checklists, setChecklists] = useState<TaskChecklist[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);

  // Dependencies
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [dependedBy, setDependedBy] = useState<TaskDependency[]>([]);
  const [selectedDepTaskId, setSelectedDepTaskId] = useState('');
  const [selectedDepType, setSelectedDepType] = useState<DependencyType>('BLOCKED_BY');
  const [isAddingDep, setIsAddingDep] = useState(false);

  // Review / QA Action
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isReviewActionLoading, setIsReviewActionLoading] = useState(false);

  // Gemini AI Copilot
  const [isAiBreakingDown, setIsAiBreakingDown] = useState(false);

  // WBS Hierarchical Sub-tasks State
  const [wbsTitle, setWbsTitle] = useState('');
  const [wbsAssigneeId, setWbsAssigneeId] = useState('');
  const [wbsDueDate, setWbsDueDate] = useState('');
  const [wbsEstimatedHours, setWbsEstimatedHours] = useState<number | ''>('');
  const [isCreatingWbs, setIsCreatingWbs] = useState(false);
  const [showWbsForm, setShowWbsForm] = useState(false);

  useEffect(() => {
    setCurrentTaskId(taskId);
  }, [taskId]);

  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Log Work Modal state
  const [isLogWorkOpen, setIsLogWorkOpen] = useState(false);
  const [logHours, setLogHours] = useState<number | ''>(2);
  const [logNote, setLogNote] = useState('');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  // Audit Trail & Worklogs data
  const [activities, setActivities] = useState<TaskActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [workLogsList, setWorkLogsList] = useState<WorkLog[]>([]);

  // Tải chi tiết công việc và dữ liệu bổ trợ
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    taskService
      .getTaskById(currentTaskId)
      .then((result) => {
        if (!active) return;
        setTask(result);
        setAssigneeId(result.assigneeId || '');
        setReviewerId(result.reviewerId || '');
        setMilestoneId(result.milestoneId || '');
        setCategory(result.category || 'CORE_PROJECT');
        setPriority(result.priority || 'MEDIUM');
        setEstimatedHours(result.estimatedHours ?? '');
        setKpiBonusScore(result.kpiBonusScore ?? 0);
        setKpiPenaltyScore(result.kpiPenaltyScore ?? 0);
        setWorkLogsList(result.workLogs || []);
        setChecklists(result.checklists || []);
        setDependencies(result.dependencies || []);
        setDependedBy(result.dependedBy || []);

        // Load project milestones & other tasks
        if (result.projectId) {
          taskService
            .getProjectMilestones(result.projectId)
            .then((mList) => active && setProjectMilestones(mList))
            .catch(() => {});

          taskService
            .getTasksByProject(result.projectId)
            .then((tList) => active && setProjectTasks(tList.filter((t) => t.id !== result.id)))
            .catch(() => {});
        }
      })
      .catch((error: unknown) => {
        console.error('Không thể tải chi tiết công việc:', error);
        if (active) toast.error('Không thể tải chi tiết công việc.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentTaskId]);

  // Load audit activities khi mở tab audit
  useEffect(() => {
    if (activeRightTab === 'audit' && task?.id) {
      setIsLoadingActivities(true);
      taskService
        .getTaskActivities(task.id)
        .then((items) => setActivities(items))
        .catch((err) => console.error('Lỗi tải audit log:', err))
        .finally(() => setIsLoadingActivities(false));
    }
  }, [activeRightTab, task?.id]);

  // Tải ảnh xem trước cho tệp đính kèm
  useEffect(() => {
    if (!task?.attachments) return;
    const currentUrls = attachmentPreviewUrls;
    let active = true;

    task.attachments.forEach((attachment) => {
      if (attachment.fileType.startsWith('image/') && !currentUrls[attachment.id]) {
        taskService
          .getTaskAttachmentContent(task.id, attachment.id)
          .then((blob) => {
            if (active) {
              const url = URL.createObjectURL(blob);
              setAttachmentPreviewUrls((prev) => ({ ...prev, [attachment.id]: url }));
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      active = false;
    };
  }, [task?.attachments]);

  // Dọn dẹp URL Blob preview
  useEffect(() => {
    return () => {
      Object.values(attachmentPreviewUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  // Xử lý tải lên file đính kèm
  const handleAttachmentInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !event.target.files?.length) return;
    const files = Array.from(event.target.files);
    setIsUploadingAttachment(true);

    try {
      const newAttachments = await taskService.uploadTaskAttachments(task.id, files);
      setTask({
        ...task,
        attachments: [...(task.attachments || []), ...newAttachments],
      });
      toast.success(`Đã tải lên ${files.length} tệp đính kèm.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải lên tệp đính kèm.');
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!task) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await taskService.deleteTaskAttachment(task.id, attachmentId);
      setTask({
        ...task,
        attachments: (task.attachments || []).filter((item) => item.id !== attachmentId),
      });
      if (attachmentPreviewUrls[attachmentId]) {
        URL.revokeObjectURL(attachmentPreviewUrls[attachmentId]);
        setAttachmentPreviewUrls((prev) => {
          const updated = { ...prev };
          delete updated[attachmentId];
          return updated;
        });
      }
      toast.success('Đã xóa tệp đính kèm.');
    } catch {
      toast.error('Không thể xóa tệp đính kèm.');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const downloadAttachment = async (attachment: { id: string; fileName: string }) => {
    if (!task) return;
    try {
      const blob = await taskService.getTaskAttachmentContent(task.id, attachment.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      toast.error('Không thể tải file đính kèm.');
    }
  };

  // Cập nhật người thực hiện & thông tin hạch toán nghiệp vụ
  const handleSaveMetadata = async () => {
    if (!task) return;
    setIsSavingMeta(true);
    try {
      const updatedTask = await taskService.updateTask(task.id, {
        assigneeId: assigneeId || null,
        reviewerId: reviewerId || null,
        milestoneId: milestoneId || null,
        category,
        priority,
        estimatedHours: estimatedHours !== '' ? Number(estimatedHours) : undefined,
        kpiBonusScore: Number(kpiBonusScore) || 0,
        kpiPenaltyScore: Number(kpiPenaltyScore) || 0,
      });
      setTask(updatedTask);
      onTaskUpdated(updatedTask);
      toast.success('Đã lưu cập nhật thông tin định mức & quản trị thành công!');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể lưu thông tin công việc.');
    } finally {
      setIsSavingMeta(false);
    }
  };

  // Ghi nhận giờ làm (Log Work)
  const handleLogWorkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!task) return;
    const hours = Number(logHours);
    if (!hours || hours <= 0) {
      toast.error('Vui lòng nhập số giờ làm việc hợp lệ lớn hơn 0.');
      return;
    }

    setIsLoggingWork(true);
    try {
      const res = await taskService.logWork(task.id, {
        hours,
        description: logNote,
        loggedDate: logDate,
      });

      const updated = res.data.task;
      setTask({
        ...task,
        actualHours: res.data.actualHours,
        workLogs: updated.workLogs || [res.data.workLog, ...workLogsList],
      });
      setWorkLogsList(updated.workLogs || [res.data.workLog, ...workLogsList]);
      onTaskUpdated(updated);

      toast.success(`🎉 ${res.message}`);
      setIsLogWorkOpen(false);
      setLogNote('');
      setLogHours(2);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể ghi nhận giờ làm.');
    } finally {
      setIsLoggingWork(false);
    }
  };

  // Thêm bình luận
  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentText.trim();
    if (!content || !task) return;

    setIsSubmitting(true);
    try {
      const comment = await taskService.addComment(task.id, content);
      setTask({ ...task, comments: [...(task.comments || []), comment] });
      setCommentText('');
      toast.success('Đã thêm bình luận.');
    } catch {
      toast.error('Không thể thêm bình luận.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WBS Thêm Công việc con
  const handleCreateWbsSubtask = async (e: FormEvent) => {
    e.preventDefault();
    if (!task || !wbsTitle.trim()) return;

    setIsCreatingWbs(true);
    try {
      const newSubtask = await taskService.createWbsSubtask({
        parentId: task.id,
        projectId: task.projectId,
        title: wbsTitle.trim(),
        assigneeId: wbsAssigneeId || undefined,
        dueDate: wbsDueDate || undefined,
        estimatedHours: wbsEstimatedHours !== '' ? Number(wbsEstimatedHours) : undefined,
      });

      const updatedSubtasks = [...(task.subtasks || []), newSubtask];
      const updatedTask = {
        ...task,
        isParent: true,
        subtasks: updatedSubtasks,
      };
      setTask(updatedTask);
      onTaskUpdated(updatedTask);

      setWbsTitle('');
      setWbsAssigneeId('');
      setWbsDueDate('');
      setWbsEstimatedHours('');
      setShowWbsForm(false);
      toast.success('Đã thêm công việc con WBS thành công!');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tạo công việc con.');
    } finally {
      setIsCreatingWbs(false);
    }
  };

  const handleDeleteWbsSubtask = async (subtaskId: string) => {
    if (!task) return;
    try {
      await taskService.deleteTask(subtaskId);
      const updatedSubtasks = (task.subtasks || []).filter((s) => s.id !== subtaskId);
      const updatedTask = {
        ...task,
        subtasks: updatedSubtasks,
        isParent: updatedSubtasks.length > 0,
      };
      setTask(updatedTask);
      onTaskUpdated(updatedTask);
      toast.success('Đã xóa công việc con WBS.');
    } catch {
      toast.error('Không thể xóa công việc con.');
    }
  };

  // --- GEMINI AI TASK COPILOT ACTION ---
  const handleAiBreakdown = async () => {
    if (!task) return;
    setIsAiBreakingDown(true);
    try {
      await taskService.aiTaskBreakdown(task.id, task.project?.name);
      toast.success('🤖 Gemini AI Copilot đã phân rã công việc WBS & thiết lập tiêu chí DoD thành công!');
      // Tải lại dữ liệu task
      const refreshed = await taskService.getTaskById(task.id);
      setTask(refreshed);
      setChecklists(refreshed.checklists || []);
      onTaskUpdated(refreshed);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể phân rã công việc bằng AI lúc này.');
    } finally {
      setIsAiBreakingDown(false);
    }
  };

  // --- REVIEW / QA ACTIONS ---
  const handleApproveReview = async () => {
    if (!task) return;
    setIsReviewActionLoading(true);
    try {
      const updated = await taskService.approveTaskReview(task.id);
      setTask(updated);
      onTaskUpdated(updated);
      toast.success('🎉 Đã phê duyệt nghiệm thu công việc thành công sang DONE!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể phê duyệt công việc.');
    } finally {
      setIsReviewActionLoading(false);
    }
  };

  const handleRejectReview = async () => {
    if (!task) return;
    if (!rejectReasonText.trim()) {
      toast.error('Vui lòng nhập lý do từ chối để nhân sự chỉnh sửa.');
      return;
    }
    setIsReviewActionLoading(true);
    try {
      const updated = await taskService.rejectTaskReview(task.id, rejectReasonText.trim());
      setTask(updated);
      setShowRejectForm(false);
      setRejectReasonText('');
      onTaskUpdated(updated);
      toast.success('Đã từ chối nghiệm thu và trả công việc về In Progress.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể từ chối công việc.');
    } finally {
      setIsReviewActionLoading(false);
    }
  };

  // --- DOD CHECKLIST ACTIONS ---
  const handleToggleChecklist = async (checklistId: string) => {
    try {
      const updatedItem = await taskService.toggleTaskChecklist(checklistId);
      setChecklists((prev) => prev.map((c) => (c.id === checklistId ? updatedItem : c)));
      if (updatedItem.isCompleted) {
        toast.success(`✓ Đã xác nhận tiêu chí: ${updatedItem.content}`);
      }
    } catch (err: any) {
      toast.error('Lỗi cập nhật tiêu chí nghiệm thu.');
    }
  };

  const handleAddChecklist = async (e: FormEvent) => {
    e.preventDefault();
    if (!task || !newChecklistText.trim()) return;
    setIsAddingChecklist(true);
    try {
      const created = await taskService.createTaskChecklist(task.id, newChecklistText.trim(), newChecklistRequired);
      setChecklists((prev) => [...prev, created]);
      setNewChecklistText('');
      toast.success('Đã thêm tiêu chí nghiệm thu DoD.');
    } catch {
      toast.error('Không thể thêm tiêu chí.');
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    try {
      await taskService.deleteTaskChecklist(checklistId);
      setChecklists((prev) => prev.filter((c) => c.id !== checklistId));
      toast.success('Đã xóa tiêu chí nghiệm thu.');
    } catch {
      toast.error('Không thể xóa tiêu chí.');
    }
  };

  // --- DEPENDENCY ACTIONS ---
  const handleAddDependency = async () => {
    if (!task || !selectedDepTaskId) {
      toast.error('Vui lòng chọn công việc để tạo liên kết.');
      return;
    }
    setIsAddingDep(true);
    try {
      await taskService.createTaskDependency(task.id, selectedDepTaskId, selectedDepType);
      const res = await taskService.getTaskDependencies(task.id);
      setDependencies(res.dependencies || []);
      setDependedBy(res.dependedBy || []);
      setSelectedDepTaskId('');
      toast.success('Đã thêm liên kết phụ thuộc thành công.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể thêm liên kết phụ thuộc.');
    } finally {
      setIsAddingDep(false);
    }
  };

  const handleDeleteDependency = async (dependencyId: string) => {
    try {
      await taskService.deleteTaskDependency(dependencyId);
      setDependencies((prev) => prev.filter((d) => d.id !== dependencyId));
      setDependedBy((prev) => prev.filter((d) => d.id !== dependencyId));
      toast.success('Đã gỡ liên kết phụ thuộc.');
    } catch {
      toast.error('Không thể gỡ liên kết.');
    }
  };

  // Tính toán tiến độ WBS Subtasks
  const wbsSubtasks = task?.subtasks || [];
  const doneWbsCount = wbsSubtasks.filter((s) => s.status === 'DONE').length;
  const wbsProgressPercent = wbsSubtasks.length > 0 ? Math.round((doneWbsCount / wbsSubtasks.length) * 100) : 0;

  // Quyền Reviewer / QA
  const isReviewerOrManager =
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    (task?.reviewerId && task.reviewerId === user?.id);

  const isTaskInReview = task?.status === 'REVIEW';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-md"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* HEADER MODAL */}
        <header className="flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="space-y-1.5 flex-1 pr-4">
            {/* Breadcrumb & Tags */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  task?.status === 'DONE'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : task?.status === 'REVIEW'
                    ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                    : task?.status === 'IN_PROGRESS'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Trạng thái: {task?.status || 'TODO'}
              </span>

              {/* Milestone Tag */}
              {task?.milestone && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2.5 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                  <Flag className="w-3 h-3 text-violet-500" />
                  Mốc: {task.milestone.title}
                </span>
              )}

              {/* Parent Task Badge */}
              {(task?.isParent || (task?.subtasks && task.subtasks.length > 0)) && (
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/80 dark:text-violet-300">
                  📦 Hạng mục lớn (Parent Task)
                </span>
              )}

              {/* CompletedAt Check Badge */}
              {task?.completedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã hoàn thành: {new Date(task.completedAt).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>

            <h2 id="task-details-title" className="text-xl font-black text-slate-900 dark:text-white">
              {task?.title || 'Đang tải công việc...'}
            </h2>

            {/* Breadcrumb nếu là subtask */}
            {task?.parentTask && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Thuộc công việc cha:</span>
                  <strong className="underline underline-offset-2">{task.parentTask.title}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentTaskId(task.parentTask!.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 dark:bg-slate-800 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
                  title="Chuyển tới công việc cha"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Xem công việc cha ↗</span>
                </button>
              </div>
            )}

            {task?.project && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium pt-0.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Dự án: <strong className="text-slate-700 dark:text-slate-300">{task.project.name}</strong>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng chi tiết"
            className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : !task ? (
          <p role="alert" className="p-6 text-sm text-rose-600">
            Không tải được công việc này.
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 lg:grid lg:grid-cols-12 lg:gap-6 space-y-6 lg:space-y-0">
            {/* CỘT TRÁI (7 CỘT): PHẠM VI CÔNG VIỆC & THỰC THI (WBS, DOD, QA & GEMINI COPILOT) */}
            <div className="lg:col-span-7 space-y-5">
              {/* KHỐI 1: GEMINI AI TASK COPILOT BANNER */}
              <section className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4 dark:border-indigo-900/60 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                        🤖 Google Gemini AI Task Copilot
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Tự động phân tách cây công việc con WBS và khởi tạo tiêu chí nghiệm thu Definition of Done (DoD) chuẩn kỹ thuật chỉ sau 2 giây.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAiBreakdown}
                    disabled={isAiBreakingDown}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isAiBreakingDown ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang phân rã WBS...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>Phân rã WBS bằng AI</span>
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* KHỐI 2: HỘP PHÊ DUYỆT REVIEWER / QA */}
              {(isTaskInReview || isReviewerOrManager || Boolean(task.rejectReason)) && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-200">
                        Nghiệm thu kiểm thử (QA / Reviewer Approval)
                      </h3>
                    </div>
                    {task.reviewer && (
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-lg">
                        Reviewer: {task.reviewer.name}
                      </span>
                    )}
                  </div>

                  {/* Cảnh báo lý do từ chối nếu có */}
                  {task.rejectReason && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Lý do từ chối kiểm thử gần nhất:</strong>
                        <p className="mt-0.5">{task.rejectReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Các nút thao tác dành cho Reviewer/Manager */}
                  {isReviewerOrManager && task.status !== 'DONE' && (
                    <div className="pt-2 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApproveReview}
                          disabled={isReviewActionLoading}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {isReviewActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>✓ Phê duyệt & Đưa vào DONE</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowRejectForm(!showRejectForm)}
                          disabled={isReviewActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>✕ Trả về sửa đổi (Reject)</span>
                        </button>
                      </div>

                      {showRejectForm && (
                        <div className="space-y-2 p-3 rounded-xl border border-rose-200 bg-white dark:bg-slate-900">
                          <label className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                            Nhập lý do bắt buộc sửa lỗi / từ chối:
                          </label>
                          <textarea
                            value={rejectReasonText}
                            onChange={(e) => setRejectReasonText(e.target.value)}
                            placeholder="Mô tả cụ thể bug, lỗi giao diện hoặc logic chưa hoàn tất..."
                            rows={2}
                            className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 p-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowRejectForm(false)}
                              className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={handleRejectReview}
                              disabled={isReviewActionLoading || !rejectReasonText.trim()}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                            >
                              Xác nhận từ chối
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* KHỐI 3: TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA / DEFINITION OF DONE - DoD) */}
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Tiêu chí nghiệm thu (Definition of Done - DoD)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Các điều kiện tiên quyết cần đạt để được phép nghiệm thu sang cột DONE
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                    {checklists.filter((c) => c.isCompleted).length}/{checklists.length}
                  </span>
                </div>

                {/* Danh sách checklist */}
                <div className="space-y-2">
                  {checklists.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 transition"
                    >
                      <label className="flex items-start gap-2.5 flex-1 cursor-pointer">
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id)}
                          className="mt-0.5 text-indigo-600 dark:text-indigo-400 hover:scale-110 transition cursor-pointer"
                        >
                          {item.isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div className="space-y-0.5 flex-1">
                          <p
                            className={`text-xs font-medium ${
                              item.isCompleted
                                ? 'text-slate-400 line-through dark:text-slate-500'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {item.content}
                          </p>
                          {item.isCompleted && item.completedBy && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              ✓ Xác nhận bởi <strong>{item.completedBy.name}</strong>
                              {item.completedAt && ` lúc ${new Date(item.completedAt).toLocaleTimeString('vi-VN')}`}
                            </p>
                          )}
                        </div>
                      </label>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.isRequired && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            Bắt buộc
                          </span>
                        )}
                        {canAssignTask && (
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklist(item.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Xóa tiêu chí"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {checklists.length === 0 && (
                    <p className="text-center py-3 text-xs text-slate-400 dark:text-slate-500 italic">
                      Chưa có tiêu chí nghiệm thu DoD nào được thiết lập.
                    </p>
                  )}
                </div>

                {/* Form thêm tiêu chí mới */}
                <form onSubmit={handleAddChecklist} className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    placeholder="Nhập tiêu chí nghiệm thu mới (DoD)..."
                    className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newChecklistRequired}
                      onChange={(e) => setNewChecklistRequired(e.target.checked)}
                      className="accent-indigo-600"
                    />
                    <span>Bắt buộc</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isAddingChecklist || !newChecklistText.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shrink-0"
                  >
                    + Thêm
                  </button>
                </form>
              </section>

              {/* KHỐI 4: CÂY CÔNG VIỆC CON WBS (SUBTASKS TREE) */}
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Cây Công việc con WBS (Subtasks Tree)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Tiến độ hoàn thành: {doneWbsCount}/{wbsSubtasks.length} ({wbsProgressPercent}%)
                      </p>
                    </div>
                  </div>
                  {canEditSubtasks && (
                    <button
                      type="button"
                      onClick={() => setShowWbsForm(!showWbsForm)}
                      className="px-3 py-1 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition cursor-pointer"
                    >
                      {showWbsForm ? '✕ Đóng form' : '+ Thêm việc con'}
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${wbsProgressPercent}%` }}
                  />
                </div>

                {/* Form thêm WBS Subtask */}
                {showWbsForm && (
                  <form onSubmit={handleCreateWbsSubtask} className="space-y-3 p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                    <input
                      type="text"
                      value={wbsTitle}
                      onChange={(e) => setWbsTitle(e.target.value)}
                      placeholder="Tên công việc con..."
                      required
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={wbsAssigneeId}
                        onChange={(e) => setWbsAssigneeId(e.target.value)}
                        className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                      >
                        <option value="">Giao cho...</option>
                        {usersList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={wbsDueDate}
                        onChange={(e) => setWbsDueDate(e.target.value)}
                        className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                      />

                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="100"
                        value={wbsEstimatedHours}
                        onChange={(e) => setWbsEstimatedHours(e.target.value ? Number(e.target.value) : '')}
                        placeholder="Số giờ (ước tính)..."
                        className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWbsForm(false)}
                        className="px-3 py-1 rounded-xl text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingWbs || !wbsTitle.trim()}
                        className="px-3.5 py-1 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isCreatingWbs ? 'Đang tạo...' : 'Tạo việc con'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Danh sách WBS Subtasks */}
                <div className="space-y-2">
                  {wbsSubtasks.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-300 transition"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {st.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span>👤 {st.assignee?.name || 'Chưa giao'}</span>
                          {st.dueDate && (
                            <span>📅 {new Date(st.dueDate).toLocaleDateString('vi-VN')}</span>
                          )}
                          {st.estimatedHours && <span>⏱️ {st.estimatedHours}h</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            st.status === 'DONE'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              : st.status === 'IN_PROGRESS'
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {st.status}
                        </span>

                        <button
                          type="button"
                          onClick={() => setCurrentTaskId(st.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Mở việc con này"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {canEditSubtasks && (
                          <button
                            type="button"
                            onClick={() => handleDeleteWbsSubtask(st.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Xóa việc con"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {wbsSubtasks.length === 0 && (
                    <p className="text-center py-3 text-xs text-slate-400 dark:text-slate-500 italic">
                      Chưa có việc con WBS nào. Hãy dùng nút AI Copilot hoặc Thêm việc con ở trên.
                    </p>
                  )}
                </div>
              </section>

              {/* KHỐI 5: MÔ TẢ & TỆP ĐÍNH KÈM */}
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Mô tả công việc
                </h3>
                <p className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  {task.description || 'Chưa có mô tả chi tiết.'}
                </p>

                {/* Tệp đính kèm */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Paperclip className="h-3.5 w-3.5 text-indigo-500" />
                      Tệp đính kèm ({task.attachments?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={isUploadingAttachment}
                      className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      + Tải lên tệp
                    </button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      onChange={handleAttachmentInput}
                      className="hidden"
                      aria-label="Chọn tệp đính kèm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    {(task.attachments || []).map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate text-slate-700 dark:text-slate-200">{attachment.fileName}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => downloadAttachment(attachment)}
                            className="p-1 hover:text-indigo-600 transition"
                            title="Tải về"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAttachment(attachment.id)}
                            className="p-1 hover:text-rose-600 transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* CỘT PHẢI (5 CỘT): QUẢN TRỊ DỰ ÁN, PHỤ THUỘC, ĐỊNH MỨC & TABS DỮ LIỆU */}
            <div className="lg:col-span-5 space-y-5">
              {/* KHỐI 1: QUAN HỆ PHỤ THUỘC (DEPENDENCIES) */}
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Quan hệ phụ thuộc (Dependencies)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                    {dependencies.length + dependedBy.length} liên kết
                  </span>
                </div>

                {/* Danh sách task đang chặn task này (Blocked by) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                    🔒 Bị khóa bởi các task tiền đề:
                  </span>
                  {dependencies.filter((d) => d.type === 'BLOCKED_BY').length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Không bị chặn bởi công việc nào.</p>
                  )}
                  {dependencies
                    .filter((d) => d.type === 'BLOCKED_BY')
                    .map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs"
                      >
                        <span className="truncate font-medium text-rose-900 dark:text-rose-200">
                          {dep.dependsOnTask?.title || 'Task tiền đề'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              dep.dependsOnTask?.status === 'DONE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {dep.dependsOnTask?.status || 'PENDING'}
                          </span>
                          {canAssignTask && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDependency(dep.id)}
                              className="p-1 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Danh sách task bị task này chặn (Blocks) */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    ⛔ Đang khóa các task tiếp theo:
                  </span>
                  {dependedBy.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Chưa liên kết khóa task nào.</p>
                  )}
                  {dependedBy.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs"
                    >
                      <span className="truncate font-medium text-amber-900 dark:text-amber-200">
                        {dep.task?.title || 'Task bị khóa'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                          {dep.task?.status || 'PENDING'}
                        </span>
                        {canAssignTask && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDependency(dep.id)}
                            className="p-1 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form thêm liên kết phụ thuộc */}
                {canAssignTask && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={selectedDepTaskId}
                        onChange={(e) => setSelectedDepTaskId(e.target.value)}
                        className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                      >
                        <option value="">Chọn task liên kết...</option>
                        {projectTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.status})
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedDepType}
                        onChange={(e) => setSelectedDepType(e.target.value as DependencyType)}
                        className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                      >
                        <option value="BLOCKED_BY">Bị chặn bởi (BLOCKED_BY)</option>
                        <option value="BLOCKS">Khóa task này (BLOCKS)</option>
                        <option value="RELATES_TO">Liên quan tới (RELATES_TO)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDependency}
                      disabled={isAddingDep || !selectedDepTaskId}
                      className="w-full py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isAddingDep ? 'Đang liên kết...' : '+ Thêm liên kết phụ thuộc'}
                    </button>
                  </div>
                )}
              </section>

              {/* KHỐI 2: THUỘC TÍNH QUẢN TRỊ DỰ ÁN (MILESTONE, REVIEWER, ASSIGNEE, NORM) */}
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    Cấu hình Quản trị & Định mức 3P
                  </h3>
                  {canAssignTask && (
                    <button
                      type="button"
                      onClick={handleSaveMetadata}
                      disabled={isSavingMeta}
                      className="px-3 py-1 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isSavingMeta ? 'Đang lưu...' : 'Lưu cấu hình'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Milestone */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Mốc dự án (Milestone / Sprint)
                    </label>
                    <select
                      value={milestoneId}
                      onChange={(e) => setMilestoneId(e.target.value)}
                      disabled={!canAssignTask}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                      <option value="">Chưa gán Milestone</option>
                      {projectMilestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reviewer / QA */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Người kiểm thử / QA Reviewer
                    </label>
                    <select
                      value={reviewerId}
                      onChange={(e) => setReviewerId(e.target.value)}
                      disabled={!canAssignTask}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                      <option value="">Chưa gán Reviewer</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Người thực hiện (Assignee)
                    </label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      disabled={!canAssignTask}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                      <option value="">Chưa giao việc</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Mức ưu tiên
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      disabled={!canAssignTask}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                      <option value="LOW">Thấp (LOW)</option>
                      <option value="MEDIUM">Trung bình (MEDIUM)</option>
                      <option value="HIGH">Cao (HIGH)</option>
                      <option value="URGENT">Khẩn cấp (URGENT)</option>
                    </select>
                  </div>

                  {/* Category Norm */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Nhóm định mức lương
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as TaskCategory)}
                      disabled={!canAssignTask}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                      <option value="CORE_PROJECT">Dự án cốt lõi (1:3)</option>
                      <option value="RD">R&D (Trần 500h)</option>
                      <option value="OPERATIONS">Vận hành (660h)</option>
                    </select>
                  </div>

                  {/* Estimated Hours */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Giờ ước tính (Estimated)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : '')}
                      disabled={!canAssignTask}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    />
                  </div>
                </div>

                {/* Time & Log Work summary */}
                <div className="pt-2 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-500">Giờ thực tế đã ghi nhận:</span>
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {task.actualHours || 0} giờ / {task.estimatedHours || 0} giờ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLogWorkOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 dark:bg-slate-800 dark:border-slate-700 dark:text-indigo-300 shadow-xs transition cursor-pointer"
                  >
                    + Log Giờ Làm
                  </button>
                </div>
              </section>

              {/* KHỐI 3: HỆ THỐNG TABS (TRAO ĐỔI | WORKLOGS | AUDIT TRAIL) */}
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col h-96">
                {/* Tab Switcher */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 mb-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveRightTab('comments')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer ${
                      activeRightTab === 'comments'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Trao đổi ({task.comments?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightTab('worklogs')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer ${
                      activeRightTab === 'worklogs'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Nhật ký giờ ({workLogsList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightTab('audit')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer ${
                      activeRightTab === 'audit'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Kiểm vết (Audit)</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {/* Comments */}
                  {activeRightTab === 'comments' && (
                    <div className="space-y-2.5 h-full flex flex-col justify-between">
                      <div className="space-y-2 overflow-y-auto max-h-56">
                        {(task.comments || []).map((c) => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{c.author?.name || 'Thành viên'}</span>
                              <span className="text-[10px]">{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300">{c.content}</p>
                          </div>
                        ))}
                        {(!task.comments || task.comments.length === 0) && (
                          <p className="text-center py-6 text-xs text-slate-400 italic">Chưa có bình luận nào.</p>
                        )}
                      </div>

                      <form onSubmit={addComment} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Viết trao đổi thảo luận..."
                          className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={isSubmitting || !commentText.trim()}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                        >
                          Gửi
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Worklogs */}
                  {activeRightTab === 'worklogs' && (
                    <div className="space-y-2">
                      {workLogsList.map((wl) => (
                        <div key={wl.id} className="p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {wl.user?.name || 'Nhân sự'} đã log <strong>{wl.hours} giờ</strong>
                            </span>
                            <p className="text-[11px] text-slate-500">{wl.description || 'Không có ghi chú'}</p>
                          </div>
                          <span className="text-[10px] text-slate-400">{new Date(wl.loggedDate).toLocaleDateString('vi-VN')}</span>
                        </div>
                      ))}
                      {workLogsList.length === 0 && (
                        <p className="text-center py-6 text-xs text-slate-400 italic">Chưa có bản ghi giờ làm nào.</p>
                      )}
                    </div>
                  )}

                  {/* Audit Trail */}
                  {activeRightTab === 'audit' && (
                    <div className="space-y-2">
                      {isLoadingActivities ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        </div>
                      ) : (
                        activities.map((act) => (
                          <div key={act.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-0.5">
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{act.action}</span>
                              <span className="text-[10px]">{new Date(act.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400">{act.description}</p>
                          </div>
                        ))
                      )}
                      {!isLoadingActivities && activities.length === 0 && (
                        <p className="text-center py-6 text-xs text-slate-400 italic">Chưa có lịch sử kiểm vết.</p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* MODAL LOG WORK */}
        {isLogWorkOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">⏱️ Ghi nhận giờ làm việc (Log Work)</h3>
              <form onSubmit={handleLogWorkSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Số giờ đã làm</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 p-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày làm việc</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 p-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Mô tả công việc đã làm</label>
                  <textarea
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    placeholder="Mô tả ngắn gọn nội dung..."
                    rows={2}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 p-2"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsLogWorkOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingWork}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isLoggingWork ? 'Đang lưu...' : 'Xác nhận Log'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailsModal;
