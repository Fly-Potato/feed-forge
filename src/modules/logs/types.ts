export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  message: string;
}

export interface LogEntry extends LogRecord {
  id: number;
}
