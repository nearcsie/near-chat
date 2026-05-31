import { Pool } from "pg";
import type { IEmergencyContactRepository, EmergencyContact } from "./IEmergencyContactRepository";

export class EmergencyContactRepository implements IEmergencyContactRepository {
  constructor(private db: Pool) {}

  async findByUserId(userId: string): Promise<EmergencyContact[]> {
    const res = await this.db.query(
      `SELECT ec.*, u.name, u.email, u.avatar_url 
       FROM emergency_contacts ec
       JOIN users u ON ec.contact_id = u.user_id
       WHERE ec.user_id = $1`,
      [userId]
    );
    return res.rows.map(row => ({
      userId: row.user_id,
      contactId: row.contact_id,
      message: row.message,
      createdAt: row.created_at,
      contact: {
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url ?? undefined
      }
    }));
  }

  async upsert(userId: string, contactId: string, message: string): Promise<{ contact: EmergencyContact, isUpdate: boolean }> {
    const res = await this.db.query(
      `INSERT INTO emergency_contacts (user_id, contact_id, message)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, contact_id) DO UPDATE SET message = EXCLUDED.message
       RETURNING *, (xmax != 0) AS is_update`,
      [userId, contactId, message]
    );
    return {
      contact: {
        userId: res.rows[0].user_id,
        contactId: res.rows[0].contact_id,
        message: res.rows[0].message,
        createdAt: res.rows[0].created_at
      },
      isUpdate: res.rows[0].is_update
    };
  }

  async delete(userId: string, contactId: string): Promise<void> {
    await this.db.query(
      "DELETE FROM emergency_contacts WHERE user_id = $1 AND contact_id = $2",
      [userId, contactId]
    );
  }

  async recordAlertIfNew(userId: string, lastActivity: Date): Promise<boolean> {
    const res = await this.db.query(
      `INSERT INTO emergency_alert_logs (user_id, last_activity_at)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING user_id`,
      [userId, lastActivity]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
