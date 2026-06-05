import type { Channel, Message } from '@prisma/client';
import { config } from '../config.js';
import { NotFoundError } from '../lib/errors.js';
import { buildSystemPrompt } from '../llm/prompt.js';
import type { ChatTurn, LLMProvider } from '../llm/provider.js';
import { conversationRepository } from '../repositories/conversationRepository.js';
import { messageRepository } from '../repositories/messageRepository.js';

export interface IncomingMessage {
  /** The channel this message arrived on. Defaults to live chat. */
  channel?: Channel;
  /** Channel-specific identifier (e.g. WhatsApp number). Null for web. */
  externalId?: string | null;
  /** Existing conversation id, if continuing one. */
  sessionId?: string;
  /** The user's message text (already validated/trimmed upstream). */
  text: string;
  /** Optional per-conversation metadata, stored on first message. */
  metadata?: Record<string, unknown> | null;
}

export interface ChatReply {
  reply: string;
  sessionId: string;
}

/**
 * Events emitted while streaming a reply to a caller (e.g. the SSE route):
 *   - `meta`  once, first — carries the resolved sessionId,
 *   - `delta` zero or more times — the next chunk of the AI reply,
 *   - `done`  once, last — the persisted AI message id.
 * LLM failures are thrown (not emitted) so callers handle them in one place;
 * by then `meta` has already been sent, so the client keeps its sessionId.
 */
export type ChatStreamEvent =
  | { type: 'meta'; sessionId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; sessionId: string };

/**
 * The core of the product: turns an incoming message (from ANY channel) into a
 * persisted exchange with an AI reply. The live-chat HTTP route is just one
 * adapter that calls into this; a WhatsApp/Instagram webhook would be another.
 *
 * The LLM provider is injected, so this is trivially unit-testable with a stub.
 */
export class ChatService {
  constructor(private readonly llm: LLMProvider) {}

  async handleIncomingMessage(input: IncomingMessage): Promise<ChatReply> {
    const conversation = await this.resolveConversation(input);

    // 1. Read prior context BEFORE inserting the new message, so history and
    //    the new userMessage stay cleanly separated (no duplication).
    const priorMessages = await messageRepository.listRecent(
      conversation.id,
      config.llm.historyLimit,
    );
    const history = toChatTurns(priorMessages);

    // 2. Persist the user message first, so it survives an LLM failure.
    await messageRepository.create({
      conversationId: conversation.id,
      sender: 'user',
      text: input.text,
    });

    // 3. Generate the reply. Errors here propagate as LLMError and are mapped
    //    to a friendly response by the route — the user message stays saved.
    const result = await this.llm.generateReply({
      systemPrompt: buildSystemPrompt(),
      history,
      userMessage: input.text,
    });

    // 4. Persist the AI reply (with token accounting when available).
    await messageRepository.create({
      conversationId: conversation.id,
      sender: 'ai',
      text: result.text,
      tokenCount: result.outputTokens ?? null,
    });

    await conversationRepository.touch(conversation.id);

    return { reply: result.text, sessionId: conversation.id };
  }

  /**
   * Streaming counterpart of `handleIncomingMessage`. Same persistence
   * guarantees — the user message is saved before generation, and the AI reply
   * is saved once fully streamed — but the reply is yielded incrementally.
   */
  async *streamIncomingMessage(
    input: IncomingMessage,
  ): AsyncGenerator<ChatStreamEvent> {
    const conversation = await this.resolveConversation(input);

    // Read prior context BEFORE inserting the new message (see non-stream path).
    const priorMessages = await messageRepository.listRecent(
      conversation.id,
      config.llm.historyLimit,
    );
    const history = toChatTurns(priorMessages);

    // Persist the user message first, so it survives an LLM failure.
    await messageRepository.create({
      conversationId: conversation.id,
      sender: 'user',
      text: input.text,
    });

    // Emit sessionId immediately: even if generation fails below, the client
    // has the id and can keep the conversation.
    yield { type: 'meta', sessionId: conversation.id };

    let fullText = '';
    let outputTokens: number | undefined;
    for await (const event of this.llm.generateReplyStream({
      systemPrompt: buildSystemPrompt(),
      history,
      userMessage: input.text,
    })) {
      if (event.type === 'delta') {
        fullText += event.text;
        yield { type: 'delta', text: event.text };
      } else {
        fullText = event.text; // authoritative, trimmed full text
        outputTokens = event.outputTokens;
      }
    }

    // Persist the completed AI reply (mirrors the non-stream path).
    const aiMessage = await messageRepository.create({
      conversationId: conversation.id,
      sender: 'ai',
      text: fullText,
      tokenCount: outputTokens ?? null,
    });

    await conversationRepository.touch(conversation.id);

    yield { type: 'done', messageId: aiMessage.id, sessionId: conversation.id };
  }

  /** Fetch a conversation's full message history for rendering on reload. */
  async getHistory(sessionId: string): Promise<Message[]> {
    const conversation = await conversationRepository.findById(sessionId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${sessionId} not found.`);
    }
    return messageRepository.listByConversation(sessionId);
  }

  private async resolveConversation(input: IncomingMessage) {
    if (input.sessionId) {
      const existing = await conversationRepository.findById(input.sessionId);
      if (!existing) {
        throw new NotFoundError(`Conversation ${input.sessionId} not found.`);
      }
      return existing;
    }
    return conversationRepository.create({
      channel: input.channel ?? 'livechat',
      externalId: input.externalId ?? null,
      metadata: input.metadata ?? null,
    });
  }
}

/** Map persisted messages to provider-neutral chat turns, dropping system rows. */
function toChatTurns(messages: Message[]): ChatTurn[] {
  return messages
    .filter((m) => m.sender !== 'system')
    .map((m) => ({
      role: m.sender === 'ai' ? ('assistant' as const) : ('user' as const),
      content: m.text,
    }));
}
