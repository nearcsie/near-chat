import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCoverageMap, type CoverageMapData } from 'istanbul-lib-coverage';
import { createContext } from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const coverageDir = resolve(process.cwd(), 'coverage');
const coverageFile = resolve(coverageDir, 'coverage-final.json');
const coverageData = JSON.parse(readFileSync(coverageFile, 'utf8')) as CoverageMapData;
const context = createContext({
  dir: coverageDir,
  coverageMap: createCoverageMap(coverageData),
});

for (const reporter of ['text-summary', 'json-summary', 'lcovonly'] as const) {
  reports.create(reporter).execute(context);
}
