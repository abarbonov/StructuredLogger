export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogData = Record<string, unknown>;

export type LogContext = Record<string, unknown>;

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError;
  [key: string]: unknown;
}

export interface RuntimeInfo {
  type: 'browser' | 'electron' | 'node' | 'react-native';
  version?: string;
}

export interface LogRecord {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  logger: {
    name?: string;
  };
  data?: LogData;
  error?: SerializedError;
  context: LogContext;
  runtime?: RuntimeInfo;
  traceId?: string;
}
