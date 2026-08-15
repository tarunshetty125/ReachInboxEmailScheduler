import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { createSenderSchema, updateSenderHourlyLimitSchema } from '../validators/sender.validator.js';
import { config } from '../config/index.js';
import { createFreshEtherealAccount } from '../services/etherealAccount.js';

export const senderRouter = Router();

const publicSenderSelect = {
  id: true,
  email: true,
  aliasEmail: true,
  name: true,
  isDefault: true,
  hourlyLimit: true,
  createdAt: true,
} as const;

senderRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const senders = await prisma.sender.findMany({
      where: { userId: req.user!.id },
      select: publicSenderSelect,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(senders);
  } catch (error) {
    next(error);
  }
});

senderRouter.post('/', requireAuth, async (req, res, next) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const account = await createFreshEtherealAccount();
    const sender = await prisma.sender.create({
      data: {
        userId: req.user!.id,
        name: parsed.data.name,
        email: account.user,
        aliasEmail: parsed.data.aliasEmail,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
        hourlyLimit: config.defaultHourlyLimit,
      },
      select: publicSenderSelect,
    });
    res.status(201).json(sender);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Cannot create a duplicate internal Ethereal sender email. Please try again.' });
      return;
    }
    next(error);
  }
});

senderRouter.patch('/:id/hourly-limit', requireAuth, async (req, res, next) => {
  const parsed = updateSenderHourlyLimitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await prisma.sender.updateMany({
      where: { id, userId: req.user!.id },
      data: { hourlyLimit: parsed.data.hourlyLimit },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }
    const sender = await prisma.sender.findUnique({ where: { id }, select: publicSenderSelect });
    res.json(sender);
  } catch (error) {
    next(error);
  }
});
