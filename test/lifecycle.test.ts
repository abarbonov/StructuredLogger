import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/index.js';

describe('logger lifecycle', () => {
  it('waits for delivery, isolates lifecycle failures, and closes once', async () => {
    const events: string[] = [];
    const diagnostics: Array<{ error: { message: string }; operation: string }> = [];
    let resolveDelivery: (() => void) | undefined;
    const logger = createLogger({
      exporters: [
        {
          close: () => events.push('close'),
          export: () =>
            new Promise<void>((resolve) => {
              resolveDelivery = () => {
                events.push('delivery');
                resolve();
              };
            }),
          flush: () => events.push('flush'),
          name: 'slow'
        },
        {
          close: () => Promise.reject(new Error('do-not-leak')),
          export: () => undefined,
          flush: () => Promise.reject(new Error('do-not-leak')),
          name: 'broken'
        }
      ],
      onExporterError: (event) => diagnostics.push(event)
    });

    logger.info('before close');
    const firstClose = logger.close();
    const secondClose = logger.close();

    expect(secondClose).toBe(firstClose);

    await Promise.resolve();

    if (resolveDelivery === undefined) {
      throw new Error('Delivery was not scheduled');
    }

    resolveDelivery();
    await firstClose;

    logger.info('after close');
    logger.child({ source: 'child' }).info('after close');

    expect(events).toEqual(['delivery', 'flush', 'close']);
    expect(diagnostics.map((event) => event.operation)).toEqual(['flush', 'close']);
    expect(diagnostics.every((event) => event.error.message === '********')).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain('do-not-leak');
  });
});
