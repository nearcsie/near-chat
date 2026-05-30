import { Pool } from "pg";
import type { User } from "@shared/types";
import type { IUserRepository } from "./IUserRepository";

function mapRowToUser(row: any): User {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    warningEnabled: row.warning_enabled,
    warningDays: row.warning_days,
    lastActivity: row.last_activity,
    createdAt: row.created_at,
  };
}

export class UserRepository implements IUserRepository {
  constructor(private db: Pool) {}

  async findById(userId: string): Promise<User | null> {
    const res = await this.db.query("SELECT * FROM users WHERE user_id = $1", [userId]);
    if (res.rows.length === 0) return null;
    return mapRowToUser(res.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (res.rows.length === 0) return null;
    return mapRowToUser(res.rows[0]);
  }

  async search(query: string): Promise<User[]> {
    const res = await this.db.query(
      `SELECT * FROM users WHERE name ILIKE $1 OR user_id::text = $2 LIMIT 20`,
      [`%${query}%`, query]
    );
    return res.rows.map(mapRowToUser);
  }

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const res = await this.db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.email, data.passwordHash]
    );
    return mapRowToUser(res.rows[0]);
  }

  async update(userId: string, data: Partial<Pick<User, "name" | "bio" | "avatarUrl" | "warningEnabled" | "warningDays" | "lastActivity">>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let queryIdx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${queryIdx++}`);
      values.push(data.name);
    }
    if (data.bio !== undefined) {
      fields.push(`bio = $${queryIdx++}`);
      values.push(data.bio);
    }
    if (data.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${queryIdx++}`);
      values.push(data.avatarUrl);
    }
    if (data.warningEnabled !== undefined) {
      fields.push(`warning_enabled = $${queryIdx++}`);
      values.push(data.warningEnabled);
    }
    if (data.warningDays !== undefined) {
      fields.push(`warning_days = $${queryIdx++}`);
      values.push(data.warningDays);
    }
    if (data.lastActivity !== undefined) {
      fields.push(`last_activity = $${queryIdx++}`);
      values.push(data.lastActivity);
    }

    if (fields.length === 0) {
      const res = await this.db.query("SELECT * FROM users WHERE user_id = $1", [userId]);
      if (res.rows.length === 0) {
        throw new Error("User not found");
      }
      return mapRowToUser(res.rows[0]);
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${fields.join(", ")} 
      WHERE user_id = $${queryIdx} 
      RETURNING *
    `;
    const res = await this.db.query(query, values);
    if (res.rows.length === 0) {
        throw new Error("User not found");
    }
    return mapRowToUser(res.rows[0]);
  }

  async delete(userId: string): Promise<void> {
    await this.db.query("DELETE FROM users WHERE user_id = $1", [userId]);
  }
}
