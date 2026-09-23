import { transformSync } from '@babel/core';
import transformTypeScript from '@babel/plugin-transform-typescript';
import { plugin } from 'bun';
import { afterAll } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import { createInstrumenter } from 'istanbul-lib-instrument';

declare global {
  // Istanbul-instrumented modules merge their counters into this process-wide
  // object. The declaration keeps the preload type-safe without changing the
  // production global surface.
  var __coverage__: CoverageMapData | undefined;
}

const backendRoot = resolve(process.cwd());
const sourceRoot = resolve(backendRoot, 'src');
const outputFile = resolve(backendRoot, 'coverage', 'coverage-final.json');
const escapedSourceRoot = sourceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapedSeparator = sep === '\\' ? '\\\\' : sep;
const sourceFilter = new RegExp(`^${escapedSourceRoot}${escapedSeparator}.*\\.ts$`);

mkdirSync(dirname(outputFile), { recursive: true });
rmSync(outputFile, { force: true });

plugin({
  name: 'backend-istanbul-coverage',
  setup(builder) {
    builder.onLoad({ filter: sourceFilter }, ({ path }) => {
      const filename = resolve(path);

      const source = readFileSync(filename, 'utf8');
      const transformed = transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        retainLines: true,
        plugins: [[transformTypeScript, { allowDeclareFields: true }]],
      });
      if (!transformed?.code) throw new Error(`Failed to transform ${filename} for coverage`);

      const instrumenter = createInstrumenter({
        coverageGlobalScope: 'globalThis',
        coverageGlobalScopeFunc: false,
        coverageVariable: '__coverage__',
        esModules: true,
        produceSourceMap: false,
      });
      const contents = instrumenter.instrumentSync(transformed.code, filename);

      return { contents, loader: 'js' };
    });
  },
});

const writeCoverage = () => {
  if (!globalThis.__coverage__) return;
  writeFileSync(outputFile, JSON.stringify(globalThis.__coverage__));
};

afterAll(writeCoverage);
process.once('exit', writeCoverage);
