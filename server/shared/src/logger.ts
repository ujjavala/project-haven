export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  service: string;
  correlationId?: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(
  level: LogLevel,
  service: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    message,
    service,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // Structured JSON output for log aggregation
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export function createLogger(service: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      log('debug', service, message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      log('info', service, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log('warn', service, message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      log('error', service, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
