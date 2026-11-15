import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { UpdatePermissionsSchema } from '../schemas.js';
import { PrivacyService } from '../services/privacy.service.js';
import { config } from '../config.js';

export function createPermissionRouter(db: DatabaseSync): Router {
  const router = Router();

  const getUserId = (req: Request): string => {
    return (
      (req.headers['x-user-id'] as string) ||
      (req.query.user_id as string) ||
      config.defaultUserId
    );
  };

  // GET /permissions
  router.get('/permissions', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const perms = PrivacyService.getPermissions(db, userId);
    return res.status(200).json({
      user_id: userId,
      permissions: perms
    });
  });

  // PUT /permissions & PATCH /permissions
  const handleUpdate = (req: Request, res: Response) => {
    const userId = getUserId(req);

    // Support nested { permissions: { ... } } or flat { location: false }
    const payload = (req.body && typeof req.body.permissions === 'object')
      ? req.body.permissions
      : req.body;

    const validation = UpdatePermissionsSchema.safeParse(payload);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({
        error: 'ValidationError',
        detail: errors.join(', '),
        errors: validation.error.errors
      });
    }

    const updated = PrivacyService.updatePermissions(db, userId, validation.data);
    return res.status(200).json({
      message: 'Permissions updated successfully',
      user_id: userId,
      permissions: updated
    });
  };

  router.put('/permissions', handleUpdate);
  router.patch('/permissions', handleUpdate);

  return router;
}
