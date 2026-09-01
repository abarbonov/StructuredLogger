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
export type {
  ConsoleLogExporterOptions,
  ConsoleLogFormat,
  ConsoleLogWriter,
  HttpDeliveryErrorEvent,
  HttpDeliveryErrorHandler,
  HttpDeliveryOperation,
  HttpFetch,
  HttpFetchRequest,
  HttpFetchResponse,
  HttpLogExporterOptions,
  LoggerOptions,
  MaskStrategy,
  PartialMaskOptions,
  RedactionMode,
  RedactionOptions,
  RedactionPreset,
  RedactionRule,
  RedactionUrlOptions
} from './options.js';
