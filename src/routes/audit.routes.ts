import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AuditService } from '../services/audit.service.js';
import { config } from '../config.js';

export function createAuditRouter(db: DatabaseSync): Router {
  const router = Router();

  const getUserId = (req: Request): string => {
    return (
      (req.headers['x-user-id'] as string) ||
      (req.query.user_id as string) ||
      config.defaultUserId
    );
  };

  // GET /audit-log
  router.get('/audit-log', (req: Request, res: Response) => {
    const userId = getUserId(req);

    let page = 1;
    let limit = 50;

    if (req.query.page) {
      const parsed = parseInt(req.query.page as string, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'BadRequest', detail: "Parameter 'page' must be an integer" });
      }
      page = Math.max(1, parsed);
    }

    if (req.query.limit) {
      const parsed = parseInt(req.query.limit as string, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'BadRequest', detail: "Parameter 'limit' must be an integer" });
      }
      limit = Math.max(1, Math.min(parsed, 200));
    }

    const result = AuditService.getAuditLogs(db, userId, page, limit);
    return res.status(200).json(result);
  });

  // Rejection for any mutating method
  router.all('/audit-log', (req: Request, res: Response) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return res.status(405).json({
        error: 'MethodNotAllowed',
        detail: 'Audit logs are strictly read-only and immutable. Modifications are prohibited.'
      });
    }
    return res.status(405).end();
  });

  return router;
}
