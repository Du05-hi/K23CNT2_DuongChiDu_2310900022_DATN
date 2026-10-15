import jwt, { SignOptions } from 'jsonwebtoken';

export interface AccessTokenPayload {
  id: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  id: string;
}

const getAccessSecret = (): string =>
  process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key_here_min_32_chars';

const getRefreshSecret = (): string =>
  process.env.JWT_REFRESH_SECRET || 'your_super_secret_refresh_key_here_min_32_chars';

/**
 * Generate a short-lived JWT access token
 * @param payload User ID, email, role
 * @returns Signed JWT string
 */
export const generateAccessToken = (payload: AccessTokenPayload): string => {
  const secret = getAccessSecret();
  const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Generate a long-lived JWT refresh token
 * @param payload User ID
 * @returns Signed JWT string
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const secret = getRefreshSecret();
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify and decode an access token
 * @param token Raw JWT access token
 * @returns Decoded AccessTokenPayload or throws JsonWebTokenError / TokenExpiredError
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = getAccessSecret();
  return jwt.verify(token, secret) as AccessTokenPayload;
};

/**
 * Verify and decode a refresh token
 * @param token Raw JWT refresh token
 * @returns Decoded RefreshTokenPayload or throws JsonWebTokenError / TokenExpiredError
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = getRefreshSecret();
  return jwt.verify(token, secret) as RefreshTokenPayload;
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
