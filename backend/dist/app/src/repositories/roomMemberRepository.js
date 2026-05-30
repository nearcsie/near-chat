"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomMemberRepository = void 0;
function mapRowToRoomMember(row) {
    return {
        roomId: row.room_id,
        userId: row.user_id,
        role: row.role,
        nickname: row.nickname ?? undefined,
        isMuted: row.is_muted,
        lastReadId: row.last_read_id ?? undefined,
        joinTime: row.join_time,
    };
}
class RoomMemberRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findMember(roomId, userId) {
        const res = await this.db.query('SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
        return res.rows.length === 0 ? null : mapRowToRoomMember(res.rows[0]);
    }
    async findByRoom(roomId) {
        const res = await this.db.query('SELECT * FROM room_members WHERE room_id = $1 ORDER BY join_time ASC', [roomId]);
        return res.rows.map(mapRowToRoomMember);
    }
    async add(data) {
        const res = await this.db.query(`INSERT INTO room_members (room_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`, [data.roomId, data.userId, data.role]);
        return mapRowToRoomMember(res.rows[0]);
    }
    async update(roomId, userId, data) {
        const fields = [];
        const values = [];
        let idx = 1;
        if (data.role !== undefined) {
            fields.push(`role = $${idx++}`);
            values.push(data.role);
        }
        if (data.nickname !== undefined) {
            fields.push(`nickname = $${idx++}`);
            values.push(data.nickname);
        }
        if (data.isMuted !== undefined) {
            fields.push(`is_muted = $${idx++}`);
            values.push(data.isMuted);
        }
        if (data.lastReadId !== undefined) {
            fields.push(`last_read_id = $${idx++}`);
            values.push(data.lastReadId);
        }
        if (fields.length === 0) {
            const existing = await this.findMember(roomId, userId);
            if (!existing)
                throw new Error('Room member not found');
            return existing;
        }
        values.push(roomId, userId);
        const res = await this.db.query(`UPDATE room_members
       SET ${fields.join(', ')}
       WHERE room_id = $${idx} AND user_id = $${idx + 1}
       RETURNING *`, values);
        if (res.rows.length === 0)
            throw new Error('Room member not found');
        return mapRowToRoomMember(res.rows[0]);
    }
    async remove(roomId, userId) {
        await this.db.query('DELETE FROM room_members WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
    }
}
exports.RoomMemberRepository = RoomMemberRepository;
