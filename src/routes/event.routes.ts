import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { CreateEventSchema } from '../schemas.js';
import { EventService, EventNotFoundError, PrivacyDeniedError } from '../services/event.service.js';
import { config } from '../config.js';

export function createEventRouter(db: DatabaseSync): Router {
  const router = Router();

  const getUserId = (req: Request): string => {
    return (
      (req.headers['x-user-id'] as string) ||
      (req.query.user_id as string) ||
      config.defaultUserId
    );
  };

  // GET /events
  router.get('/events', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const typeFilter = req.query.type as string | undefined;

    let page = 1;
    let limit = 10;

    if (req.query.limit) {
      const parsed = parseInt(req.query.limit as string, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'BadRequest', detail: "Parameter 'limit' must be an integer" });
      }
      limit = parsed;
    }

    if (req.query.offset) {
      const offset = parseInt(req.query.offset as string, 10);
      if (isNaN(offset)) {
        return res.status(400).json({ error: 'BadRequest', detail: "Parameter 'offset' must be an integer" });
      }
      page = Math.floor(offset / limit) + 1;
    } else if (req.query.page) {
      const parsed = parseInt(req.query.page as string, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'BadRequest', detail: "Parameter 'page' must be an integer" });
      }
      page = parsed;
    }

    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;

    try {
      const result = EventService.listEvents(db, userId, {
        typeFilter,
        page,
        limit,
        startDate,
        endDate
      });
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: 'BadRequest', detail: err.message });
    }
  });

  // GET /events/:id
  router.get('/events/:id', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const eventId = req.params.id;

    try {
      const event = EventService.getEventById(db, eventId, userId);
      return res.status(200).json(event);
    } catch (err: any) {
      if (err instanceof EventNotFoundError) {
        return res.status(404).json({ error: 'NotFound', detail: err.message });
      }
      if (err instanceof PrivacyDeniedError) {
        return res.status(403).json({
          error: 'Forbidden',
          detail: err.message,
          category: err.eventType,
          privacy_blocked: true
        });
      }
      return res.status(500).json({ error: 'InternalServerError', detail: 'Unexpected error' });
    }
  });

  // POST /events
  router.post('/events', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const validation = CreateEventSchema.safeParse(req.body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({
        error: 'ValidationError',
        detail: errors.join(', '),
        errors: validation.error.errors
      });
    }

    const effectiveUserId = validation.data.user_id || userId;
    const created = EventService.createEvent(db, validation.data, effectiveUserId);
    return res.status(201).json(created);
  });

  // DELETE /events/:id
  router.delete('/events/:id', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const eventId = req.params.id;

    try {
      EventService.deleteEvent(db, eventId, userId);
      return res.status(200).json({
        message: 'Event deleted successfully',
        id: eventId
      });
    } catch (err: any) {
      if (err instanceof EventNotFoundError) {
        return res.status(404).json({ error: 'NotFound', detail: err.message });
      }
      return res.status(500).json({ error: 'InternalServerError', detail: 'Unexpected error' });
    }
  });

  return router;
}
