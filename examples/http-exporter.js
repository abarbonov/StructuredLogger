import { createLogger } from '@abarbonov/structured-logger';
import { httpLogExporter } from '@abarbonov/structured-logger/http';

const requests = [];
const fetch = async (endpoint, request) => {
  requests.push({
    body: JSON.parse(request.body),
    endpoint,
    headers: request.headers
  });

  return { ok: true, status: 202 };
};

const exporter = httpLogExporter({
  batchSize: 2,
  endpoint: 'https://logs.example.test/ingest',
  fetch
});
const logger = createLogger({ delivery: 'await', exporters: [exporter] });

await Promise.all([
  logger.info('job started', { jobId: 'job-1' }),
  logger.info('job completed', { jobId: 'job-1' })
]);
await logger.close();

console.log(JSON.stringify(requests, null, 2));
