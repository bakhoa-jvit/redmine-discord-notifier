export interface LogContext {
  [key: string]: unknown;
}

const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof levels;

export class Logger {
  constructor(private readonly level: Level = "info") {}

  debug(message: string, context: LogContext = {}): void {
    this.write("debug", message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.write("warn", message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.write("error", message, context);
  }

  private write(level: Level, message: string, context: LogContext): void {
    if (levels[level] < levels[this.level]) {
      return;
    }
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    const line = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}
