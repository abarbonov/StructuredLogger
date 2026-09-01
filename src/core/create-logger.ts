import { isPlainData, mergeLogContext } from './context.js';
import { dispatchRecord, normalizeExporter, type ResolvedExporter } from './dispatcher.js';
import { isLogLevel, isLogLevelEnabled } from './levels.js';
import { redactLogRecord } from './redact.js';
import { createLogRecord } from './records.js';
import { serializeError } from './serialize-error.js';
import type { LogExporterInput } from '../types/exporter.js';
import type { ExporterErrorHandler, StructuredLogger } from '../types/logger.js';
import type {
  LoggerOptions,
  MaskStrategy,
  RedactionMode,
  RedactionOptions,
  RedactionPreset,
  RedactionRule
} from '../types/options.js';
import type { LogContext, LogData, LogLevel, RuntimeInfo } from '../types/record.js';

interface ResolvedLoggerOptions {
  context: LogContext;
  delivery: 'await' | 'background';
  exporters: readonly ResolvedExporter[];
  level: LogLevel;
  name?: string;
  onExporterError?: ExporterErrorHandler;
  redact: NonNullable<LoggerOptions['redact']>;
  runtime?: RuntimeInfo;
}

const isStringArray = (value: unknown): value is readonly string[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return Array.from(value).every((item) => typeof item === 'string');
};

const isNonNegativeInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string';

const isOptionalStringArray = (value: unknown) => value === undefined || isStringArray(value);

const isOptionalNonNegativeInteger = (value: unknown) =>
  value === undefined || isNonNegativeInteger(value);

const isRedactionPreset = (value: unknown): value is RedactionPreset =>
  value === 'credentials' ||
  value === 'financial-data' ||
  value === 'personal-data' ||
  value === 'secrets';

const isMaskStrategy = (value: unknown): value is MaskStrategy =>
  value === 'hash' ||
  value === 'mask' ||
  value === 'partial' ||
  value === 'remove' ||
  value === 'custom';

const isRedactionMode = (value: unknown): value is RedactionMode =>
  value === 'allowlist' || value === 'denylist';

const isRedactionRule = (value: unknown): value is RedactionRule => {
  if (!isPlainData(value) || typeof value.path !== 'string') {
    return false;
  }

  if (value.strategy !== undefined && !isMaskStrategy(value.strategy)) {
    return false;
  }

  if (value.transform !== undefined && typeof value.transform !== 'function') {
    return false;
  }

  if (value.options === undefined) {
    return true;
  }

  return (
    isPlainData(value.options) &&
    isOptionalNonNegativeInteger(value.options.visibleEnd) &&
    isOptionalNonNegativeInteger(value.options.visibleStart)
  );
};

const isRedactionPresetArray = (value: unknown): value is readonly RedactionPreset[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return Array.from(value).every(isRedactionPreset);
};

const isRedactionRuleArray = (value: unknown): value is readonly RedactionRule[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return Array.from(value).every(isRedactionRule);
};

const isRedactionOptions = (value: unknown): value is RedactionOptions => {
  if (!isPlainData(value)) {
    return false;
  }

  if (
    !isOptionalStringArray(value.allowedPaths) ||
    !isOptionalString(value.circularValue) ||
    !isOptionalString(value.defaultMask) ||
    !isOptionalStringArray(value.headers) ||
    !isOptionalStringArray(value.keys) ||
    !isOptionalNonNegativeInteger(value.maxArrayLength) ||
    !isOptionalNonNegativeInteger(value.maxDepth) ||
    !isOptionalNonNegativeInteger(value.maxStringLength) ||
    !isOptionalStringArray(value.paths)
  ) {
    return false;
  }

  if (value.mode !== undefined && !isRedactionMode(value.mode)) {
    return false;
  }

  if (value.presets !== undefined && !isRedactionPresetArray(value.presets)) {
    return false;
  }

  if (value.rules !== undefined && !isRedactionRuleArray(value.rules)) {
    return false;
  }

  return (
    value.url === undefined ||
    (isPlainData(value.url) && isOptionalStringArray(value.url.queryParams))
  );
};

