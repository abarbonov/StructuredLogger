import type { LogContext, LogData } from '../types/record.js';

const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);

export const isPlainData = (value: unknown): value is LogData => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const copySafeProperties = (source: LogData): LogData => {
  const result: LogData = {};

  for (const key of Object.keys(source)) {
    if (!unsafeKeys.has(key)) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: source[key],
        writable: true
      });
    }
  }

  return result;
};

export const normalizeLogData = (value: unknown): LogData | undefined =>
  isPlainData(value) ? copySafeProperties(value) : undefined;

export const mergeLogContext = (parent: LogContext = {}, child: LogContext = {}): LogContext => {
  const normalizedParent = normalizeLogData(parent) ?? {};
  const normalizedChild = normalizeLogData(child) ?? {};

  return {
    ...normalizedParent,
    ...normalizedChild
  };
};
