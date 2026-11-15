import { z } from 'zod';
import { VALID_EVENT_TYPES } from './types.js';

export const CreateEventSchema = z.object({
  type: z.enum(VALID_EVENT_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: `Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` })
  }),
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title cannot exceed 255 characters'),
  content: z.string().trim().min(1, 'Content is required'),
  timestamp: z.string().optional().refine((val) => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, { message: 'Timestamp must be a valid ISO 8601 date string' }),
  user_id: z.string().optional()
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdatePermissionsSchema = z.object({
  conversation: z.boolean().optional(),
  location: z.boolean().optional(),
  physiological: z.boolean().optional(),
  note: z.boolean().optional()
}).refine((data) => {
  return Object.values(data).some(v => v !== undefined);
}, { message: 'At least one valid permission category must be provided' });

export type UpdatePermissionsInput = z.infer<typeof UpdatePermissionsSchema>;
