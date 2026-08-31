import type { LogExporterInput } from './exporter.js';
import type { DeliveryMode, ExporterErrorHandler } from './logger.js';
import type { LogContext, LogLevel, RuntimeInfo } from './record.js';

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  context?: LogContext;
  runtime?: RuntimeInfo;
  delivery?: DeliveryMode;
  exporters?: readonly LogExporterInput[];
  onExporterError?: ExporterErrorHandler;
}
