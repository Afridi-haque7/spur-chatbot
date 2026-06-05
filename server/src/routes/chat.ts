import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { Message } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import type { ChatService } from '../services/chatService.js';
import { parseChatMessage, parseSessionId } from '../lib/validation.js';

/** Format a single Server-Sent Event frame. */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Serialise a DB message into the public API shape. */
function toApiMessage(m: Message) {
  return {
    id: m.id,
    sender: m.sender, // 'user' | 'ai' | 'system'
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * Chat routes. Thin transport layer: validate input, call the service,
 * serialise output. No business logic lives here.
 */
export function registerChatRoutes(
  app: FastifyInstance,
  chatService: ChatService,
): void {
  // POST /chat/message  -> { reply, sessionId }
  app.post('/chat/message', async (request) => {
    const { message, sessionId } = parseChatMessage(request.body);

    const result = await chatService.handleIncomingMessage({
      channel: 'livechat',
      sessionId,
      text: message,
      metadata: { userAgent: request.headers['user-agent'] ?? null },
    });

    return result; // { reply, sessionId }
  });

  // POST /chat/message/stream  -> Server-Sent Events:
  //   event: meta   data: { sessionId }
  //   event: delta  data: { text }          (repeated)
  //   event: done   data: { messageId, sessionId }
  //   event: error  data: { error, message } (instead of done, on failure)
  app.post('/chat/message/stream', async (request, reply) => {
    // Validation throws before any bytes are written, so a bad request still
    // gets a normal JSON 4xx via the global error handler.
    const { message, sessionId } = parseChatMessage(request.body);

    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache, no-transform');
    reply.header('Connection', 'keep-alive');
    // Disable proxy buffering (e.g. nginx on Render) so chunks flush live.
    reply.header('X-Accel-Buffering', 'no');

    async function* events() {
      try {
        for await (const event of chatService.streamIncomingMessage({
          channel: 'livechat',
          sessionId,
          text: message,
          metadata: { userAgent: request.headers['user-agent'] ?? null },
        })) {
          if (event.type === 'meta') yield sse('meta', { sessionId: event.sessionId });
          else if (event.type === 'delta') yield sse('delta', { text: event.text });
          else yield sse('done', { messageId: event.messageId, sessionId: event.sessionId });
        }
      } catch (err) {
        // Headers are already sent, so failures surface as an SSE `error`
        // event rather than an HTTP status. The user message stays persisted.
        request.log.error({ err }, 'stream generation failed');
        const code = err instanceof AppError ? err.code : 'internal_error';
        const userMessage =
          err instanceof AppError
            ? err.userMessage
            : 'Something went wrong. Please try again.';
        yield sse('error', { error: code, message: userMessage });
      }
    }

    return Readable.from(events());
  });

  // GET /chat/:sessionId/history  -> { sessionId, messages: [...] }
  app.get('/chat/:sessionId/history', async (request) => {
    const { sessionId: raw } = request.params as { sessionId: string };
    const sessionId = parseSessionId(raw);
    const messages = await chatService.getHistory(sessionId);
    return { sessionId, messages: messages.map(toApiMessage) };
  });
}
