import React, { FormEvent, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import taskService, { type Task, type UserSummary } from '../services/taskService';

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
  const [task, setTask] = useState<Task | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    taskService.getTaskById(taskId)
      .then((result) => {
        if (active) {
          setTask(result);
          setAssigneeId(result.assigneeId || '');
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
  }, [taskId]);

  const previewTaskId = task?.id;
  const previewAttachments = task?.attachments;

  useEffect(() => {
    if (!previewTaskId) return;
    let cancelled = false;
    const objectUrls: string[] = [];
    setAttachmentPreviewUrls({});

    const loadPreviews = async () => {
      const images = (previewAttachments || []).filter((attachment) =>
        attachment.fileType.startsWith('image/')
      );

      await Promise.all(images.map(async (attachment) => {
        try {
          const blob = await taskService.getTaskAttachmentContent(previewTaskId, attachment.id);
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          objectUrls.push(objectUrl);
          setAttachmentPreviewUrls((current) => ({ ...current, [attachment.id]: objectUrl }));
        } catch (error) {
          console.error(`Không thể tải ảnh đính kèm ${attachment.fileName}:`, error);
        }
      }));
    };

    void loadPreviews();
    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [previewTaskId, previewAttachments]);

  const uploadAttachments = async (files: File[]) => {
    if (!task || files.length === 0 || isUploadingAttachment) return;
    if (files.length > 10) {
      toast.error('Mỗi lần chỉ được tải lên tối đa 10 file.');
      return;
    }
    if (files.some((file) => file.size > 25 * 1024 * 1024)) {
      toast.error('Mỗi file không được vượt quá 25MB.');
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const uploaded = await taskService.uploadTaskAttachments(task.id, files);
      const updatedTask = { ...task, attachments: [...uploaded, ...(task.attachments || [])] };
      setTask(updatedTask);
      onTaskUpdated(updatedTask);
      toast.success(`Đã tải lên ${uploaded.length} file.`);
    } catch (error) {
      console.error('Không thể tải file đính kèm:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể tải file đính kèm.');
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const handleAttachmentInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    void uploadAttachments(Array.from(event.currentTarget.files || []));
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!task || deletingAttachmentId) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await taskService.deleteTaskAttachment(task.id, attachmentId);
      const updatedTask = {
        ...task,
        attachments: (task.attachments || []).filter((attachment) => attachment.id !== attachmentId),
      };
      setTask(updatedTask);
      onTaskUpdated(updatedTask);
      toast.success('Đã xóa file đính kèm.');
    } catch (error) {
      console.error('Không thể xóa file đính kèm:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể xóa file đính kèm.');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const downloadAttachment = async (attachment: NonNullable<Task['attachments']>[number]) => {
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
      console.error('Không thể tải file đính kèm:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể tải file đính kèm.');
    }
  };

  const saveAssignee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task || !canAssignTask || assigneeId === (task.assigneeId || '')) return;

    setIsSubmitting(true);
    try {
      const updatedTask = await taskService.updateTask(task.id, {
        assigneeId: assigneeId || null,
      });
      setTask(updatedTask);
      setAssigneeId(updatedTask.assigneeId || '');
      onTaskUpdated(updatedTask);
      toast.success('Đã cập nhật người thực hiện.');
    } catch (error) {
      console.error('Không thể cập nhật người thực hiện:', error);
      toast.error('Không thể cập nhật người thực hiện.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    } catch (error) {
      console.error('Không thể thêm bình luận:', error);
      toast.error('Không thể thêm bình luận.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSubtask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title || !task) return;

    setIsSubmitting(true);
    try {
      const subtask = await taskService.createSubTask(task.id, title);
      setTask({ ...task, subTasks: [...(task.subTasks || []), subtask] });
      setSubtaskTitle('');
      toast.success('Đã thêm công việc con.');
    } catch (error) {
      console.error('Không thể thêm công việc con:', error);
      toast.error('Không thể thêm công việc con.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    if (!task) return;
    try {
      const updated = await taskService.updateSubTask(task.id, subtaskId, isCompleted);
      setTask({
        ...task,
        subTasks: (task.subTasks || []).map((item) => item.id === subtaskId ? updated : item),
      });
    } catch (error) {
      console.error('Không thể cập nhật công việc con:', error);
      toast.error('Không thể cập nhật công việc con.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-md sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Chi tiết công việc</p>
            <h2 id="task-details-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {task?.title || 'Đang tải công việc...'}
            </h2>
            {task?.project && <p className="mt-1 text-xs text-slate-500">{task.project.name}</p>}
          </div>
          <button onClick={onClose} aria-label="Đóng chi tiết" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </header>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : !task ? (
          <p role="alert" className="p-6 text-sm text-rose-600">Không tải được công việc này.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 md:grid-cols-2 md:grid md:gap-6">
            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mô tả</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {task.description || 'Chưa có mô tả.'}
                </p>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Người thực hiện</h3>
                </div>
                {canAssignTask ? (
                  <form onSubmit={saveAssignee} className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={assigneeId}
                      onChange={(event) => setAssigneeId(event.target.value)}
                      aria-label="Chọn người thực hiện"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      <option value="">Chưa giao</option>
                      {usersList.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} ({person.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={isSubmitting || assigneeId === (task.assigneeId || '')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Lưu
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {task.assignee?.name || 'Chưa giao'}
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Danh sách công việc con</h3>
                  <span className="text-xs text-slate-500">
                    {(task.subTasks || []).filter((item) => item.isCompleted).length}/{task.subTasks?.length || 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {(task.subTasks || []).map((item) => (
                    <label key={item.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-sm dark:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={item.isCompleted}
                        disabled={!canEditSubtasks}
                        onChange={(event) => toggleSubtask(item.id, event.target.checked)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <span className={item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}>
                        {item.title}
                      </span>
                    </label>
                  ))}
                  {task.subTasks?.length === 0 && <p className="text-xs text-slate-500">Chưa có công việc con.</p>}
                </div>
                {canEditSubtasks && (
                  <form onSubmit={addSubtask} className="mt-3 flex gap-2">
                    <input
                      value={subtaskTitle}
                      onChange={(event) => setSubtaskTitle(event.target.value)}
                      maxLength={200}
                      placeholder="Thêm công việc con..."
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button disabled={isSubmitting || !subtaskTitle.trim()} className="rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50" aria-label="Thêm công việc con">
                      <Plus className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Paperclip className="h-4 w-4 text-indigo-500" />
                    Tệp đính kèm ({task.attachments?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={isUploadingAttachment}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploadingAttachment
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <UploadCloud className="h-3.5 w-3.5" />}
                    {isUploadingAttachment ? 'Đang tải...' : 'Tải tệp lên'}
                  </button>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip"
                    onChange={handleAttachmentInput}
                    className="hidden"
                    aria-label="Chọn tệp đính kèm"
                  />
                </div>
                <p className="mb-3 text-[11px] text-slate-500">
                  JPG, PNG, WEBP, GIF, PDF, TXT, Word, Excel hoặc ZIP; tối đa 25MB mỗi tệp và 10 tệp mỗi lần.
                </p>
                <div className="space-y-2">
                  {(task.attachments || []).map((attachment) => {
                    const previewUrl = attachmentPreviewUrls[attachment.id];
                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                      >
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={attachment.fileName}
                            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-700"
                          />
                        ) : (
                          <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                            {attachment.fileName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {(attachment.fileSize / 1024).toFixed(1)} KB · {new Date(attachment.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void downloadAttachment(attachment)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                          aria-label={`Tải ${attachment.fileName}`}
                          title="Tải xuống"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteAttachment(attachment.id)}
                          disabled={deletingAttachmentId !== null}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-950/40"
                          aria-label={`Xóa ${attachment.fileName}`}
                          title="Xóa"
                        >
                          {deletingAttachmentId === attachment.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    );
                  })}
                  {task.attachments?.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 py-5 text-center text-xs text-slate-500 dark:border-slate-700">
                      Chưa có tệp đính kèm.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="flex min-h-72 flex-col">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                Trao đổi ({task.comments?.length || 0})
              </h3>
              <div className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                {(task.comments || []).map((comment) => (
                  <article key={comment.id} className="rounded-lg bg-white p-3 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {comment.author?.name || 'Người dùng'}
                      </span>
                      <time className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleString('vi-VN')}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{comment.content}</p>
                  </article>
                ))}
                {task.comments?.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Chưa có trao đổi.</p>}
              </div>
              <form onSubmit={addComment} className="mt-3 space-y-2">
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Viết bình luận hoặc cập nhật tiến độ..."
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  disabled={isSubmitting || !commentText.trim()}
                  className="ml-auto flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Gửi bình luận
                </button>
              </form>
            </section>
          </div>
        )}
      </section>
    </div>
  );
};

export default TaskDetailsModal;
