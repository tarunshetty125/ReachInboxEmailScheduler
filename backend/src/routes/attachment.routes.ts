import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const attachmentRouter = Router();

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_REQUEST = 5;
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES, files: MAX_ATTACHMENTS_PER_REQUEST },
});

const publicAttachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

attachmentRouter.post('/', requireAuth, mediaUpload.array('files', MAX_ATTACHMENTS_PER_REQUEST), async (req, res, next) => {
  try {
    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'Attach at least one file.' });
      return;
    }

    const attachments = await prisma.$transaction(
      files.map((file) => prisma.attachment.create({
        data: {
          userId: req.user!.id,
          fileName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          size: file.size,
          // Copy into a plain Uint8Array for Prisma's PostgreSQL Bytes type.
          data: Uint8Array.from(file.buffer),
        },
        select: publicAttachmentSelect,
      })),
    );
    res.status(201).json({ attachments });
  } catch (error) {
    next(error);
  }
});

attachmentRouter.get('/:id/download', requireAuth, async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const attachment = await prisma.attachment.findFirst({
      where: { id, userId: req.user!.id },
      select: { fileName: true, mimeType: true, data: true },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    const isMedia = attachment.mimeType.startsWith('image/') || attachment.mimeType.startsWith('video/');
    const inline = req.query.disposition === 'inline' && isMedia;
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${attachment.fileName.replace(/[\\"\\r\\n]/g, '_')}"`);
    res.send(Buffer.from(attachment.data));
  } catch (error) {
    next(error);
  }
});

attachmentRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const attachment = await prisma.attachment.findFirst({
      where: { id, userId: req.user!.id },
      select: { id: true, _count: { select: { emails: true } } },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    if (attachment._count.emails > 0) {
      res.status(409).json({ error: 'An attachment already scheduled for delivery cannot be removed.' });
      return;
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
