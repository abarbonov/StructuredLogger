import type { LogExporterInput } from './exporter.js';
import type { DeliveryMode, ExporterErrorHandler } from './logger.js';
import type { LogContext, LogLevel, RuntimeInfo } from './record.js';

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
