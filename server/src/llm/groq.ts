import Groq from 'groq-sdk';
import { config } from '../config.js';
import { LLMError } from '../lib/errors.js';
import type {
  GenerateReplyParams,
  GenerateReplyResult,
  LLMProvider,
  ReplyStreamEvent,
} from './provider.js';

/**
 * Groq-backed implementation of LLMProvider.
 *
 * Groq's API is OpenAI-compatible (chat/completions), so the system prompt is
 * passed as the first `system` message rather than a top-level field.
 *
 * Responsibilities kept here (and nowhere else):
 *   - shaping our generic ChatTurn[] into the chat-completions format,
 *   - enforcing a hard request timeout,
 *   - translating provider-specific failures into a friendly LLMError.
 */
export class GroqProvider implements LLMProvider {
  private readonly client: Groq;

  constructor() {
    this.client = new Groq({ apiKey: config.groq.apiKey });
  }

  /** Shape our generic turns into Groq's chat-completions message array. */
  private buildMessages(
    params: GenerateReplyParams,
  ): Groq.Chat.ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: params.systemPrompt },
      ...params.history.map((turn) => ({
        role: turn.role, // 'user' | 'assistant' — same vocabulary as Groq
        content: turn.content,
      })),
      { role: 'user' as const, content: params.userMessage },
    ];
  }

  async generateReply(
    params: GenerateReplyParams,
  ): Promise<GenerateReplyResult> {
    const messages = this.buildMessages(params);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: config.groq.model,
          max_tokens: config.groq.maxTokens,
          messages,
        },
        // Per-request timeout. The SDK aborts and throws on expiry.
        { timeout: config.groq.timeoutMs },
      );

      const text = (response.choices[0]?.message?.content ?? '').trim();

      if (!text) {
        throw new LLMError(
          'Groq returned an empty response.',
          "Sorry, I couldn't generate a reply just now. Please try again.",
        );
      }

      return {
        text,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };
    } catch (err) {
      throw mapGroqError(err);
    }
  }

  async *generateReplyStream(
    params: GenerateReplyParams,
  ): AsyncGenerator<ReplyStreamEvent> {
    const messages = this.buildMessages(params);

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: config.groq.model,
          max_tokens: config.groq.maxTokens,
          messages,
          stream: true,
        },
        { timeout: config.groq.timeoutMs },
      );

      // Token usage isn't exposed on the streamed chunks in this SDK version,
      // so streamed replies are persisted without token accounting.
      let text = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          text += delta;
          yield { type: 'delta', text: delta };
        }
      }

      text = text.trim();
      if (!text) {
        throw new LLMError(
          'Groq returned an empty streamed response.',
          "Sorry, I couldn't generate a reply just now. Please try again.",
        );
      }

      yield { type: 'done', text };
    } catch (err) {
      throw mapGroqError(err);
    }
  }
}

/**
 * Map SDK errors to a single LLMError with a user-safe message.
 * The internal `message` keeps detail for logs; `userMessage` is what the
 * customer sees.
 */
function mapGroqError(err: unknown): LLMError {
  // Already mapped (e.g. the empty-response case above).
  if (err instanceof LLMError) return err;

  if (err instanceof Groq.AuthenticationError) {
    return new LLMError(
      `Groq auth failed: ${err.message}`,
      "Sorry, I'm having trouble connecting right now. Please try again shortly.",
    );
  }
  if (err instanceof Groq.RateLimitError) {
    return new LLMError(
      `Groq rate limited: ${err.message}`,
      "We're getting a lot of messages right now. Please try again in a moment.",
    );
  }
  if (err instanceof Groq.APIConnectionTimeoutError) {
    return new LLMError(
      `Groq request timed out: ${err.message}`,
      'That took longer than expected. Please try sending your message again.',
    );
  }
  if (err instanceof Groq.APIConnectionError) {
    return new LLMError(
      `Groq connection error: ${err.message}`,
      "I couldn't reach the assistant service. Please try again shortly.",
    );
  }
  if (err instanceof Groq.APIError) {
    return new LLMError(
      `Groq API error (${err.status ?? 'unknown'}): ${err.message}`,
      'Sorry, something went wrong on our end. Please try again shortly.',
    );
  }

  return new LLMError(
    `Unexpected LLM error: ${err instanceof Error ? err.message : String(err)}`,
    'Sorry, something went wrong. Please try again shortly.',
  );
}
