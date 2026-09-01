import { closeExporters, flushExporters, type ResolvedExporter } from './dispatcher.js';
import type { ExporterErrorHandler } from '../types/logger.js';

export interface LoggerLifecycle {
  close: () => Promise<void>;
  flush: () => Promise<void>;
  isClosed: () => boolean;
  trackDelivery: (delivery: Promise<void>) => void;
}

export const createLoggerLifecycle = (
  exporters: readonly ResolvedExporter[],
  onExporterError: ExporterErrorHandler | undefined
) => {
  let closed = false;
  let closePromise: Promise<void> | undefined;
  let flushPromise: Promise<void> | undefined;
  const pendingDeliveries = new Set<Promise<void>>();

  const trackDelivery = (delivery: Promise<void>) => {
    pendingDeliveries.add(delivery);
    void delivery.then(
      () => pendingDeliveries.delete(delivery),
      () => pendingDeliveries.delete(delivery)
    );
  };

  const startFlush = () => {
    if (flushPromise !== undefined) {
      return flushPromise;
    }

    const operation = flushExporters(exporters, onExporterError);
    flushPromise = operation;
    void operation.then(
      () => {
        if (flushPromise === operation) {
          flushPromise = undefined;
        }
      },
      () => {
        if (flushPromise === operation) {
          flushPromise = undefined;
        }
      }
    );

    return operation;
  };

  const flush = () => {
    if (closePromise !== undefined) {
      return closePromise;
    }

    return startFlush();
  };

  const close = () => {
    if (closePromise !== undefined) {
      return closePromise;
    }

    closed = true;
    closePromise = (async () => {
      await Promise.allSettled([...pendingDeliveries]);
      await startFlush();
      await closeExporters(exporters, onExporterError);
    })();

    return closePromise;
  };

  return {
    close,
    flush,
    isClosed: () => closed,
    trackDelivery
  };
};
