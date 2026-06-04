import type { Channel, Conversation, Prisma } from '@prisma/client';
import { prisma } from '../db.js';

/**
 * All conversation persistence lives here. Nothing above this layer writes SQL
 * or touches Prisma directly, so swapping the datastore stays contained.
 */
export const conversationRepository = {
  create(input: {
    channel?: Channel;
    externalId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Conversation> {
    return prisma.conversation.create({
      data: {
        channel: input.channel ?? 'livechat',
        externalId: input.externalId ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  },

  findById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({ where: { id } });
  },

  touch(id: string): Promise<Conversation> {
    // Bump updatedAt so "most recent conversations" ordering is meaningful.
    return prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  },
};
