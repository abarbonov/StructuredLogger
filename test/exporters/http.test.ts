import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpLogExporter } from '../../src/http.js';
import { syntheticSecret } from '../fixtures/secrets.js';

const createRecord = (id: string) => ({
  context: {},
  id,
  level: 'info' as const,
  logger: {},
  message: `message-${id}`,
  timestamp: 0
});

afterEach(() => {
  vi.useRealTimers();
});

describe('httpLogExporter', () => {
  it('batches records and forwards caller headers as JSON POST requests', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 202 }));
    const exporter = httpLogExporter({
      batchSize: 2,
      endpoint: 'https://logs.example.test/ingest',
      fetch,
      headers: { 'x-request-id': 'request-1' }
    });

    await Promise.all([exporter.export(createRecord('one')), exporter.export(createRecord('two'))]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://logs.example.test/ingest');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      headers: { 'content-type': 'application/json', 'x-request-id': 'request-1' },
      method: 'POST'
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual([
      createRecord('one'),
      createRecord('two')
    ]);
  });

  it('rejects a failed batch and reports only safe diagnostic metadata', async () => {
    const diagnostics: unknown[] = [];
    const exporter = httpLogExporter({
      batchSize: 1,
      endpoint: `https://logs.example.test/ingest?token=${syntheticSecret}`,
      fetch: async () => ({ ok: false, status: 503 }),
      onDeliveryError: (event) => diagnostics.push(event)
    });

    await expect(exporter.export(createRecord('one'))).rejects.toThrow(
      'HTTP logger delivery failed'
    );

    expect(diagnostics).toEqual([
      {
        batchSize: 1,
        endpoint: 'https://logs.example.test',
        exporter: 'http',
        operation: 'flush',
        queueSize: 0,
        statusClass: '5xx'
      }
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain(syntheticSecret);
  });

  it('aborts timed out requests and rejects the pending delivery', async () => {
    vi.useFakeTimers();
    const diagnostics: unknown[] = [];
    const exporter = httpLogExporter({
      batchSize: 1,
      endpoint: 'https://logs.example.test/ingest',
      fetch: (_endpoint, request) =>
        new Promise((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      onDeliveryError: (event) => diagnostics.push(event),
      timeout: 10
    });
    const delivery = exporter.export(createRecord('one'));
    const outcome = delivery.then(
      () => 'resolved',
      () => 'rejected'
    );

    await vi.advanceTimersByTimeAsync(10);

    expect(await outcome).toBe('rejected');
    expect(diagnostics).toEqual([
      {
        batchSize: 1,
        endpoint: 'https://logs.example.test',
        exporter: 'http',
        operation: 'flush',
        queueSize: 0
      }
    ]);
  });

  it('drops the oldest queued record when the queue is full', async () => {
    vi.useFakeTimers();
    const diagnostics: unknown[] = [];
    const exporter = httpLogExporter({
      batchSize: 3,
      endpoint: 'https://logs.example.test/ingest',
      fetch: async () => ({ ok: true, status: 200 }),
      flushInterval: 1_000,
      maxQueueSize: 2,
      onDeliveryError: (event) => diagnostics.push(event)
    });
    const first = exporter.export(createRecord('one')).then(
      () => 'resolved',
      () => 'rejected'
    );
    const second = exporter.export(createRecord('two'));
    const third = exporter.export(createRecord('three'));

    await exporter.flush();

    expect(await Promise.all([first, second, third])).toEqual(['rejected', undefined, undefined]);
    expect(diagnostics).toEqual([
      {
        batchSize: 1,
        endpoint: 'https://logs.example.test',
        exporter: 'http',
        operation: 'enqueue',
        queueSize: 2
      }
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flushes pending delivery once during concurrent close calls and clears timers', async () => {
    vi.useFakeTimers();
    let resolveFetch: (() => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<{ ok: boolean; status: number }>((resolve) => {
          resolveFetch = () => resolve({ ok: true, status: 200 });
        })
    );
    const exporter = httpLogExporter({
      batchSize: 2,
      endpoint: 'https://logs.example.test/ingest',
      fetch,
      flushInterval: 1_000
    });
    const delivery = exporter.export(createRecord('one'));
    const firstClose = exporter.close();
    const secondClose = exporter.close();

    if (resolveFetch === undefined) {
      throw new Error('HTTP fetch was not invoked during close');
    }

    resolveFetch();
    await Promise.all([delivery, firstClose, secondClose]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(exporter.export(createRecord('two'))).rejects.toThrow(
      'HTTP logger exporter is closed'
    );
  });
});
