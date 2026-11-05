import express from 'express';
import {
  createTask,
  getTasksByProject,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskDeadline,
  updateTaskStatus,
  approveTaskReview,
  rejectTaskReview,
  getTaskChecklists,
  createTaskChecklist,
  toggleTaskChecklist,
  deleteTaskChecklist,
  getTaskDependencies,
  createTaskDependency,
  deleteTaskDependency,
  getProjectMilestones,
  createProjectMilestone,
  updateProjectMilestone,
  deleteProjectMilestone,
  deleteTask,
  addComment,
  getComments,
  createSubTask,
  updateSubTask,
  deleteSubTask,
  uploadTaskAttachment,
  deleteTaskAttachment,
  authorizeTaskAttachmentAccess,
  getTaskAttachmentContent,
  logWorkTask,
  getTaskWorkLogs,
  getTaskActivities,
} from '../controllers/taskController';
import { searchTasksNL, enterpriseTaskBreakdown } from '../controllers/aiController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { uploadTaskFiles } from '../config/upload';

const router = express.Router();

// Mọi route về tasks đều yêu cầu xác thực
router.use(authenticateToken);

// 1. Quản lý công việc
router.post('/', createTask);
router.get('/my-tasks', getMyTasks);
router.get('/project/:projectId', getTasksByProject);
router.post('/search-nl', searchTasksNL);

// 2. Chi tiết và cập nhật công việc
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.patch('/:id/deadline', updateTaskDeadline);
router.put('/:id/deadline', updateTaskDeadline);
router.put('/:id/status', updateTaskStatus);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

// 3. Quy trình Review & QA nghiệm thu công việc
router.post('/:id/review-approve', approveTaskReview);
router.post('/:id/review-reject', rejectTaskReview);

// 4. Gemini AI Copilot phân rã WBS & DoD
router.post('/:id/ai-breakdown', enterpriseTaskBreakdown);

// 5. Tiêu chí nghiệm thu (Definition of Done - DoD)
router.get('/:id/checklists', getTaskChecklists);
router.post('/:id/checklists', createTaskChecklist);
router.put('/checklists/:checklistId/toggle', toggleTaskChecklist);
router.delete('/checklists/:checklistId', deleteTaskChecklist);

// 6. Quan hệ phụ thuộc công việc (Task Dependencies)
router.get('/:id/dependencies', getTaskDependencies);
router.post('/:id/dependencies', createTaskDependency);
router.delete('/dependencies/:dependencyId', deleteTaskDependency);

// 7. Mốc bàn giao dự án (Milestones)
router.get('/milestones/project/:projectId', getProjectMilestones);
router.post('/milestones/project/:projectId', createProjectMilestone);
router.put('/milestones/:id', updateProjectMilestone);
router.delete('/milestones/:id', deleteProjectMilestone);

// 8. Tài liệu đính kèm
router.post(
  '/:id/attachments',
  authorizeTaskAttachmentAccess,
  uploadTaskFiles,
  uploadTaskAttachment
);
router.get('/:id/attachments/:attachmentId/content', getTaskAttachmentContent);
router.delete('/:id/attachments/:attachmentId', deleteTaskAttachment);

// 9. Bình luận (Comments)
router.post('/:id/comments', addComment);
router.get('/:id/comments', getComments);

// 10. Công việc con (Sub-tasks)
router.post('/:id/subtasks', createSubTask);
router.put('/subtasks/:subTaskId', updateSubTask);
router.delete('/subtasks/:subTaskId', deleteSubTask);

// 11. Ghi nhận giờ làm (WorkLog) & Audit Trail (Lịch sử hoạt động)
router.post('/:id/worklogs', logWorkTask);
router.get('/:id/worklogs', getTaskWorkLogs);
router.get('/:id/activities', getTaskActivities);

export default router;
