import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { GroqProvider } from './llm/groq.js';
import { registerChatRoutes } from './routes/chat.js';
import { ChatService } from './services/chatService.js';

/**
 * Build and wire the Fastify app. Composition root: this is where concrete
 * implementations (Anthropic, the service) are constructed and injected.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true } },
    },
    // Reject absurdly large bodies before they reach a handler.
    bodyLimit: 256 * 1024, // 256 KB
  });

  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  });

  // Dependency wiring.
  const llm = new GroqProvider();
  const chatService = new ChatService(llm);

  app.get('/health', async () => ({ status: 'ok' }));

  registerChatRoutes(app, chatService);

  // Single place that turns any thrown error into a clean JSON response.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      // Expected, handled errors: log at info, surface the friendly message.
      request.log.info(
        { code: error.code, detail: error.message },
        'handled app error',
      );
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.userMessage,
      });
    }

    // Fastify body-parse / schema errors arrive with a statusCode of 400.
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: 'bad_request',
        message: 'Invalid request.',
      });
    }

    // Anything else is unexpected: log loudly, never leak internals.
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  });

  return app;
}
