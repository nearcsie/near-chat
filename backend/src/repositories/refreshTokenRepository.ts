import { Pool } from 'pg';
import type { IRefreshTokenRepository, RefreshToken } from './IRefreshTokenRepository';

export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private db: Pool) {}

  private mapRow(row: any): RefreshToken {
    return {
      tokenId: row.token_id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      replacedBy: row.replaced_by,
    };
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    const res = await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.userId, data.tokenHash, data.expiresAt]
    );
    return this.mapRow(res.rows[0]);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const res = await this.db.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async revoke(tokenId: string, replacedByTokenId?: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), replaced_by = COALESCE($2, replaced_by)
       WHERE token_id = $1`,
      [tokenId, replacedByTokenId || null]
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }
}
