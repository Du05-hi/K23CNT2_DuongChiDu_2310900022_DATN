import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { Role } from '@prisma/client';
import { prisma } from './prisma';

const isUsableCredential = (value: string | undefined): boolean => {
  const credential = value?.trim();
  return Boolean(
    credential &&
    !/^your_google_client_(id|secret)$/i.test(credential) &&
    !/^replace_with_/i.test(credential)
  );
};

export const isGoogleAuthConfigured = (): boolean =>
  isUsableCredential(process.env.GOOGLE_CLIENT_ID) &&
  isUsableCredential(process.env.GOOGLE_CLIENT_SECRET);

export const configureGoogleAuth = (): void => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  if (!isGoogleAuthConfigured() || !clientID || !clientSecret) {
    console.warn(
      '[GoogleAuth] Warning: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google OAuth will not work until configured.'
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();
          const isEmailVerified = (profile._json as { email_verified?: boolean }).email_verified;
          if (!email || isEmailVerified !== true) {
            return done(new Error('A verified email is required from the Google account'), undefined);
          }

          const googleId = profile.id;
          const name = profile.displayName || email.split('@')[0];
          const avatar = profile.photos?.[0]?.value || null;

          const [googleUser, emailUser] = await Promise.all([
            prisma.user.findUnique({ where: { googleId } }),
            prisma.user.findUnique({ where: { email } }),
          ]);
          if (googleUser && emailUser && googleUser.id !== emailUser.id) {
            return done(new Error('Google account and email belong to different TaskFlow accounts'), undefined);
          }
          let user = googleUser || emailUser;

          if (user) {
            if (!user.isActive) {
              return done(new Error('Account disabled'), undefined);
            }

            if (!user.googleId || (!user.avatar && avatar)) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: user.googleId || googleId,
                  avatar: user.avatar || avatar,
                },
              });
            }

          } else {
            user = await prisma.user.create({
              data: {
                email,
                name,
                avatar,
                googleId,
                role: Role.EMPLOYEE,
                isActive: true,
              },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user || !user.isActive) {
        return done(null, null);
      }

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

export default configureGoogleAuth;
