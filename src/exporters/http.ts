import { createHttpQueue } from './http-queue.js';
import { isLogLevel } from '../core/levels.js';
import type {
  HttpDeliveryErrorEvent,
  HttpFetch,
  HttpLogExporterOptions
} from '../types/options.js';
import type { LogRecord } from '../types/record.js';

const defaultBatchSize = 10;
const defaultFlushInterval = 1_000;
const defaultMaxQueueSize = 1_000;
const defaultTimeout = 5_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isPositiveInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isStringRecord = (value: unknown): value is Readonly<Record<string, string>> => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    return Object.values(value).every((item) => typeof item === 'string');
  } catch {
    return false;
  }
};

const isHttpEndpoint = (value: unknown) => {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isHttpLogExporterOptions = (value: unknown): value is HttpLogExporterOptions => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    return (
      isHttpEndpoint(value.endpoint) &&
      (value.batchSize === undefined || isPositiveInteger(value.batchSize)) &&
      (value.fetch === undefined || typeof value.fetch === 'function') &&
      (value.flushInterval === undefined || isNonNegativeInteger(value.flushInterval)) &&
      (value.headers === undefined || isStringRecord(value.headers)) &&
      (value.level === undefined || isLogLevel(value.level)) &&
      (value.maxQueueSize === undefined || isPositiveInteger(value.maxQueueSize)) &&
      (value.onDeliveryError === undefined || typeof value.onDeliveryError === 'function') &&
      (value.timeout === undefined || isNonNegativeInteger(value.timeout))
    );
  } catch {
    return false;
  }
};

const getEndpointOrigin = (endpoint: string) => new URL(endpoint).origin;

const getStatusClass = (status: number) => `${Math.floor(status / 100)}xx`;

const getGlobalFetch = () => (globalThis as typeof globalThis & { fetch?: HttpFetch }).fetch;

const reportDeliveryError = (
  handler: HttpLogExporterOptions['onDeliveryError'],
  event: HttpDeliveryErrorEvent
) => {
  if (handler === undefined) {
    return;
  }

  try {
    handler(event);
  } catch {
    // no-op
  }
};

export const httpLogExporter = (options: HttpLogExporterOptions) => {
  if (!isHttpLogExporterOptions(options)) {
    throw new Error('Invalid HTTP logger exporter options');
  }

  const fetch = options.fetch === undefined ? getGlobalFetch() : options.fetch;

  if (typeof fetch !== 'function') {
    throw new Error('Invalid HTTP logger exporter options');
  }

  const batchSize = options.batchSize ?? defaultBatchSize;
  const endpoint = options.endpoint;
  const endpointOrigin = getEndpointOrigin(endpoint);
  const flushInterval = options.flushInterval ?? defaultFlushInterval;
  const headers = {
    'content-type': 'application/json',
    ...(options.headers ?? {})
  };
  const queue = createHttpQueue(options.maxQueueSize ?? defaultMaxQueueSize);
  const timeout = options.timeout ?? defaultTimeout;
  let closed = false;
  let flushPromise: Promise<void> | undefined;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const report = (
    operation: HttpDeliveryErrorEvent['operation'],
    batchCount: number,
    status?: number
  ) =>
    reportDeliveryError(options.onDeliveryError, {
      batchSize: batchCount,
      endpoint: endpointOrigin,
      exporter: 'http',
      operation,
      queueSize: queue.size(),
      ...(status === undefined ? {} : { statusClass: getStatusClass(status) })
    });

  const clearFlushTimer = () => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
  };

  const sendBatch = async (records: readonly unknown[], count: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(endpoint, {
        body: JSON.stringify(records),
        headers,
        method: 'POST',
        signal: controller.signal
      });

      if (!response.ok) {
        report('flush', count, response.status);
        return false;
      }

      return true;
    } catch {
      report('flush', count);
      return false;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  };

  const scheduleFlush = () => {
    if (flushTimer !== undefined || closed || queue.isEmpty()) {
      return;
    }

    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, flushInterval);
  };

  const flush = () => {
    if (flushPromise !== undefined) {
      return flushPromise;
    }

    clearFlushTimer();
    const operation = (async () => {
      while (!queue.isEmpty()) {
        const batch = queue.take(batchSize);
        const delivered = await sendBatch(
          batch.map((item) => item.record),
          batch.length
        );

        if (delivered) {
          batch.forEach((item) => item.resolve());
        } else {
          batch.forEach((item) => item.reject());
        }
      }
    })();
    flushPromise = operation;
    void operation.finally(() => {
      if (flushPromise === operation) {
        flushPromise = undefined;
      }
    });

    return operation;
  };

  return {
    close: async () => {
      closed = true;
      clearFlushTimer();
      await flush();
      queue.rejectAll();
    },
    export: (record: LogRecord) => {
      if (closed) {
        return Promise.reject(new Error('HTTP logger exporter is closed'));
      }

      const { delivery, dropped } = queue.enqueue(record);

      if (dropped !== undefined) {
        dropped.reject();
        report('enqueue', 1);
      }

      if (queue.size() >= batchSize) {
        void flush();
      } else {
        scheduleFlush();
      }

      return delivery;
    },
    flush,
    level: options.level,
    name: 'http'
  };
};
