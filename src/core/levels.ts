import type { LogLevel } from '../types/record.js';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

const logLevelRanks: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

export const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel);

export const getLogLevelRank = (level: LogLevel) => logLevelRanks[level];

export const isLogLevelEnabled = (level: LogLevel, minimumLevel: LogLevel) =>
  getLogLevelRank(level) >= getLogLevelRank(minimumLevel);
