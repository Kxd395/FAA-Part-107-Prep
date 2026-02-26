export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMetadata = Record<string, unknown>;

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
}

export type LogSink = (level: LogLevel, rendered: string) => void;

export interface LoggerOptions {
  context?: LogMetadata;
  minLevel?: LogLevel;
  sink?: LogSink;
}

const SERVICE_NAME = "part107-web";
const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const DEFAULT_MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function defaultSink(level: LogLevel, rendered: string): void {
  if (level === "error") {
    console.error(rendered);
    return;
  }
  if (level === "warn") {
    console.warn(rendered);
    return;
  }
  console.log(rendered);
}

function isSensitiveKey(key: string): boolean {
  return /pass(word)?|token|secret|authorization|cookie|api[-_]?key|session/i.test(key);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "[MAX_DEPTH]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${(value as Function).name || "anonymous"}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized: Record<string, unknown> = {};

    for (const [key, raw] of entries) {
      if (isSensitiveKey(key)) {
        sanitized[key] = REDACTED;
      } else {
        sanitized[key] = sanitizeValue(raw, depth + 1);
      }
    }

    return sanitized;
  }

  return value;
}

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

export function formatLogEntry(
  level: LogLevel,
  message: string,
  metadata: LogMetadata
): string {
  const sanitizedMetadata = sanitizeValue(metadata);
  const metadataObject =
    sanitizedMetadata && typeof sanitizedMetadata === "object" && !Array.isArray(sanitizedMetadata)
      ? (sanitizedMetadata as Record<string, unknown>)
      : { metadata: sanitizedMetadata };

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    level,
    message,
    ...metadataObject,
  });
}

export function createServerLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? defaultSink;
  const minLevel = options.minLevel ?? DEFAULT_MIN_LEVEL;
  const context = options.context ?? {};

  function emit(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    if (!shouldLog(level, minLevel)) {
      return;
    }

    sink(level, formatLogEntry(level, message, { ...context, ...metadata }));
  }

  return {
    debug: (message, metadata) => emit("debug", message, metadata),
    info: (message, metadata) => emit("info", message, metadata),
    warn: (message, metadata) => emit("warn", message, metadata),
    error: (message, metadata) => emit("error", message, metadata),
  };
}

export const serverLogger = createServerLogger();
