import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
});