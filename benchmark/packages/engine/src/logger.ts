export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: Record<string, unknown>;
}

/**
 * Structured logger for the benchmark engine.
 * Writes JSON lines to stderr (stdout is reserved for results).
 */
export class BenchmarkLogger {
  private enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  info(event: string, context?: Record<string, unknown>): void {
    this.log('info', event, context);
  }

  warn(event: string, context?: Record<string, unknown>): void {
    this.log('warn', event, context);
  }

  error(event: string, context?: Record<string, unknown>): void {
    this.log('error', event, context);
  }

  debug(event: string, context?: Record<string, unknown>): void {
    this.log('debug', event, context);
  }

  private log(level: LogLevel, event: string, context?: Record<string, unknown>): void {
    if (!this.enabled) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      context,
    };
    console.error(JSON.stringify(entry));
  }
}
