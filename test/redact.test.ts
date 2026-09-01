import { describe, expect, it } from 'vitest';
import { redactLogRecord, serializeError } from '../src/index.js';

describe('redactLogRecord', () => {
  it('masks serialized error details before custom rules are applied', () => {
    const secret = 'do-not-leak';
    const cause = new Error(`cause: ${secret}`);
    const error = Object.assign(new Error(`failed: ${secret}`), { cause });
    const record = redactLogRecord(
      {
        context: {},
        error: serializeError(error),
        id: 'id',
        level: 'error',
        logger: {},
        message: 'failed',
        timestamp: 0
      },
      {
        rules: [
          {
            path: 'error.message',
            strategy: 'custom',
            transform: () => secret
          }
        ]
      }
    );

    expect(JSON.stringify(record)).not.toContain(secret);
  });
});
