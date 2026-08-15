import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const userRouter = Router();

userRouter.get('/me', requireAuth, (req, res) => {
  const { id, email, name, avatarUrl } = req.user!;
  res.json({ id, email, name, avatarUrl });
});
