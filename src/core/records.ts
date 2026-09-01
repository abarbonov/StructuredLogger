import { mergeLogContext, normalizeLogData } from './context.js';
import { createRecordId } from './id.js';
import type {
  LogContext,
  LogData,
  LogLevel,
  LogRecord,
  RuntimeInfo,
  SerializedError
} from '../types/record.js';

export interface CreateLogRecordOptions {
  level: LogLevel;
  message: string;
  loggerName?: string;
  data?: LogData;
  error?: SerializedError;
  context?: LogContext;
  runtime?: RuntimeInfo;
  traceId?: string;
  id?: string;
  timestamp?: number;
}

export const createLogRecord = (options: CreateLogRecordOptions) => {
  const record: LogRecord = {
    id: options.id ?? createRecordId(),
    timestamp: options.timestamp ?? Date.now(),
    level: options.level,
    message: options.message,
    logger: options.loggerName === undefined ? {} : { name: options.loggerName },
    context: mergeLogContext({}, options.context)
  };

  const data = normalizeLogData(options.data);

  if (data !== undefined) {
    record.data = data;
  }

  if (options.error !== undefined) {
    record.error = options.error;
  }

  if (options.runtime !== undefined) {
    record.runtime = options.runtime;
  }

  if (options.traceId !== undefined) {
    record.traceId = options.traceId;
  }

  return record;
};
