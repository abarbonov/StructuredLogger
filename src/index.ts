export { mergeLogContext, normalizeLogData } from './core/context.js';
export { createRecordId } from './core/id.js';
export { getLogLevelRank, isLogLevel, isLogLevelEnabled, LOG_LEVELS } from './core/levels.js';
export { createLogRecord } from './core/records.js';
export { detectRuntime, getRuntimeType } from './core/runtime.js';
export type { CreateLogRecordOptions } from './core/records.js';
export type {
  DeliveryMode,
  ExporterErrorEvent,
  ExporterErrorHandler,
  ExporterOperation,
  LogContext,
  LogData,
  LogExporter,
  LogExporterFunction,
  LogExporterInput,
  LogLevel,
  LogMethod,
  LogRecord,
  LoggerOptions,
  RuntimeInfo,
  SerializedError,
  StructuredLogger,
  SupportedRuntime
} from './types/index.js';
