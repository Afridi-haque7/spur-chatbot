import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

/**
 * Process entry point: build the app, start listening, and wire up graceful
 * shutdown so we close the HTTP server and DB pool cleanly on exit.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err, 'failed to start server');
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
