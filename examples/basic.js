import { consoleLogExporter, createLogger } from '@abarbonov/structured-logger';

const logger = createLogger({
  context: { service: 'checkout' },
  exporters: [consoleLogExporter({ format: 'json' })],
  name: 'payments'
});

logger.info('payment authorized', { orderId: 'order-42' });
logger.warn('payment review required', { orderId: 'order-43' });

await logger.close();
