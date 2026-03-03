type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel =
  (process.env.HIVE_LOG_LEVEL as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: LogLevel, scope: string, message: string, data?: unknown): string {
  const base = `${timestamp()} [${level.toUpperCase()}] [${scope}] ${message}`;
  if (data !== undefined) {
    try {
      return `${base} ${JSON.stringify(data)}`;
    } catch {
      return `${base} [unserializable]`;
    }
  }
  return base;
}

export function createLogger(scope: string) {
  return {
    debug(msg: string, data?: unknown) {
      if (shouldLog("debug")) console.debug(format("debug", scope, msg, data));
    },
    info(msg: string, data?: unknown) {
      if (shouldLog("info")) console.log(format("info", scope, msg, data));
    },
    warn(msg: string, data?: unknown) {
      if (shouldLog("warn")) console.warn(format("warn", scope, msg, data));
    },
    error(msg: string, data?: unknown) {
      if (shouldLog("error")) console.error(format("error", scope, msg, data));
    },
  };
}
