import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralised, validated configuration.
 *
 * Env vars are parsed once at startup. If anything required is missing or
 * malformed we fail loudly here rather than getting a confusing crash deep
 * inside a request later.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(512),
  LLM_HISTORY_LIMIT: z.coerce.number().int().positive().default(12),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

  MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(4000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Flatten into a readable list so misconfiguration is obvious.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  corsOrigin: parsed.data.CORS_ORIGIN.split(',').map((s) => s.trim()),
  databaseUrl: parsed.data.DATABASE_URL,
  groq: {
    apiKey: parsed.data.GROQ_API_KEY,
    model: parsed.data.GROQ_MODEL,
    maxTokens: parsed.data.LLM_MAX_TOKENS,
    timeoutMs: parsed.data.LLM_TIMEOUT_MS,
  },
  llm: {
    historyLimit: parsed.data.LLM_HISTORY_LIMIT,
  },
  limits: {
    maxMessageLength: parsed.data.MAX_MESSAGE_LENGTH,
  },
} as const;
