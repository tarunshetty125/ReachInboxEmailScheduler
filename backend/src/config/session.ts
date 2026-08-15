import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import pg from 'pg';
import { config } from './index.js';

export const sessionPool = new pg.Pool({ connectionString: config.databaseUrl });
const PgSessionStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSessionStore({
    pool: sessionPool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
  },
});
