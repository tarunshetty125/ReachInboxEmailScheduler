import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Each attachment must be 25MB or smaller.' : 'Too many attachments were uploaded.';
    res.status(400).json({ error: message });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
};
