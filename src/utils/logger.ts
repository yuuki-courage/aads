export type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly minLevel: LogLevel = "info") {}

  private canLog(level: LogLevel): boolean {
    return levelWeight[level] >= levelWeight[this.minLevel];
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.canLog(level)) {
      return;
    }

    const ts = new Date().toISOString();
    const metaPart = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const line = `[${ts}] [${level.toUpperCase()}] ${message}${metaPart}`;

    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }
}
