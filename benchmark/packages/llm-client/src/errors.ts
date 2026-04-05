/**
 * Structured API error with HTTP status code.
 * Thrown by AnthropicClient and OpenAIClient on HTTP failures.
 */
export class ApiError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly status: number,
    readonly body: string,
    readonly provider: string,
  ) {
    super(`${provider} API error ${status}: ${body}`);
    this.name = 'ApiError';
    this.retryable = RETRYABLE_STATUS_CODES.has(status);
  }
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529]);
