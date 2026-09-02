# @abarbonov/structured-logger

> Cross-runtime structured logging with redaction before delivery.

`@abarbonov/structured-logger` creates consistent log records for Node.js, browsers,
Electron, and React Native. Records are normalized and redacted before any exporter sees
them, while delivery failures remain isolated in diagnostic callbacks.

## Features

- Six log levels, child loggers, context merging, and configurable delivery.
- Immutable redaction for data, errors, headers, and URL query parameters.
- Built-in JSON/pretty console exporter and a separate HTTP exporter.
- Bounded HTTP batching with timeout, `flush()`, `close()`, and safe diagnostics.
- Runtime-agnostic core without Node-only runtime imports.

## Installation

Requires Node.js `>=20.19.0` for package tooling.

```bash
npm install @abarbonov/structured-logger
```

## Quick Start

```ts
import { consoleLogExporter, createLogger } from '@abarbonov/structured-logger';

const logger = createLogger({
  context: { service: 'checkout' },
  exporters: [consoleLogExporter({ format: 'json' })],
  name: 'payments'
});

logger.info('payment authorized', { orderId: 'order-42' });
await logger.close();
```

By default, the logger uses `background` delivery: level methods do not wait for the
exporter. Before shutting down the process, call `await logger.close()`; it completes
known deliveries, runs `flush()`, and closes the exporters.

## Logger Configuration

```ts
import { createLogger } from '@abarbonov/structured-logger';

const logger = createLogger({
  delivery: 'await',
  level: 'debug',
  redact: {
    keys: ['customerId'],
    paths: ['data.payment.cardNumber'],
    presets: ['secrets']
  },
  onExporterError: (event) => {
    diagnostics.capture(event);
  }
});

await logger.info('payment accepted', { customerId: 'customer-1' });
```

`onExporterError` receives exporter name, operation, record ID, and a fixed masked error.
It never receives the original exporter error or the record payload.

## Exporters

Console output is available from the root entry point:

```ts
import { consoleLogExporter } from '@abarbonov/structured-logger';

const exporter = consoleLogExporter({ format: 'pretty', level: 'info' });
```

HTTP delivery is an opt-in entry point:

```ts
import { createLogger } from '@abarbonov/structured-logger';
import { httpLogExporter } from '@abarbonov/structured-logger/http';

const http = httpLogExporter({
  batchSize: 25,
  endpoint: 'https://logs.example.com/ingest',
  flushInterval: 1_000,
  headers: { authorization: 'Bearer server-side-token' },
  onDeliveryError: (event) => {
    diagnostics.capture(event);
  }
});

const logger = createLogger({ exporters: [http] });
logger.info('ingestion started');
await logger.close();
```

The HTTP exporter sends JSON batches through injected or global `fetch`. A failed batch is
not retried in this version and its delivery promises reject. Its diagnostics include only
the endpoint origin, status class, and queue or batch counts.

Do not embed secret API keys in browser bundles. Send browser events to your backend or to a
restricted public ingestion endpoint instead.

## Redaction boundary

Redaction runs before dispatch. Default rules mask common credentials, sensitive headers,
URL query parameters, and serialized error message or stack fields. Custom rules support
masking, removal, partial masking, hashing, and safe custom transforms.

Redaction reduces accidental disclosure risk; it does not by itself establish legal,
regulatory, or organizational compliance.

## Development

```bash
npm run typecheck
npm test
npm run test:package
npm run pack:check
```

## License

[MIT](LICENSE)
