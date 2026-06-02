/// <reference types="vitest/globals" />
import { Pool } from 'pg';
import { UserRepository } from './userRepository';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
});
const repo = new UserRepository(pool);

afterAll(async () => {
  await pool.end();
});

describe('UserRepository soft-delete', () => {
  it('findById returns null for a soft-deleted user', async () => {
    const user = await repo.create({
      name: 'Soft Delete Test',
      email: `soft-delete-findbyid-${Date.now()}@test.example`,
      passwordHash: 'testhash',
    });

    await repo.update(user.userId, { deletedAt: new Date() });

    try {
      const result = await repo.findById(user.userId);
      expect(result).toBeNull();
    } finally {
      await repo.delete(user.userId);
    }
  });

  it('findByEmail returns null for a soft-deleted user', async () => {
    const email = `soft-delete-findbyemail-${Date.now()}@test.example`;
    const user = await repo.create({
      name: 'Soft Delete Test',
      email,
      passwordHash: 'testhash',
    });

    await repo.update(user.userId, { deletedAt: new Date() });

    try {
      const result = await repo.findByEmail(email);
      expect(result).toBeNull();
    } finally {
      await repo.delete(user.userId);
    }
  });

  it('findById returns the user when not soft-deleted', async () => {
    const user = await repo.create({
      name: 'Active User Test',
      email: `active-findbyid-${Date.now()}@test.example`,
      passwordHash: 'testhash',
    });

    try {
      const result = await repo.findById(user.userId);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(user.userId);
    } finally {
      await repo.delete(user.userId);
    }
  });
});
