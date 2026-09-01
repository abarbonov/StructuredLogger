import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/index.js';

const createLoggerWithInvalidOptions = createLogger as (options: unknown) => unknown;

describe('createLogger', () => {
  it('rejects sparse exporter arrays during configuration', () => {
    expect(() => createLoggerWithInvalidOptions({ exporters: new Array(1) })).toThrow(
      'Invalid logger exporter'
    );
  });

  it.each([
    [{ name: 123 }, 'Invalid logger name'],
    [{ redact: { keys: 1 } }, 'Invalid logger redaction options'],
    [{ redact: { keys: new Array(1) } }, 'Invalid logger redaction options'],
    [{ runtime: { type: 'unsupported' } }, 'Invalid logger runtime'],
    [{ onExporterError: 'invalid' }, 'Invalid logger error handler']
  ])('rejects invalid JavaScript configuration %o', (options, message) => {
    expect(() => createLoggerWithInvalidOptions(options)).toThrow(message);
  });
});
