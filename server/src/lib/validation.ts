import { z } from 'zod';
import { config } from '../config.js';
import { ValidationError } from './errors.js';

/**
 * Request schema for POST /chat/message.
 *
 * Note the `.transform(trim)` + non-empty check: we treat whitespace-only
 * messages as empty so " \n " can't sneak past validation.
 */
export const chatMessageSchema = z.object({
  message: z
    .string({ required_error: 'message is required' })
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, 'Message cannot be empty.')
        .max(
          config.limits.maxMessageLength,
          `Message is too long (max ${config.limits.maxMessageLength} characters).`,
        ),
    ),
  // Optional: continues an existing conversation. Must look like a uuid if present.
  sessionId: z.string().uuid('sessionId must be a valid UUID.').optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/**
 * Parse + validate, converting zod failures into our ValidationError so the
 * route handler has a single error shape to deal with.
 */
export function parseChatMessage(body: unknown): ChatMessageInput {
  const result = chatMessageSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ValidationError(
      `Invalid chat message payload: ${first?.message ?? 'unknown error'}`,
      first?.message ?? 'Invalid request.',
    );
  }
  return result.data;
}

/** Validate a sessionId coming from a URL param (history fetch). */
export function parseSessionId(value: unknown): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid sessionId.', 'Invalid session.');
  }
  return result.data;
}
