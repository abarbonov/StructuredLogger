import type { LogContext, LogData, SerializedError } from './record.js';

export type LogMethod = (message: string, data?: LogData | Error) => void | Promise<void>;

export interface StructuredLogger {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  child: (context: LogContext) => StructuredLogger;
  flush: () => Promise<void>;
  close: () => Promise<void>;
}

export type DeliveryMode = 'await' | 'background';

export type ExporterOperation = 'close' | 'export' | 'flush';

export interface ExporterErrorEvent {
  exporter: string;
  operation: ExporterOperation;
  error: SerializedError;
  recordId?: string;
}

export type ExporterErrorHandler = (event: ExporterErrorEvent) => void;
