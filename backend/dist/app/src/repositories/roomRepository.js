"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRepository = void 0;
function mapRowToRoom(row) {
    return {
        roomId: row.room_id,
        type: row.type,
        name: row.name ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        inviteCode: row.invite_code ?? undefined,
        requireApproval: row.require_approval,
        viewHistory: row.view_history,
        isArchived: row.is_archived,
        createdAt: row.created_at,
    };
}
class RoomRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(roomId) {
        const res = await this.db.query('SELECT * FROM chat_rooms WHERE room_id = $1', [roomId]);
        return res.rows.length === 0 ? null : mapRowToRoom(res.rows[0]);
    }
    async findByInviteCode(code) {
        const res = await this.db.query('SELECT * FROM chat_rooms WHERE invite_code = $1', [code]);
        return res.rows.length === 0 ? null : mapRowToRoom(res.rows[0]);
    }
    async findByMember(userId) {
        const res = await this.db.query(`SELECT cr.* FROM chat_rooms cr
       JOIN room_members rm ON rm.room_id = cr.room_id
       WHERE rm.user_id = $1`, [userId]);
        return res.rows.map(mapRowToRoom);
    }
    async create(data) {
        const res = await this.db.query(`INSERT INTO chat_rooms (type, name, require_approval, view_history)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [data.type, data.name ?? null, data.requireApproval, data.viewHistory]);
        return mapRowToRoom(res.rows[0]);
    }
    async update(roomId, data) {
        const fields = [];
        const values = [];
        let idx = 1;
        if (data.name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(data.name);
        }
        if (data.avatarUrl !== undefined) {
            fields.push(`avatar_url = $${idx++}`);
            values.push(data.avatarUrl);
        }
        if (data.requireApproval !== undefined) {
            fields.push(`require_approval = $${idx++}`);
            values.push(data.requireApproval);
        }
        if (data.viewHistory !== undefined) {
            fields.push(`view_history = $${idx++}`);
            values.push(data.viewHistory);
        }
        if (data.isArchived !== undefined) {
            fields.push(`is_archived = $${idx++}`);
            values.push(data.isArchived);
        }
        if (fields.length === 0) {
            const res = await this.db.query('SELECT * FROM chat_rooms WHERE room_id = $1', [roomId]);
            if (res.rows.length === 0)
                throw new Error('Room not found');
            return mapRowToRoom(res.rows[0]);
        }
        values.push(roomId);
        const res = await this.db.query(`UPDATE chat_rooms SET ${fields.join(', ')} WHERE room_id = $${idx} RETURNING *`, values);
        if (res.rows.length === 0)
            throw new Error('Room not found');
        return mapRowToRoom(res.rows[0]);
    }
    async delete(roomId) {
        await this.db.query('DELETE FROM chat_rooms WHERE room_id = $1', [roomId]);
    }
}
exports.RoomRepository = RoomRepository;
