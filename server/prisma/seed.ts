/**
 * Optional seed: inserts one demo conversation so the schema and the
 * /history endpoint are verifiable immediately after setup.
 *
 * NOTE: the agent's *domain knowledge* (shipping/returns/hours) is NOT seeded
 * here — it lives in src/knowledge/faq.ts and is injected into the system
 * prompt. This seed only demonstrates message persistence.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const conversation = await prisma.conversation.create({
    data: {
      channel: 'livechat',
      metadata: { source: 'seed' },
      messages: {
        create: [
          { sender: 'user', text: 'Hi! Do you ship to the USA?' },
          {
            sender: 'ai',
            text:
              'Yes — we ship to the USA in about 7–14 business days. ' +
              'Shipping is calculated at checkout. Anything else I can help with?',
          },
        ],
      },
    },
    include: { messages: true },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seeded conversation ${conversation.id} with ${conversation.messages.length} messages.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
