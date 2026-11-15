import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createEventRouter } from './routes/event.routes.js';
import { createPermissionRouter } from './routes/permission.routes.js';
import { createAuditRouter } from './routes/audit.routes.js';
import { createDocsRouter } from './routes/docs.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(db: DatabaseSync): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Static Assets (React UI)
  const publicPath = path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));
  app.use('/static', express.static(publicPath));

  // Serve Main Single Page Application
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // Mount API Routers
  app.use(createEventRouter(db));
  app.use(createPermissionRouter(db));
  app.use(createAuditRouter(db));
  app.use(createDocsRouter());

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'NotFound', detail: 'The requested endpoint or resource was not found.' });
  });

  // Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'BadRequest', detail: 'Invalid JSON payload' });
    }
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'InternalServerError', detail: 'An unexpected server error occurred.' });
  });

  return app;
}
