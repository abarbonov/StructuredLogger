import { createLogger } from '@abarbonov/structured-logger';

const records = [];
const memoryExporter = {
  name: 'memory',
  export: (record) => {
    records.push(record);
  }
};

const logger = createLogger({
  delivery: 'await',
  exporters: [memoryExporter],
  redact: { keys: ['token'] }
});

await logger.info('request completed', {
  requestId: 'request-42',
  token: 'secret-token'
});
await logger.close();

console.log(JSON.stringify(records[0], null, 2));
