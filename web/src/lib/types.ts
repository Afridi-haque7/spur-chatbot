export type Sender = 'user' | 'ai' | 'system';

export interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
}

/** A message that's been sent but not yet confirmed/answered by the server. */
export interface PendingMessage {
  id: string;
  sender: 'user';
  text: string;
  pending: true;
}

export interface SendMessageResponse {
  reply: string;
  sessionId: string;
}

export interface HistoryResponse {
  sessionId: string;
  messages: ChatMessage[];
}

export interface ApiErrorResponse {
  error: string;
  message: string;
}
