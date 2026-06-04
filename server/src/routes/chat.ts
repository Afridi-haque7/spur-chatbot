import type { FastifyInstance } from 'fastify';
import type { Message } from '@prisma/client';
import type { ChatService } from '../services/chatService.js';
import { parseChatMessage, parseSessionId } from '../lib/validation.js';

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

  // GET /chat/:sessionId/history  -> { sessionId, messages: [...] }
  app.get('/chat/:sessionId/history', async (request) => {
    const { sessionId: raw } = request.params as { sessionId: string };
    const sessionId = parseSessionId(raw);
    const messages = await chatService.getHistory(sessionId);
    return { sessionId, messages: messages.map(toApiMessage) };
  });
}
