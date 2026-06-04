import type { Message, Sender } from '@prisma/client';
import { prisma } from '../db.js';

/**
 * Message persistence + history reads.
 */
export const messageRepository = {
  create(input: {
    conversationId: string;
    sender: Sender;
    text: string;
    tokenCount?: number | null;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        conversationId: input.conversationId,
        sender: input.sender,
        text: input.text,
        tokenCount: input.tokenCount ?? null,
      },
    });
  },

  /** Full history for a conversation, oldest first (used to render on reload). */
  listByConversation(conversationId: string): Promise<Message[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * The most recent `limit` messages, returned oldest-first.
   * Used to build bounded LLM context without loading an entire long chat.
   */
  async listRecent(conversationId: string, limit: number): Promise<Message[]> {
    const recent = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return recent.reverse();
  },
};
