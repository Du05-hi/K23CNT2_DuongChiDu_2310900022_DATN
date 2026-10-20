import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const uploadRoot = path.join(__dirname, '../../uploads');
const taskUploadDir = path.join(uploadRoot, 'tasks');

fs.mkdirSync(taskUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, taskUploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase().slice(0, 12);
    cb(null, `${randomUUID()}${extension}`);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
]);

const taskFilesUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    const error = new Error('Định dạng file không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP, GIF, PDF, văn bản và file Excel/Word.');
    Object.assign(error, { statusCode: 400 });
    cb(error);
  },
});

export const uploadTaskFiles = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  taskFilesUpload.array('files', 10)(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (!uploadedFiles?.length) {
      next(error);
      return;
    }

    void Promise.allSettled(uploadedFiles.map((file) => fs.promises.unlink(file.path)))
      .then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected' && (result.reason as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Không thể dọn file upload khi middleware từ chối request:', result.reason);
          }
        });
        next(error);
      });
  });
};
