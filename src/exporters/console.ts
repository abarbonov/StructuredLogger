import type { ConsoleLogExporterOptions, ConsoleLogWriter } from '../types/options.js';
import type { LogLevel, LogRecord } from '../types/record.js';
import { isLogLevel } from '../core/levels.js';

const levelColors: Record<LogLevel, string> = {
  trace: '\u001B[90m',
  debug: '\u001B[36m',
  info: '\u001B[32m',
  warn: '\u001B[33m',
  error: '\u001B[31m',
  fatal: '\u001B[31m'
};

const colorReset = '\u001B[0m';
const consoleMethods = ['debug', 'error', 'info', 'log', 'trace', 'warn'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isConsoleLogWriter = (value: unknown): value is ConsoleLogWriter => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    return (
      typeof value.log === 'function' &&
      consoleMethods.every(
        (method) => value[method] === undefined || typeof value[method] === 'function'
      )
    );
  } catch {
    return false;
  }
};

const isConsoleLogExporterOptions = (value: unknown): value is ConsoleLogExporterOptions => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    return (
      (value.colors === undefined || typeof value.colors === 'boolean') &&
      (value.console === undefined || isConsoleLogWriter(value.console)) &&
      (value.format === undefined || value.format === 'json' || value.format === 'pretty') &&
      (value.level === undefined || isLogLevel(value.level))
    );
  } catch {
    return false;
  }
};

const getRuntimeProcess = () =>
  (
    globalThis as typeof globalThis & {
      process?: { stdout?: { isTTY?: boolean } };
    }
  ).process;

const supportsAnsiColors = () => getRuntimeProcess()?.stdout?.isTTY === true;

const formatJson = (record: LogRecord) => JSON.stringify(record);

const formatPretty = (record: LogRecord, colors: boolean) => {
  const level = record.level.toUpperCase();
  const formattedLevel = colors ? `${levelColors[record.level]}${level}${colorReset}` : level;
  const loggerName = record.logger.name === undefined ? '' : ` [${record.logger.name}]`;
  const details = [
    Object.keys(record.context).length === 0
      ? undefined
      : `context=${JSON.stringify(record.context)}`,
    record.data === undefined ? undefined : `data=${JSON.stringify(record.data)}`,
    record.error === undefined ? undefined : `error=${JSON.stringify(record.error)}`
  ].filter((value): value is string => value !== undefined);

  return `${new Date(record.timestamp).toISOString()} ${formattedLevel}${loggerName} ${record.message}${
    details.length === 0 ? '' : ` ${details.join(' ')}`
  }`;
};

const getConsoleMethod = (writer: ConsoleLogWriter, level: LogLevel) => {
  const methods: Record<LogLevel, keyof ConsoleLogWriter> = {
    trace: 'trace',
    debug: 'debug',
    info: 'info',
    warn: 'warn',
    error: 'error',
    fatal: 'error'
  };

  return writer[methods[level]] ?? writer.log;
};

export const consoleLogExporter = (options: ConsoleLogExporterOptions = {}) => {
  if (!isConsoleLogExporterOptions(options)) {
    throw new Error('Invalid console exporter options');
  }

  const writer = options.console === undefined ? globalThis.console : options.console;

  if (!isConsoleLogWriter(writer)) {
    throw new Error('Invalid console exporter options');
  }

  const colors = options.colors === true && supportsAnsiColors();
  const format = options.format ?? 'pretty';

  return {
    export: (record: LogRecord) => {
      const method = getConsoleMethod(writer, record.level);
      method.call(writer, format === 'json' ? formatJson(record) : formatPretty(record, colors));
    },
    level: options.level,
    name: 'console'
  };
};
