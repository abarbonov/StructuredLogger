# Examples

Build the package first so the public self-referencing imports resolve:

```bash
npm run build
```

Run the examples with Node.js `>=20.19.0`:

```bash
node examples/basic.js
node examples/custom-exporter.js
node examples/http-exporter.js
```

`basic.js` writes JSON records to the console exporter. `custom-exporter.js` stores
redacted records in memory. `http-exporter.js` demonstrates batching with an injected
`fetch` implementation, so it does not make a network request.
