import { isLogLevelEnabled } from './levels.js';
import type { LogExporterInput } from '../types/exporter.js';
import type { ExporterErrorHandler } from '../types/logger.js';
import type { LogLevel, LogRecord, SerializedError } from '../types/record.js';

export interface ResolvedExporter {
  export: (record: LogRecord) => void | Promise<void>;
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

  return {
    export: (record) => exporter.export(record),
    level: exporter.level,
    name: getExporterName(exporter)
  };
};

const reportExporterError = (
  handler: ExporterErrorHandler | undefined,
  exporter: ResolvedExporter,
  record: LogRecord
) => {
  if (handler === undefined) {
    return;
  }

  try {
    Promise.resolve(
      handler({
        error: createFallbackExporterError(),
        exporter: exporter.name,
        operation: 'export',
        recordId: record.id
      })
    ).catch(() => undefined);
  } catch {
    // no-op
  }
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
      reportExporterError(onExporterError, targets[index], record);
    }
  });
};
