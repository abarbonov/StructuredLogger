export type SupportedRuntime = 'browser' | 'electron' | 'node' | 'react-native';

export type {
  LogContext,
  LogData,
  LogLevel,
  LogRecord,
  RuntimeInfo,
  SerializedError
} from './record.js';
export type { LogExporter, LogExporterFunction, LogExporterInput } from './exporter.js';
export type {
  DeliveryMode,
  ExporterErrorEvent,
  ExporterErrorHandler,
  ExporterOperation,
  LogMethod,
  StructuredLogger
} from './logger.js';
export type { LoggerOptions } from './options.js';
