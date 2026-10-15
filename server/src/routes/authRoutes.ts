import express from 'express';
import passport from 'passport';
import {
  register,
  login,
  googleCallback,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
} from '../controllers/authController';
import authenticateToken from '../middlewares/authMiddleware';
import { isGoogleAuthConfigured } from '../config/googleAuth';
import { getClientRedirectUrl } from '../utils/clientRedirect';

const router = express.Router();

// 1. Đăng ký & Đăng nhập truyền thống
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendEmailVerification);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 2. Google OAuth 2.0 Authentication
router.get('/google', (_req, res, next) => {
  if (!isGoogleAuthConfigured()) {
    res.redirect(getClientRedirectUrl('login', { error: 'GoogleOAuthNotConfigured' }).toString());
    return;
  }
  next();
}, passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

router.get(
  '/google/callback',
  (_req, res, next) => {
    if (!isGoogleAuthConfigured()) {
      res.redirect(getClientRedirectUrl('login', { error: 'GoogleOAuthNotConfigured' }).toString());
      return;
    }
    next();
  },
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (error, user) => {
      if (error || !user) {
        if (error) {
          console.error('[GoogleAuth] OAuth callback failed:', error.message);
        }
        res.redirect(getClientRedirectUrl('login', { error: 'GoogleAuthFailed' }).toString());
        return;
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  googleCallback
);

// 3. Quản lý phiên làm việc & Token
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// 4. Quản lý thông tin tài khoản người dùng hiện tại (Yêu cầu xác thực)
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

export default router;
