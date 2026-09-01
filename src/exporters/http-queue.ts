import type { LogRecord } from '../types/record.js';

export interface HttpQueueItem {
  record: LogRecord;
  reject: () => void;
  resolve: () => void;
}

export interface HttpQueue {
  enqueue: (record: LogRecord) => { delivery: Promise<void>; dropped?: HttpQueueItem };
  isEmpty: () => boolean;
  rejectAll: () => void;
  size: () => number;
  take: (limit: number) => HttpQueueItem[];
}

const createQueueItem = (record: LogRecord) => {
  let rejectDelivery: (() => void) | undefined;
  let resolveDelivery: (() => void) | undefined;
  const delivery = new Promise<void>((resolve, reject) => {
    resolveDelivery = resolve;
    rejectDelivery = () => reject(new Error('HTTP logger delivery failed'));
  });

  if (resolveDelivery === undefined || rejectDelivery === undefined) {
    throw new Error('HTTP logger queue initialization failed');
  }

  return {
    delivery,
    record,
    reject: rejectDelivery,
    resolve: resolveDelivery
  };
};

export const createHttpQueue = (maxSize: number) => {
  const items: HttpQueueItem[] = [];

  return {
    enqueue: (record: LogRecord) => {
      const dropped = items.length >= maxSize ? items.shift() : undefined;
      const item = createQueueItem(record);
      items.push(item);

      return {
        delivery: item.delivery,
        ...(dropped === undefined ? {} : { dropped })
      };
    },
    isEmpty: () => items.length === 0,
    rejectAll: () => {
      const pending = items.splice(0, items.length);
      pending.forEach((item) => item.reject());
    },
    size: () => items.length,
    take: (limit: number) => items.splice(0, limit)
  };
};
