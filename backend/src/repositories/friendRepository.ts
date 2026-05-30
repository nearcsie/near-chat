import type { Pool } from 'pg';

export interface Friendship {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: Date;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: Date;
}

export interface FriendRequestResult {
  requester_id: string;
  addressee_id: string;
  status: string;
}

export const makeFriendRepository = (db: Pool) => {
  return {
    async sendFriendRequest(requesterId: string, addresseeId: string): Promise<FriendRequestResult> {
      const res = await db.query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING requester_id, addressee_id, status`,
        [requesterId, addresseeId]
      );
      return res.rows[0];
    },

    async getPendingRequests(userId: string): Promise<FriendRequestResult[]> {
      const res = await db.query(
        `SELECT requester_id, addressee_id, status
         FROM friendships
         WHERE addressee_id = $1 AND status = 'pending'`,
        [userId]
      );
      return res.rows;
    },

    async acceptFriendRequest(requesterId: string, addresseeId: string): Promise<FriendRequestResult> {
      const res = await db.query(
        `UPDATE friendships
         SET status = 'accepted'
         WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
         RETURNING requester_id, addressee_id, status`,
        [requesterId, addresseeId]
      );
      return res.rows[0];
    },

    async deleteFriendship(user1: string, user2: string): Promise<void> {
      await db.query(
        `DELETE FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [user1, user2]
      );
    },

    async getFriends(userId: string): Promise<any[]> {
      const res = await db.query(
        `SELECT
           CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END as user_id
         FROM friendships
         WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'`,
        [userId]
      );
      return res.rows;
    },

    async blockUser(blockerId: string, blockedId: string): Promise<void> {
      await db.query(
        `INSERT INTO blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [blockerId, blockedId]
      );
    },

    async unblockUser(blockerId: string, blockedId: string): Promise<void> {
      await db.query(
        `DELETE FROM blocks
         WHERE blocker_id = $1 AND blocked_id = $2`,
        [blockerId, blockedId]
      );
    },

    async isBlocked(user1: string, user2: string): Promise<boolean> {
      const res = await db.query(
        `SELECT 1 FROM blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [user1, user2]
      );
      return (res.rowCount ?? 0) > 0;
    },

    async areFriends(user1: string, user2: string): Promise<boolean> {
      const res = await db.query(
        `SELECT 1 FROM friendships
         WHERE status = 'accepted'
           AND ((requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1))`,
        [user1, user2]
      );
      return (res.rowCount ?? 0) > 0;
    }
  };
};
