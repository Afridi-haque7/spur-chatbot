/**
 * Domain knowledge for the fictional store the agent supports.
 *
 * Kept as structured data (not a raw string) so it's easy to:
 *   - extend with new topics,
 *   - later move into the DB or a retrieval/vector layer,
 *   - render or audit independently of the prompt.
 *
 * For a handful of FAQs, inlining this into the system prompt is the correct,
 * boring choice — no vector search needed at this scale.
 */

export interface StoreProfile {
  name: string;
  tagline: string;
}

export interface FaqEntry {
  topic: string;
  details: string;
}

export const storeProfile: StoreProfile = {
  name: 'Nimbus Goods',
  tagline: 'Small-batch home & desk essentials.',
};

export const faqs: FaqEntry[] = [
  {
    topic: 'Shipping',
    details:
      'We ship within India (2–5 business days) and to the USA, UK, Canada, and Australia (7–14 business days). ' +
      'Domestic orders over ₹1,499 ship free; international shipping is calculated at checkout. ' +
      'Orders placed before 2pm IST on a business day are dispatched the same day.',
  },
  {
    topic: 'Returns & refunds',
    details:
      'Unused items in original packaging can be returned within 30 days of delivery. ' +
      'Once we receive the item, refunds are issued to the original payment method within 5–7 business days. ' +
      'Sale items and gift cards are final sale. Return shipping is free for domestic orders.',
  },
  {
    topic: 'Order changes & cancellations',
    details:
      'You can change or cancel an order within 1 hour of placing it, before it is dispatched. ' +
      'After dispatch, treat it as a return once it arrives.',
  },
  {
    topic: 'Support hours',
    details:
      'Our human support team is available Monday–Saturday, 9am–7pm IST. ' +
      'Outside those hours this assistant can still help, and anything it can\u2019t resolve is escalated to a human the next business day.',
  },
  {
    topic: 'Payments',
    details:
      'We accept UPI, major credit/debit cards, net banking, and Razorpay wallets in India, ' +
      'and cards via Stripe internationally. We never store full card details.',
  },
];

/** Render the knowledge base as a compact text block for the system prompt. */
export function renderKnowledgeForPrompt(): string {
  const lines = faqs.map((f) => `- ${f.topic}: ${f.details}`);
  return [
    `Store: ${storeProfile.name} — ${storeProfile.tagline}`,
    '',
    'Store policies and facts:',
    ...lines,
  ].join('\n');
}
