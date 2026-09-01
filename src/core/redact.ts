import { sha256 as hashSha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { matchesRedactionPath } from './redact-paths.js';
import { DEFAULT_REDACTION_MASK, sanitizeValue } from './sanitize.js';
import type {
  MaskStrategy,
  PartialMaskOptions,
  RedactionOptions,
  RedactionPreset,
  RedactionRule
} from '../types/options.js';
import type { LogData, LogRecord } from '../types/record.js';

const removed = Symbol('removed');
const recordMetadataRoots = new Set(['id', 'timestamp', 'level', 'logger', 'runtime', 'traceId']);

const defaultSensitiveKeys = [
  'password',
  'passwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'clientsecret',
  'privatekey'
];

const presetKeys: Record<RedactionPreset, readonly string[]> = {
  credentials: ['authorization', 'cookie', 'password', 'username'],
  'financial-data': ['accountnumber', 'cardnumber', 'cvv', 'iban'],
  'personal-data': ['address', 'email', 'phone', 'ssn'],
  secrets: defaultSensitiveKeys
};

const defaultHeaderKeys = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key'
];

const defaultQueryParams = ['token', 'code', 'key', 'secret', 'signature'];

const stringifyForHash = (value: unknown) =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));

const sha256 = (value: string) => bytesToHex(hashSha256(new TextEncoder().encode(value)));

const partialMask = (value: unknown, options: PartialMaskOptions | undefined, mask: string) => {
  if (typeof value !== 'string') {
    return mask;
  }

  const visibleStart = Math.max(0, options?.visibleStart ?? 1);
  const visibleEnd = Math.max(0, options?.visibleEnd ?? 0);

  if (visibleStart + visibleEnd >= value.length) {
    return mask;
  }

  return `${value.slice(0, visibleStart)}${mask}${visibleEnd === 0 ? '' : value.slice(-visibleEnd)}`;
};

const redactUrl = (value: string, queryParams: ReadonlySet<string>, mask: string) => {
  try {
    const url = new URL(value);

    if (url.username.length > 0) {
      url.username = mask;
    }

    if (url.password.length > 0) {
      url.password = mask;
    }

    for (const key of new Set(url.searchParams.keys())) {
      if (queryParams.has(key.toLowerCase())) {
        url.searchParams.set(key, mask);
      }
    }

    return url.toString();
  } catch {
    return mask;
  }
};

interface ResolvedOptions {
  allowedPaths: readonly string[];
  circularValue: string;
  headerKeys: ReadonlySet<string>;
  keyNames: ReadonlySet<string>;
  mask: string;
  maxArrayLength: number;
  maxDepth: number;
  maxStringLength: number;
  mode: 'allowlist' | 'denylist';
  queryParams: ReadonlySet<string>;
  rules: readonly RedactionRule[];
}

const resolveOptions = (options: RedactionOptions) => {
  const presetValues = (options.presets ?? []).flatMap((preset) => presetKeys[preset]);

  return {
    allowedPaths: options.allowedPaths ?? [],
    circularValue: options.circularValue ?? DEFAULT_REDACTION_MASK,
    headerKeys: new Set(
      [...defaultHeaderKeys, ...(options.headers ?? [])].map((key) => key.toLowerCase())
    ),
    keyNames: new Set(
      [...defaultSensitiveKeys, ...presetValues, ...(options.keys ?? [])].map((key) =>
        key.toLowerCase()
      )
    ),
    mask: options.defaultMask ?? DEFAULT_REDACTION_MASK,
    maxArrayLength: options.maxArrayLength ?? 100,
    maxDepth: options.maxDepth ?? 10,
    maxStringLength: options.maxStringLength ?? 10_000,
    mode: options.mode ?? 'denylist',
    queryParams: new Set(
      [...defaultQueryParams, ...(options.url?.queryParams ?? [])].map((key) => key.toLowerCase())
    ),
    rules: [
      ...(options.rules ?? []),
      ...(options.paths ?? []).map((path): RedactionRule => ({ path, strategy: 'mask' }))
    ]
  } satisfies ResolvedOptions;
};

const applyStrategy = (value: unknown, rule: RedactionRule, mask: string) => {
  const strategy: MaskStrategy =
    rule.transform === undefined ? (rule.strategy ?? 'mask') : 'custom';

  try {
    if (strategy === 'remove') {
      return removed;
    }

    if (strategy === 'partial') {
      return partialMask(value, rule.options, mask);
    }

    if (strategy === 'hash') {
      return `sha256:${sha256(stringifyForHash(value))}`;
    }

    if (strategy === 'custom') {
      return rule.transform?.(value) ?? mask;
    }

    return mask;
  } catch {
    return mask;
  }
};

export const redactLogRecord = (record: LogRecord, options: RedactionOptions = {}) => {
  const resolved = resolveOptions(options);
  const sanitized = sanitizeValue(record, {
    circularValue: resolved.circularValue,
    maxArrayLength: resolved.maxArrayLength,
    maxDepth: resolved.maxDepth,
    maxStringLength: resolved.maxStringLength,
    replacement: resolved.mask
  }) as LogData;

  const redact = (
    value: unknown,
    path: readonly string[],
    isHeaderValue = false
  ): unknown | typeof removed => {
    const key = path.at(-1) ?? '';
    const lowercaseKey = key.toLowerCase();
    const matchingRule = resolved.rules.find((rule) => matchesRedactionPath(rule.path, path));
    const isAllowed = resolved.allowedPaths.some((pattern) => matchesRedactionPath(pattern, path));

    if (path[0] === 'error' && (lowercaseKey === 'message' || lowercaseKey === 'stack')) {
      return resolved.mask;
    }

    if (matchingRule !== undefined) {
      return applyStrategy(value, matchingRule, resolved.mask);
    }

    const isRecordMetadata = path.length > 0 && recordMetadataRoots.has(path[0]);

    if (
      resolved.mode === 'allowlist' &&
      !isAllowed &&
      !isRecordMetadata &&
      !Array.isArray(value) &&
      typeof value !== 'object'
    ) {
      return resolved.mask;
    }

    if (isHeaderValue || resolved.keyNames.has(lowercaseKey)) {
      return resolved.mask;
    }

    if (lowercaseKey === 'url' && typeof value === 'string') {
      return redactUrl(value, resolved.queryParams, resolved.mask);
    }

    if (Array.isArray(value)) {
      return value
        .map((item, index) => redact(item, [...path, String(index)], isHeaderValue))
        .filter((item) => item !== removed);
    }

    if (value !== null && typeof value === 'object') {
      const result: LogData = {};
      const parentIsHeaders = lowercaseKey === 'headers';

      for (const [childKey, childValue] of Object.entries(value)) {
        const childIsHeaderValue =
          parentIsHeaders && resolved.headerKeys.has(childKey.toLowerCase());
        const redacted = redact(childValue, [...path, childKey], childIsHeaderValue);

        if (redacted !== removed) {
          Object.defineProperty(result, childKey, {
            configurable: true,
            enumerable: true,
            value: redacted,
            writable: true
          });
        }
      }

      return result;
    }

    return value;
  };

  return redact(sanitized, []) as LogRecord;
};
