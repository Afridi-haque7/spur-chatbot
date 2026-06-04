/**
 * Typed application errors.
 *
 * Routes catch these and translate them into clean HTTP responses, so the
 * service/LLM layers can throw meaningful errors without knowing about HTTP.
 */

export class AppError extends Error {
  constructor(
    message: string,
    /** HTTP status to surface to the client. */
    public readonly statusCode: number,
    /** Stable machine-readable code for the frontend. */
    public readonly code: string,
    /** Safe, friendly message to show the end user. */
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Bad client input (empty message, too long, malformed sessionId, ...). */
export class ValidationError extends AppError {
  constructor(message: string, userMessage = message) {
    super(message, 400, 'validation_error', userMessage);
  }
}

/** A referenced conversation does not exist. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'not_found', 'That conversation could not be found.');
  }
}

/**
 * The upstream LLM failed (timeout, rate limit, bad key, outage).
 * We map provider-specific failures to this with a friendly userMessage.
 */
export class LLMError extends AppError {
  constructor(message: string, userMessage: string) {
    super(message, 502, 'llm_error', userMessage);
  }
}