const isRuntimeInfo = (value: unknown): value is RuntimeInfo =>
  isPlainData(value) &&
  (value.type === 'browser' ||
    value.type === 'electron' ||
    value.type === 'node' ||
    value.type === 'react-native') &&
  isOptionalString(value.version);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const isExporterInput = (value: unknown): value is LogExporterInput => {
  if (typeof value === 'function') {
    return true;
  }

  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.export === 'function' &&
    (value.level === undefined || isLogLevel(value.level)) &&
    (value.flush === undefined || typeof value.flush === 'function') &&
    (value.close === undefined || typeof value.close === 'function')
  );
};

const resolveExporters = (value: unknown): readonly ResolvedExporter[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Invalid logger exporter');
  }

  const exporters: ResolvedExporter[] = [];

  for (const exporter of value) {
    if (!isExporterInput(exporter)) {
      throw new Error('Invalid logger exporter');
    }

    exporters.push(normalizeExporter(exporter));
  }

  return exporters;
};

const resolveLoggerOptions = (options: LoggerOptions): ResolvedLoggerOptions => {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new Error('Invalid logger options');
  }

  const delivery = options.delivery === undefined ? 'background' : options.delivery;

  if (delivery !== 'await' && delivery !== 'background') {
    throw new Error('Invalid logger delivery mode');
  }

  const level = options.level === undefined ? 'info' : options.level;

  if (!isLogLevel(level)) {
    throw new Error('Invalid logger level');
  }

  if (options.name !== undefined && typeof options.name !== 'string') {
    throw new Error('Invalid logger name');
  }

  if (options.context !== undefined && !isPlainData(options.context)) {
    throw new Error('Invalid logger context');
  }

  if (options.runtime !== undefined && !isRuntimeInfo(options.runtime)) {
    throw new Error('Invalid logger runtime');
  }

  if (options.onExporterError !== undefined && typeof options.onExporterError !== 'function') {
    throw new Error('Invalid logger error handler');
  }

  const redact = options.redact === undefined ? {} : options.redact;

  if (!isRedactionOptions(redact)) {
    throw new Error('Invalid logger redaction options');
  }

  return {
    context: mergeLogContext({}, options.context),
    delivery,
    exporters: resolveExporters(options.exporters),
    level,
    name: options.name,
    onExporterError: options.onExporterError,
    redact,
    runtime: options.runtime
  };
};

const createLoggerFromOptions = (options: ResolvedLoggerOptions): StructuredLogger => {
  const log = (level: LogLevel, message: string, data?: LogData | Error) => {
    if (!isLogLevelEnabled(level, options.level)) {
      return;
    }

    const record = redactLogRecord(
      createLogRecord({
        context: options.context,
        data: data instanceof Error ? undefined : data,
        error: data instanceof Error ? serializeError(data) : undefined,
        level,
        loggerName: options.name,
        message,
        runtime: options.runtime
      }),
      options.redact
    );
    const delivery = dispatchRecord(record, options.exporters, options.onExporterError);

    if (options.delivery === 'await') {
      return delivery;
    }
  };

  return {
    child: (context) =>
      createLoggerFromOptions({
        ...options,
        context: mergeLogContext(options.context, context)
      }),
    close: () => Promise.resolve(),
    debug: (message, data) => log('debug', message, data),
    error: (message, data) => log('error', message, data),
    fatal: (message, data) => log('fatal', message, data),
    flush: () => Promise.resolve(),
    info: (message, data) => log('info', message, data),
    trace: (message, data) => log('trace', message, data),
    warn: (message, data) => log('warn', message, data)
  };
};

export const createLogger = (options: LoggerOptions = {}) =>
  createLoggerFromOptions(resolveLoggerOptions(options));
