import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

/**
 * Custom application error class for operational errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(message: string, statusCode = 500, details?: any, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Higher-order function to catch asynchronous errors in route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 404));
};

/**
 * Global centralized error handling middleware
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || undefined;

  // Handle known operational AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }
  // Handle Prisma Known Request Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        const target = (err.meta?.target as string[]) || [];
        message = `Unique constraint violation: Field '${target.join(', ')}' already exists.`;
        details = { target: err.meta?.target };
        break;
      }
      case 'P2025': {
        statusCode = 404;
        message = 'Requested record not found or does not exist.';
        details = { cause: err.meta?.cause };
        break;
      }
      case 'P2003': {
        statusCode = 400;
        message = 'Foreign key constraint failed on reference.';
        details = { field: err.meta?.field_name };
        break;
      }
      case 'P2014': {
        statusCode = 400;
        message = 'The change you are trying to make would violate the required relation.';
        break;
      }
      default: {
        statusCode = 400;
        message = `Database query error: ${err.message}`;
        break;
      }
    }
  }
  // Handle Prisma Validation Errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided to database query.';
    details = process.env.NODE_ENV === 'development' ? err.message : undefined;
  }
  // Handle JWT Errors
  else if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = 'JWT token has expired. Please authenticate again.';
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid JWT token supplied.';
  }
  // Handle Express-validator or custom validation errors
  else if (err.name === 'ValidationError' || (Array.isArray(err.errors) && err.errors.length > 0)) {
    statusCode = 400;
    message = 'Validation failed on input data.';
    details = err.errors;
  }

  // Print stack trace in non-production or for unexpected internal errors
  if (process.env.NODE_ENV === 'development' || statusCode === 500) {
    console.error('[Error Details]:', {
      statusCode,
      message,
      stack: err.stack,
      details,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

export default {
  AppError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
