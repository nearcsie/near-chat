"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRoomService = void 0;
const AppError_1 = require("../errors/AppError");
const roomSchemas_1 = require("../validators/roomSchemas");
const validationMessage = (issues) => issues[0]?.message ?? 'Invalid room payload';
const makeRoomService = (repo, roomMemberRepo) => {
    return {
        async create(creatorId, data) {
            const parsed = roomSchemas_1.createRoomSchema.safeParse(data);
            if (!parsed.success) {
                throw new AppError_1.ValidationError(validationMessage(parsed.error.issues));
            }
            const room = await repo.create(parsed.data);
            await roomMemberRepo.add({ roomId: room.roomId, userId: creatorId, role: 'owner' });
            return room;
        },
        async getById(roomId, callerId) {
            const room = await repo.findById(roomId);
            if (!room)
                throw new AppError_1.NotFoundError('room', roomId);
            const member = await roomMemberRepo.findMember(roomId, callerId);
            if (!member)
                throw new AppError_1.ForbiddenError('User is not a member of this room');
            return room;
        },
        async list(userId) {
            return repo.findByMember(userId);
        },
        async update(roomId, callerId, data) {
            const parsed = roomSchemas_1.updateRoomSchema.safeParse(data);
            if (!parsed.success) {
                throw new AppError_1.ValidationError(validationMessage(parsed.error.issues));
            }
            const room = await repo.findById(roomId);
            if (!room)
                throw new AppError_1.NotFoundError('room', roomId);
            const member = await roomMemberRepo.findMember(roomId, callerId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                throw new AppError_1.ForbiddenError('Only owner or admin can update room settings');
            }
            return repo.update(roomId, parsed.data);
        },
        async joinByCode(userId, inviteCode) {
            const room = await repo.findByInviteCode(inviteCode);
            if (!room)
                throw new AppError_1.NotFoundError('room', inviteCode);
            const existing = await roomMemberRepo.findMember(room.roomId, userId);
            if (existing)
                throw new AppError_1.ConflictError('User is already a member of this room');
            await roomMemberRepo.add({ roomId: room.roomId, userId, role: 'member' });
            return room;
        },
        async leave(userId, roomId) {
            const room = await repo.findById(roomId);
            if (!room)
                throw new AppError_1.NotFoundError('room', roomId);
            const member = await roomMemberRepo.findMember(roomId, userId);
            if (!member)
                throw new AppError_1.ForbiddenError('User is not a member of this room');
            if (member.role === 'owner') {
                throw new AppError_1.ForbiddenError('Owner cannot leave room. Transfer ownership first.');
            }
            await roomMemberRepo.remove(roomId, userId);
        },
        async delete(roomId) {
            const existing = await repo.findById(roomId);
            if (!existing)
                throw new AppError_1.NotFoundError('room', roomId);
            await repo.delete(roomId);
        },
    };
};
exports.makeRoomService = makeRoomService;
