import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwtUtils';
import { sendOneTimeCodeEmail } from '../services/emailService';
import { getClientRedirectUrl } from '../utils/clientRedirect';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;
type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  name: string;
  departmentId?: string | null;
}

const generateTokens = (user: TokenPayload) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

/**
 * 1. Đăng ký tài khoản mới (Password hash bcrypt 12 vòng)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: họ tên, email và mật khẩu.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || name.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Email không hợp lệ hoặc họ tên vượt quá 100 ký tự.',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu phải chứa ít nhất 6 ký tự.',
      });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Email này đã được sử dụng. Vui lòng chọn email khác.',
      });
      return;
    }

    await prisma.oneTimeCode.deleteMany({
      where: { email, purpose: 'REGISTER' },
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'EMPLOYEE',
        isActive: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        createdAt: true,
      },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await prisma.oneTimeCode.create({
        data: {
          email,
          purpose: 'REGISTER',
          codeHash: await bcrypt.hash(code, 10),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });
      await sendOneTimeCodeEmail(email, code, 'REGISTER');
    } catch (error) {
      await prisma.oneTimeCode.deleteMany({ where: { email, purpose: 'REGISTER' } });
      await prisma.user.delete({ where: { id: newUser.id } });
      throw error;
    }

    res.status(202).json({
      success: true,
      message: 'Mã xác nhận đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút.',
      data: { email: newUser.email },
    });
  } catch (error: any) {
    console.error('Lỗi register:', error);
    const status = error?.code === 'P2002' ? 409 : 503;
    res.status(status).json({
      success: false,
      message: status === 409
        ? 'Email này đã được sử dụng. Vui lòng chọn email khác.'
        : 'Không thể gửi mã xác nhận lúc này. Vui lòng kiểm tra cấu hình email và thử lại.',
    });
  }
};

const issueOneTimeCode = async (email: string, purpose: OtpPurpose): Promise<'sent' | 'cooldown'> => {
  const now = new Date();
  await prisma.oneTimeCode.deleteMany({ where: { expiresAt: { lte: now } } });
  const existingCode = await prisma.oneTimeCode.findUnique({
    where: { email_purpose: { email, purpose } },
  });
  if (existingCode && now.getTime() - existingCode.createdAt.getTime() < OTP_RESEND_INTERVAL_MS) {
    return 'cooldown';
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  const challenge = await prisma.oneTimeCode.upsert({
    where: { email_purpose: { email, purpose } },
    create: { email, purpose, codeHash, expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
    update: { codeHash, expiresAt: new Date(now.getTime() + OTP_TTL_MS), createdAt: now },
  });

  try {
    await sendOneTimeCodeEmail(email, code, purpose);
  } catch (error) {
    await prisma.oneTimeCode.deleteMany({ where: { id: challenge.id } });
    throw error;
  }

  return 'sent';
};

export const resendEmailVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'Địa chỉ email không hợp lệ.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { isActive: true } });
    if (user && !user.isActive) {
      await issueOneTimeCode(email, 'REGISTER');
    }

    res.status(200).json({
      success: true,
      message: 'Nếu tài khoản đang chờ xác nhận, mã mới sẽ được gửi đến email của bạn.',
    });
  } catch (error: any) {
    console.error('Lỗi resendEmailVerification:', error);
    res.status(503).json({ success: false, message: 'Không thể gửi mã xác nhận lúc này. Vui lòng thử lại sau.' });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    if (!email || !/^\d{6}$/.test(code)) {
      res.status(400).json({ success: false, message: 'Vui lòng nhập email và mã OTP gồm 6 chữ số.' });
      return;
    }

    const challenge = await prisma.oneTimeCode.findUnique({
      where: { email_purpose: { email, purpose: 'REGISTER' } },
    });
    if (!challenge || challenge.expiresAt <= new Date() || !(await bcrypt.compare(code, challenge.codeHash))) {
      res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    const user = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.oneTimeCode.deleteMany({
        where: { id: challenge.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) return null;

      return transaction.user.update({
        where: { email },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          departmentId: true,
          createdAt: true,
        },
      });
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Email đã được xác nhận. Tài khoản của bạn đã được kích hoạt.',
      data: { user, ...generateTokens(user) },
    });
  } catch (error: any) {
    console.error('Lỗi verifyEmail:', error);
    res.status(500).json({ success: false, message: 'Không thể xác nhận email lúc này.' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'Địa chỉ email không hợp lệ.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
    if (user?.isActive) {
      await issueOneTimeCode(email, 'RESET_PASSWORD');
    }

    res.status(200).json({
      success: true,
      message: 'Nếu email đã đăng ký, mã khôi phục sẽ được gửi đến hộp thư của bạn.',
    });
  } catch (error: any) {
    console.error('Lỗi forgotPassword:', error);
    res.status(503).json({ success: false, message: 'Không thể gửi mã khôi phục lúc này. Vui lòng thử lại sau.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code) || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Email hoặc mã OTP không hợp lệ; mật khẩu mới cần tối thiểu 6 ký tự.',
      });
      return;
    }

    const [challenge, user] = await Promise.all([
      prisma.oneTimeCode.findUnique({ where: { email_purpose: { email, purpose: 'RESET_PASSWORD' } } }),
      prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } }),
    ]);
    if (
      !challenge ||
      challenge.expiresAt <= new Date() ||
      !(await bcrypt.compare(code, challenge.codeHash)) ||
      !user?.isActive
    ) {
      res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const reset = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.oneTimeCode.deleteMany({
        where: { id: challenge.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) return false;

      await transaction.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      });
      return true;
    });

    if (!reset) {
      res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.' });
  } catch (error: any) {
    console.error('Lỗi resetPassword:', error);
    res.status(500).json({ success: false, message: 'Không thể đặt lại mật khẩu lúc này.' });
  }
};

/**
 * 2. Đăng nhập hệ thống bằng email và mật khẩu
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email và mật khẩu.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        department: true,
      },
    });

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
      return;
    }

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      departmentId: user.departmentId,
    });

    const { password: _, ...userInfo } = user;

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        user: userInfo,
        ...tokens,
      },
    });
  } catch (error: any) {
    console.error('Lỗi login:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình đăng nhập.',
      error: error.message,
    });
  }
};

/**
 * 3. Xử lý sau Passport Google Callback
 */
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as any;
    if (!user) {
      res.redirect(getClientRedirectUrl('login', { error: 'GoogleAuthFailed' }).toString());
      return;
    }

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      departmentId: user.departmentId,
    });

    const oauthParams = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    const redirectUrl = getClientRedirectUrl('oauth-callback');
    redirectUrl.hash = oauthParams.toString();
    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('Lỗi googleCallback:', error);
    res.redirect(getClientRedirectUrl('login', { error: 'OAuthException' }).toString());
  }
};

