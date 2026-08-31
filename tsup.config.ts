import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    http: 'src/http.ts',
    index: 'src/index.ts',
    types: 'src/types/index.ts'
  },
  format: ['esm'],
  sourcemap: true,
  splitting: false,
  target: 'es2022',
  treeshake: true
});
