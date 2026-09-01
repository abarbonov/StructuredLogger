import { describe, expect, it } from 'vitest';
import { consoleLogExporter } from '../src/index.js';

const consoleLogExporterWithUnknownOptions = consoleLogExporter as (options: unknown) => unknown;

describe('consoleLogExporter', () => {
  it.each([
    null,
    { colors: 'yes' },
    { console: null },
    { console: { log: 1 } },
    { console: { warn: () => undefined } },
    { format: 'text' },
    { level: 'verbose' }
  ])('rejects invalid JavaScript options %o', (options) => {
    expect(() => consoleLogExporterWithUnknownOptions(options)).toThrow(
      'Invalid console exporter options'
    );
  });

  it('uses the required log method when the level method is unavailable', () => {
    const messages: string[] = [];
    const exporter = consoleLogExporter({
      console: {
        log: (message) => messages.push(message)
      }
    });

    exporter.export({
      context: {},
      id: 'record-1',
      level: 'info',
      logger: {},
      message: 'fallback',
      timestamp: 0
    });

    expect(messages).toEqual(['1970-01-01T00:00:00.000Z INFO fallback']);
  });
});
