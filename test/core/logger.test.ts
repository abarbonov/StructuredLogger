import { describe, expect, it } from 'vitest';
import { createLogRecord, createLogger } from '../../src/index.js';
import { syntheticSecret } from '../fixtures/secrets.js';

describe('core logger behavior', () => {
  it('creates an immutable record with the expected public shape', () => {
    const context = { requestId: 'request-1' };
    const data = { attempt: 1 };
    const record = createLogRecord({
      context,
      data,
      id: 'record-1',
      level: 'info',
      loggerName: 'checkout',
      message: 'completed',
      runtime: { type: 'browser' },
      timestamp: 123
    });

    context.requestId = 'changed';
    data.attempt = 2;

    expect(record).toEqual({
      context: { requestId: 'request-1' },
      data: { attempt: 1 },
      id: 'record-1',
      level: 'info',
      logger: { name: 'checkout' },
      message: 'completed',
      runtime: { type: 'browser' },
      timestamp: 123
    });
  });

  it('uses child context overrides without mutating either input context', async () => {
    const records: Array<{ context: Record<string, unknown>; data?: Record<string, unknown> }> = [];
    const parentContext = { requestId: 'parent', service: 'checkout' };
    const childContext = { requestId: 'child', source: 'worker' };
    const data = { value: 'original' };
    const logger = createLogger({
      delivery: 'await',
      context: parentContext,
      exporters: [
        (record) => {
          records.push(record);
        }
      ]
    });

    await logger.child(childContext).info('processed', data);
    parentContext.service = 'changed';
    childContext.source = 'changed';
    data.value = 'changed';

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      context: { requestId: 'child', service: 'checkout', source: 'worker' },
      data: { value: 'original' }
    });
  });

  it('keeps background delivery non-blocking and await delivery observable', async () => {
    let resolveBackground: (() => void) | undefined;
    const background = createLogger({
      exporters: [
        {
          export: () =>
            new Promise<void>((resolve) => {
              resolveBackground = resolve;
            }),
          name: 'background'
        }
      ]
    });

    expect(background.info('queued')).toBeUndefined();
    await Promise.resolve();

    if (resolveBackground === undefined) {
      throw new Error('Background exporter was not invoked');
    }

    resolveBackground();
    await background.close();

    const delivered: string[] = [];
    const awaited = createLogger({
      delivery: 'await',
      exporters: [
        (record) => {
          delivered.push(record.message);
        }
      ]
    });
    const delivery = awaited.info('awaited');

    expect(delivery).toBeInstanceOf(Promise);
    await delivery;
    expect(delivered).toEqual(['awaited']);
  });

  it('filters exporters independently and reports failures without leaking their error', async () => {
    const received: string[] = [];
    const diagnostics: unknown[] = [];
    const logger = createLogger({
      delivery: 'await',
      exporters: [
        {
          export: () => Promise.reject(new Error(syntheticSecret)),
          name: 'broken'
        },
        {
          export: (record) => {
            received.push(record.message);
          },
          level: 'error',
          name: 'errors-only'
        },
        {
          export: (record) => {
            received.push(record.message);
          },
          name: 'healthy'
        }
      ],
      onExporterError: (event) => diagnostics.push(event)
    });

    await logger.info('info');
    await logger.error('error');

    expect(received).toEqual(['info', 'error', 'error']);
    expect(JSON.stringify(diagnostics)).not.toContain(syntheticSecret);
    expect(diagnostics).toHaveLength(2);
  });
});
