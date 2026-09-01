import type { LogExporterInput } from './exporter.js';
import type { DeliveryMode, ExporterErrorHandler } from './logger.js';
import type { LogContext, LogLevel, RuntimeInfo } from './record.js';

export type ConsoleLogFormat = 'json' | 'pretty';

export interface ConsoleLogWriter {
  log: (message: string) => void;
  debug?: (message: string) => void;
  error?: (message: string) => void;
  info?: (message: string) => void;
  trace?: (message: string) => void;
  warn?: (message: string) => void;
}

export interface ConsoleLogExporterOptions {
  colors?: boolean;
  console?: ConsoleLogWriter;
  format?: ConsoleLogFormat;
  level?: LogLevel;
}

export interface HttpFetchRequest {
  body: string;
  headers: Readonly<Record<string, string>>;
  method: 'POST';
  signal: AbortSignal;
}

export interface HttpFetchResponse {
  ok: boolean;
  status: number;
}

export type HttpFetch = (endpoint: string, request: HttpFetchRequest) => Promise<HttpFetchResponse>;

export type HttpDeliveryOperation = 'enqueue' | 'flush';

export interface HttpDeliveryErrorEvent {
  batchSize: number;
  endpoint: string;
  exporter: 'http';
  operation: HttpDeliveryOperation;
  queueSize: number;
  statusClass?: string;
}

export type HttpDeliveryErrorHandler = (event: HttpDeliveryErrorEvent) => void;

export interface HttpLogExporterOptions {
  batchSize?: number;
  endpoint: string;
  fetch?: HttpFetch;
  flushInterval?: number;
  headers?: Readonly<Record<string, string>>;
  level?: LogLevel;
  maxQueueSize?: number;
  onDeliveryError?: HttpDeliveryErrorHandler;
  timeout?: number;
}

export type MaskStrategy = 'hash' | 'mask' | 'partial' | 'remove' | 'custom';

export type RedactionMode = 'allowlist' | 'denylist';

export type RedactionPreset = 'credentials' | 'financial-data' | 'personal-data' | 'secrets';

export interface PartialMaskOptions {
  visibleEnd?: number;
  visibleStart?: number;
}

export interface RedactionRule {
  path: string;
  strategy?: MaskStrategy;
  options?: PartialMaskOptions;
  transform?: (value: unknown) => unknown;
}

export interface RedactionUrlOptions {
  queryParams?: readonly string[];
}

export interface RedactionOptions {
  allowedPaths?: readonly string[];
  circularValue?: string;
  defaultMask?: string;
  headers?: readonly string[];
  keys?: readonly string[];
  maxArrayLength?: number;
  maxDepth?: number;
  maxStringLength?: number;
  mode?: RedactionMode;
  paths?: readonly string[];
  presets?: readonly RedactionPreset[];
  rules?: readonly RedactionRule[];
  url?: RedactionUrlOptions;
}

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  context?: LogContext;
  runtime?: RuntimeInfo;
  delivery?: DeliveryMode;
  exporters?: readonly LogExporterInput[];
  onExporterError?: ExporterErrorHandler;
  redact?: RedactionOptions;
}
