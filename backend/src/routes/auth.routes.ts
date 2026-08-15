import { Router } from 'express';
import passport from 'passport';
import { config, isGoogleOAuthConfigured } from '../config/index.js';

export const authRouter = Router();

authRouter.get('/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    res.status(503).json({ error: 'Google OAuth is not configured on this server' });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

authRouter.get('/google/callback', (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    res.redirect(`${config.frontendUrl}/login?error=oauth-not-configured`);
    return;
  }
  passport.authenticate('google', {
    failureRedirect: `${config.frontendUrl}/login?error=oauth-failed`,
  })(req, res, (error?: unknown) => {
    if (error) return next(error);
    res.redirect(`${config.frontendUrl}/scheduled`);
  });
});

authRouter.post('/logout', (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out' });
    });
  });
});
