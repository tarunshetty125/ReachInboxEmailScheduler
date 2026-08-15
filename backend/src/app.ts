import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import { config } from './config/index.js';
import { sessionMiddleware } from './config/session.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { attachmentRouter } from './routes/attachment.routes.js';
import { emailRouter } from './routes/email.routes.js';
import { senderRouter } from './routes/sender.routes.js';
import { userRouter } from './routes/user.routes.js';

configurePassport();

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '6mb' }));
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/attachments', attachmentRouter);
app.use('/api/senders', senderRouter);
app.use('/api/emails', emailRouter);
app.use(notFoundHandler);
app.use(errorHandler);
