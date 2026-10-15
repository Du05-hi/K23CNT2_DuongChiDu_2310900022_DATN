import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: PaginationMeta;
  errors?: any;
}

/**
 * Standardized success response handler
 * @param res Express response object
 * @param data Payload to return
 * @param message Human-readable success message
 * @param statusCode HTTP Status Code (default: 200)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): Response<ApiResponse<T>> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Standardized error response handler
 * @param res Express response object
 * @param message Human-readable error message
 * @param statusCode HTTP Status Code (default: 400)
 * @param errors Additional error details or validation error array
 */
export const sendError = (
  res: Response,
  message = 'An error occurred',
  statusCode = 400,
  errors?: any
): Response<ApiResponse> => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors !== undefined ? { errors } : {}),
  });
};

/**
 * Standardized paginated response handler
 * @param res Express response object
 * @param data Array of records for current page
 * @param total Total count of records
 * @param page Current page number
 * @param limit Items per page
 * @param message Human-readable message
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
): Response<ApiResponse<T[]>> => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.max(1, Number(limit) || 10);
  const totalPages = Math.ceil(total / currentLimit) || 1;

  const pagination: PaginationMeta = {
    page: currentPage,
    limit: currentLimit,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };

  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

export default {
  sendSuccess,
  sendError,
  sendPaginated,
};
