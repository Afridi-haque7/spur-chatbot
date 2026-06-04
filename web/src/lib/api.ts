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

  /** Fetch full history for a session to render on reload. */
  async getHistory(sessionId: string): Promise<HistoryResponse> {
    const res = await fetch(
      `${BASE_URL}/chat/${encodeURIComponent(sessionId)}/history`,
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as HistoryResponse;
  },
};
