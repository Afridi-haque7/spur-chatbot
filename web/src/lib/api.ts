import { PUBLIC_API_BASE_URL } from '$env/static/public';
import type {
  ApiErrorResponse,
  HistoryResponse,
  SendMessageResponse,
} from './types';

const BASE_URL = PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/** Error carrying a user-safe message surfaced by the backend (or a fallback). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorResponse;
    return new ApiError(
      body.message ?? 'Something went wrong. Please try again.',
      body.error ?? 'unknown',
    );
  } catch {
    return new ApiError('Something went wrong. Please try again.', 'unknown');
  }
}

export const api = {
  /** Send a message; returns the AI reply + the (possibly new) sessionId. */
  async sendMessage(
    message: string,
    sessionId?: string,
  ): Promise<SendMessageResponse> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });
    } catch {
      // Network-level failure (server down, offline, CORS).
      throw new ApiError(
        "I couldn't reach the server. Check your connection and try again.",
        'network_error',
      );
    }

    if (!res.ok) throw await parseError(res);
    return (await res.json()) as SendMessageResponse;
  },

  /**
   * Send a message and stream the AI reply token-by-token.
   *
   * Resolves once the reply is fully streamed and persisted. Throws `ApiError`
   * on a network failure, a non-2xx response, or a server-sent `error` event —
   * so callers handle failures the same way as `sendMessage`.
   */
  async sendMessageStream(
    message: string,
    sessionId: string | undefined,
    handlers: {
      onMeta?: (sessionId: string) => void;
      onDelta?: (text: string) => void;
    },
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/chat/message/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });
    } catch {
      throw new ApiError(
        "I couldn't reach the server. Check your connection and try again.",
        'network_error',
      );
    }

    // A validation/early error comes back as a normal JSON response, not SSE.
    if (!res.ok || !res.body) throw await parseError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // SSE frames are separated by a blank line; parse them as they arrive.
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const { event, data } = parseSseFrame(frame);
        if (!event) continue;

        if (event === 'meta') {
          handlers.onMeta?.(data.sessionId as string);
        } else if (event === 'delta') {
          handlers.onDelta?.(data.text as string);
        } else if (event === 'error') {
          throw new ApiError(
            (data.message as string) ??
              'Something went wrong. Please try again.',
            (data.error as string) ?? 'unknown',
          );
        } else if (event === 'done') {
          return;
        }
      }
    }
  },

  /** Fetch full history for a session to render on reload. */
  async getHistory(sessionId: string): Promise<HistoryResponse> {
    const res = await fetch(
      `${BASE_URL}/chat/${encodeURIComponent(sessionId)}/history`,
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as HistoryResponse;
  },
};

/** Parse one SSE frame ("event: x\ndata: {...}") into its event name + data. */
function parseSseFrame(frame: string): {
  event: string | null;
  data: Record<string, unknown>;
} {
  let event: string | null = null;
  let dataRaw = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataRaw += line.slice(5).trim();
  }
  let data: Record<string, unknown> = {};
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw) as Record<string, unknown>;
    } catch {
      // Ignore malformed data payloads; treat as an empty object.
    }
  }
  return { event, data };
}
