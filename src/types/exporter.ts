import type { LogLevel, LogRecord } from './record.js';

export interface LogExporter {
  name: string;
  level?: LogLevel;
  export: (record: LogRecord) => void | Promise<void>;
  flush?: () => void | Promise<void>;
  close?: () => void | Promise<void>;
}

export type LogExporterFunction = (record: LogRecord) => void | Promise<void>;

export type LogExporterInput = LogExporter | LogExporterFunction;
