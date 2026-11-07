import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './env';
import { ApiError } from './lib/errors';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import judgeRoutes from './routes/judge';
import publicRoutes from './routes/public';
import ratingRoutes from './routes/ratings';
import resultsRoutes from './routes/results';
import teamRoutes from './routes/team';

const app = new Hono<AppEnv>();

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  }),
);

app.use('/api/*', async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

// Short, shareable Android download link: /techarena.apk forwards to the current APK build.
app.get('/techarena.apk', (c) => {
  const target = c.env.APK_DOWNLOAD_URL?.trim();
  if (!target) return c.text('The Android app is not available yet.', 404);
  return c.redirect(target, 302);
});

app.route('/api', publicRoutes);
app.route('/api', authRoutes);
app.route('/api', resultsRoutes);
app.route('/api', ratingRoutes);
app.route('/api/team', teamRoutes);
app.route('/api/judge', judgeRoutes);
app.route('/api/admin', adminRoutes);

app.notFound((c) => {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: `No route for ${c.req.method} ${c.req.path}` } }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json(err.toBody(), err.status);
  console.error('Unhandled error', err);
  return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } }, 500);
});

export default app;
