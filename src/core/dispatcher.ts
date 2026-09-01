import { isLogLevelEnabled } from './levels.js';
import type { LogExporterInput } from '../types/exporter.js';
import type { ExporterErrorHandler } from '../types/logger.js';
import type { LogLevel, LogRecord, SerializedError } from '../types/record.js';

export interface ResolvedExporter {
  close?: () => void | Promise<void>;
  export: (record: LogRecord) => void | Promise<void>;
  flush?: () => void | Promise<void>;
  level?: LogLevel;
  name: string;
}

const createFallbackExporterError = (): SerializedError => ({
  name: 'Error',
  message: '********'
});

const getExporterName = (exporter: LogExporterInput) => {
  if (typeof exporter === 'function') {
    return exporter.name || 'anonymous';
  }

  return typeof exporter.name === 'string' && exporter.name.length > 0
    ? exporter.name
    : 'anonymous';
};

export const normalizeExporter = (exporter: LogExporterInput): ResolvedExporter => {
  if (typeof exporter === 'function') {
    return {
      export: exporter,
      name: getExporterName(exporter)
    };
  }

  const close = exporter.close;
  const exportRecord = exporter.export;
  const flush = exporter.flush;

  return {
    close: close === undefined ? undefined : () => close.call(exporter),
    export: (record) => exportRecord.call(exporter, record),
    flush: flush === undefined ? undefined : () => flush.call(exporter),
    level: exporter.level,
    name: getExporterName(exporter)
  };
};

const reportExporterError = (
  handler: ExporterErrorHandler | undefined,
  exporter: ResolvedExporter,
  operation: 'close' | 'export' | 'flush',
  recordId?: string
) => {
  if (handler === undefined) {
    return;
  }

  try {
    Promise.resolve(
      handler({
        error: createFallbackExporterError(),
        exporter: exporter.name,
        operation,
        ...(recordId === undefined ? {} : { recordId })
      })
    ).catch(() => undefined);
  } catch {
    // no-op
  }
};

const runLifecycleOperation = async (
  exporters: readonly ResolvedExporter[],
  operation: 'close' | 'flush',
  onExporterError: ExporterErrorHandler | undefined
) => {
  const targets = exporters.filter((exporter) => exporter[operation] !== undefined);
  const results = await Promise.allSettled(
    targets.map((exporter) => Promise.resolve().then(() => exporter[operation]?.()))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      reportExporterError(onExporterError, targets[index], operation);
    }
  });
};

export const dispatchRecord = async (
  record: LogRecord,
  exporters: readonly ResolvedExporter[],
  onExporterError: ExporterErrorHandler | undefined
) => {
  const targets = exporters.filter(
    (exporter) => exporter.level === undefined || isLogLevelEnabled(record.level, exporter.level)
  );
  const results = await Promise.allSettled(
    targets.map((exporter) => Promise.resolve().then(() => exporter.export(record)))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      reportExporterError(onExporterError, targets[index], 'export', record.id);
    }
  });
};

export const flushExporters = (
  exporters: readonly ResolvedExporter[],
  onExporterError: ExporterErrorHandler | undefined
) => runLifecycleOperation(exporters, 'flush', onExporterError);

export const closeExporters = (
  exporters: readonly ResolvedExporter[],
  onExporterError: ExporterErrorHandler | undefined
) => runLifecycleOperation(exporters, 'close', onExporterError);
