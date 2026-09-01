import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as http from '../../dist/http.js';
import * as root from '../../dist/index.js';
import * as types from '../../dist/types.js';

const projectRoot = new URL('../..', import.meta.url).pathname;

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });

describe('package smoke checks', () => {
  it('exposes root, HTTP, and type-only entry points from the build output', () => {
    expect(root.createLogger).toBeTypeOf('function');
    expect(root.consoleLogExporter).toBeTypeOf('function');
    expect(http.httpLogExporter).toBeTypeOf('function');
    expect(Object.keys(types)).toEqual([]);

    ['index', 'http', 'types'].forEach((entry) => {
      expect(existsSync(join(projectRoot, 'dist', `${entry}.d.ts`))).toBe(true);
    });

    expect(readFileSync(join(projectRoot, 'dist', 'index.d.ts'), 'utf8')).toContain(
      'StructuredLogger'
    );
    expect(readFileSync(join(projectRoot, 'dist', 'http.d.ts'), 'utf8')).toContain(
      'httpLogExporter'
    );
    expect(readFileSync(join(projectRoot, 'dist', 'types.d.ts'), 'utf8')).toContain('LogRecord');
  });

  it('declares package exports and publishable files for every public entry point', () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, 'package.json'), 'utf8')
    ) as Record<string, unknown>;

    expect(packageJson.files).toEqual(expect.arrayContaining(['dist', 'LICENSE', 'README.md']));
    expect(packageJson.exports).toMatchObject({
      '.': { import: './dist/index.js', types: './dist/index.d.ts' },
      './http': { import: './dist/http.js', types: './dist/http.d.ts' },
      './types': { import: './dist/types.js', types: './dist/types.d.ts' }
    });
  });

  it('keeps Node-only imports out of runtime-agnostic source modules', () => {
    const runtimeSources = [
      'src/index.ts',
      'src/http.ts',
      ...sourceFiles(join(projectRoot, 'src/core'))
    ];

    runtimeSources.forEach((path) => {
      expect(readFileSync(path, 'utf8')).not.toMatch(/(?:from|import)\s*['"]node:/);
    });
  });
});
