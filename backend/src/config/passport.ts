import { Prisma, User } from '@prisma/client';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './prisma.js';
import { config, isGoogleOAuthConfigured } from './index.js';
import { createFreshEtherealAccount } from '../services/etherealAccount.js';

let configured = false;

async function createDefaultSender(user: User): Promise<void> {
  const defaultSender = await prisma.sender.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true },
  });
  if (defaultSender) return;

  const account = await createFreshEtherealAccount();
  try {
    await prisma.sender.create({
      data: {
        userId: user.id,
        name: user.name,
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
        isDefault: true,
        hourlyLimit: config.defaultHourlyLimit,
      },
    });
  } catch (error) {
    // A concurrent OAuth callback may have created the one permitted default
    // sender after the query above. Treat that case as successful repair.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }
}

export function configurePassport(): void {
  if (configured) return;
  configured = true;

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      done(null, await prisma.user.findUnique({ where: { id } }));
    } catch (error) {
      done(error);
    }
  });

  if (!isGoogleOAuthConfigured) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId!,
        clientSecret: config.googleClientSecret!,
        callbackURL: config.googleCallbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const primaryEmail = profile.emails?.[0]?.value;
          if (!primaryEmail) {
            done(new Error('Google did not provide an email address'));
            return;
          }

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              email: primaryEmail.toLowerCase(),
              name: profile.displayName || primaryEmail,
              avatarUrl: profile.photos?.[0]?.value,
            },
            update: {
              email: primaryEmail.toLowerCase(),
              name: profile.displayName || primaryEmail,
              avatarUrl: profile.photos?.[0]?.value,
            },
          });
          await createDefaultSender(user);
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
}
