import express from 'express';
import {
  createTask,
  getTasksByProject,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
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
} from '../controllers/taskController';
import { searchTasksNL } from '../controllers/aiController';
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
router.put('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

// 3. Tài liệu đính kèm
router.post(
  '/:id/attachments',
  authorizeTaskAttachmentAccess,
  uploadTaskFiles,
  uploadTaskAttachment
);
router.get('/:id/attachments/:attachmentId/content', getTaskAttachmentContent);
router.delete('/:id/attachments/:attachmentId', deleteTaskAttachment);

// 4. Bình luận (Comments)
router.post('/:id/comments', addComment);
router.get('/:id/comments', getComments);

// 5. Công việc con (Sub-tasks)
router.post('/:id/subtasks', createSubTask);
router.put('/subtasks/:subTaskId', updateSubTask);
router.delete('/subtasks/:subTaskId', deleteSubTask);

export default router;
