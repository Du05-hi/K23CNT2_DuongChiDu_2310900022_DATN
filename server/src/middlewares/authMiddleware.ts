import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken } from '../utils/jwtUtils';
import { prisma } from '../config/prisma';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  departmentId?: string | null;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1].trim();

  if (!bearerToken) {
    return res.status(401).json({
      success: false,
      message: 'Access token is missing or invalid format. Expected "Bearer <token>"',
      code: 'TOKEN_MISSING',
    });
  }

  try {
    req.user = verifyAccessToken(bearerToken);
    return next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please refresh your session.',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token.',
        code: 'TOKEN_INVALID',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
      code: 'AUTH_FAILED',
    });
  }
};

/**
 * Middleware to restrict access based on user role(s)
 * @param roles Array of allowed role names (e.g., 'ADMIN', 'MANAGER', 'EMPLOYEE')
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to role check.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have permission to perform this action. Required roles: ${roles.join(
          ', '
        )}.`,
        code: 'FORBIDDEN',
      });
    }

    return next();
  };
};

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  return verifyToken(req, res, () => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    void prisma.user
      .findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, name: true, departmentId: true, isActive: true },
      })
      .then((user) => {
        if (!user) {
          res.status(401).json({
            success: false,
            message: 'Tài khoản không còn tồn tại.',
            code: 'ACCOUNT_NOT_FOUND',
          });
          return;
        }
        if (!user.isActive) {
          res.status(403).json({
            success: false,
            message: 'Tài khoản đã bị vô hiệu hóa.',
            code: 'ACCOUNT_DISABLED',
          });
          return;
        }

        const { isActive: _isActive, ...authUser } = user;
        req.user = authUser;
        next();
      })
      .catch(next);
  });
};
export const authorizeRoles = requireRole;

export default authenticateToken;
