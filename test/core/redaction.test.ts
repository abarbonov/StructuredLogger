import { describe, expect, it } from 'vitest';
import { createLogger, redactLogRecord, serializeError } from '../../src/index.js';
import { syntheticSecret, syntheticToken } from '../fixtures/secrets.js';

describe('redaction coverage', () => {
  it('masks sensitive nested values, headers, URL query values, errors, and cycles', () => {
    const cycle: Record<string, unknown> = { token: syntheticToken };
    cycle.self = cycle;
    const cause = new Error(`cause ${syntheticSecret}`);
    const error = Object.assign(new Error(`message ${syntheticSecret}`), { cause });
    const record = redactLogRecord(
      {
        context: {},
        data: {
          accounts: [{ iban: syntheticSecret }],
          cycle,
          headers: { authorization: `Bearer ${syntheticToken}` },
          nested: { password: syntheticSecret },
          url: `https://example.test/collect?token=${syntheticToken}&page=1`
        },
        error: serializeError(error),
        id: 'record-1',
        level: 'error',
        logger: {},
        message: 'failed',
        timestamp: 0
      },
      {
        rules: [{ path: 'data.accounts.*.iban', strategy: 'remove' }]
      }
    );

    const serialized = JSON.stringify(record);

    expect(serialized).not.toContain(syntheticSecret);
    expect(serialized).not.toContain(syntheticToken);
    expect(record.data).toMatchObject({
      cycle: { self: '********', token: '********' },
      headers: { authorization: '********' },
      nested: { password: '********' }
    });
    expect(record.data?.url).toContain('token=********');
    expect(record.data?.url).toContain('page=1');
    expect(record.error?.message).toBe('********');
    expect(record.error?.stack).toBe('********');
    expect(record.error?.cause?.message).toBe('********');
  });

  it('applies safe fallbacks for long values and failing custom transforms', () => {
    const record = redactLogRecord(
      {
        context: {},
        data: { long: 'abcdefgh', unsafe: syntheticSecret },
        id: 'record-1',
        level: 'info',
        logger: {},
        message: 'processed',
        timestamp: 0
      },
      {
        maxStringLength: 4,
        rules: [
          {
            path: 'data.unsafe',
            strategy: 'custom',
            transform: () => {
              throw new Error('transform failed');
            }
          }
        ]
      }
    );

    expect(record.data).toEqual({ long: 'abcd...', unsafe: '********' });
  });

  it('masks non-allowlisted leaves while preserving explicitly allowed data', () => {
    const record = redactLogRecord(
      {
        context: {},
        data: { private: syntheticSecret, public: 'visible' },
        id: 'record-1',
        level: 'info',
        logger: {},
        message: 'processed',
        timestamp: 0
      },
      { allowedPaths: ['data.public'], mode: 'allowlist' }
    );

    expect(record.data).toEqual({ private: '********', public: 'visible' });
  });

  it('passes only redacted records and sanitized diagnostics to consumers', async () => {
    const records: unknown[] = [];
    const diagnostics: unknown[] = [];
    const logger = createLogger({
      delivery: 'await',
      exporters: [
        (record) => {
          records.push(record);
          throw new Error(syntheticSecret);
        }
      ],
      onExporterError: (event) => diagnostics.push(event)
    });

    await logger.info('request', { token: syntheticToken });

    expect(JSON.stringify(records)).not.toContain(syntheticToken);
    expect(JSON.stringify(diagnostics)).not.toContain(syntheticSecret);
    expect(JSON.stringify(diagnostics)).not.toContain(syntheticToken);
  });
});