/**
 * 4. Làm mới access token bằng refresh token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp refresh token.',
      });
      return;
    }

    const decoded = verifyRefreshToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        departmentId: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Tài khoản không hợp lệ hoặc đã bị khóa.',
      });
      return;
    }

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      departmentId: user.departmentId,
    });

    res.status(200).json({
      success: true,
      message: 'Cấp mới token thành công!',
      data: tokens,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }
};

/**
 * 5. Đăng xuất
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công!',
  });
};

/**
 * 6. Lấy thông tin user hiện tại kèm đầy đủ quan hệ
 */
export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        projectMembers: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignedTasks: true,
            createdProjects: true,
            comments: true,
            kpiLogs: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      return;
    }

    const { password: _, ...safeUser } = user;

    res.status(200).json({
      success: true,
      data: safeUser,
    });
  } catch (error: any) {
    console.error('Lỗi getMe:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy thông tin người dùng.',
      error: error.message,
    });
  }
};

/**
 * 7. Cập nhật hồ sơ cá nhân (name, avatar)
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { name, avatar } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực.' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (avatar !== undefined) updateData.avatar = avatar;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        departmentId: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công!',
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Lỗi updateProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật thông tin cá nhân.',
      error: error.message,
    });
  }
};

/**
 * 8. Đổi mật khẩu
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { oldPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực.' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    // Nếu user có mật khẩu cũ (không phải chỉ dùng Google OAuth)
    if (user.password) {
      if (!oldPassword) {
        res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mật khẩu hiện tại.',
        });
        return;
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        res.status(400).json({
          success: false,
          message: 'Mật khẩu hiện tại không chính xác.',
        });
        return;
      }
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
    });
  } catch (error: any) {
    console.error('Lỗi changePassword:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đổi mật khẩu.',
      error: error.message,
    });
  }
};
