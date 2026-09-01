import { DEFAULT_REDACTION_MASK, sanitizeValue, type SanitizeOptions } from './sanitize.js';
import type { SerializedError } from '../types/record.js';

export const serializeError = (value: unknown, options: SanitizeOptions = {}) => {
  const replacement = options.replacement ?? DEFAULT_REDACTION_MASK;
  const seen = new WeakSet<object>();

  const serialize = (error: unknown, depth: number) => {
    if (!(error instanceof Error) || depth >= (options.maxDepth ?? 10) || seen.has(error)) {
      return { name: 'Error', message: replacement };
    }

    seen.add(error);

    try {
      const result: SerializedError = {
        name: typeof error.name === 'string' ? error.name : 'Error',
        message:
          typeof error.message === 'string'
            ? (sanitizeValue(error.message, options) as string)
            : replacement
      };

      if (typeof error.stack === 'string') {
        result.stack = sanitizeValue(error.stack, options) as string;
      }

      const cause = (error as Error & { cause?: unknown }).cause;

      if (cause !== undefined) {
        result.cause = serialize(cause, depth + 1);
      }

      for (const key of Object.keys(error)) {
        if (
          key !== 'cause' &&
          key !== '__proto__' &&
          key !== 'constructor' &&
          key !== 'prototype'
        ) {
          const properties = error as unknown as Record<string, unknown>;
          const property = properties[key];
          result[key] =
            property instanceof Error
              ? serialize(property, depth + 1)
              : sanitizeValue(property, options);
        }
      }

      return result;
    } catch {
      return { name: 'Error', message: replacement };
    } finally {
      seen.delete(error);
    }
  };

  return serialize(value, 0);
};
