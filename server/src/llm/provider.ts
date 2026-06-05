/**
 * Provider-agnostic LLM contract.
 *
 * The rest of the app depends only on this interface, never on the Anthropic
 * SDK directly. Swapping providers (or stubbing in tests) is a one-file change.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateReplyParams {
  /** Full system prompt (persona + knowledge + guardrails). */
  systemPrompt: string;
  /** Prior conversation turns, oldest first, already capped to a sane length. */
  history: ChatTurn[];
  /** The new user message to respond to. */
  userMessage: string;
}

export interface GenerateReplyResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Events emitted while streaming a reply:
 *   - `delta` carries the next chunk of generated text,
 *   - `done` arrives once, last, with the full text and token accounting.
 */
export type ReplyStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; inputTokens?: number; outputTokens?: number };

export interface LLMProvider {
  generateReply(params: GenerateReplyParams): Promise<GenerateReplyResult>;

  /**
   * Same inputs as `generateReply`, but yields the reply incrementally.
   * Implementations must emit exactly one terminal `done` event carrying the
   * fully-accumulated text, and translate provider failures into `LLMError`.
   */
  generateReplyStream(
    params: GenerateReplyParams,
  ): AsyncGenerator<ReplyStreamEvent>;
}
