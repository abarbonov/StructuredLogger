import type { LogData } from '../types/record.js';

export const DEFAULT_REDACTION_MASK = '********';

export interface SanitizeOptions {
  circularValue?: string;
  maxArrayLength?: number;
  maxDepth?: number;
  maxStringLength?: number;
  replacement?: string;
}

const defaultOptions: Required<SanitizeOptions> = {
  circularValue: DEFAULT_REDACTION_MASK,
  maxArrayLength: 100,
  maxDepth: 10,
  maxStringLength: 10_000,
  replacement: DEFAULT_REDACTION_MASK
};

const isPlainObject = (value: object): value is LogData => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const limitString = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;

export const sanitizeValue = (value: unknown, options: SanitizeOptions = {}) => {
  const resolved = { ...defaultOptions, ...options };
  const seen = new WeakSet<object>();

  const sanitize = (current: unknown, depth: number): unknown => {
    if (typeof current === 'string') {
      return limitString(current, resolved.maxStringLength);
    }

    if (
      current === null ||
      typeof current === 'boolean' ||
      typeof current === 'number' ||
      typeof current === 'undefined'
    ) {
      return current;
    }

    if (typeof current === 'bigint') {
      return current.toString();
    }

    if (typeof current === 'symbol' || typeof current === 'function') {
      return resolved.replacement;
    }

    if (depth >= resolved.maxDepth || typeof current !== 'object') {
      return resolved.replacement;
    }

    if (seen.has(current)) {
      return resolved.circularValue;
    }

    seen.add(current);

    try {
      if (current instanceof Date) {
        return Number.isNaN(current.valueOf()) ? resolved.replacement : current.toISOString();
      }

      if (Array.isArray(current)) {
        return current.slice(0, resolved.maxArrayLength).map((item) => sanitize(item, depth + 1));
      }

      if (!isPlainObject(current)) {
        return resolved.replacement;
      }

      const result: LogData = {};

      for (const key of Object.keys(current)) {
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          Object.defineProperty(result, key, {
            configurable: true,
            enumerable: true,
            value: sanitize(current[key], depth + 1),
            writable: true
          });
        }
      }

      return result;
    } catch {
      return resolved.replacement;
    } finally {
      seen.delete(current);
    }
  };

  return sanitize(value, 0);
};
