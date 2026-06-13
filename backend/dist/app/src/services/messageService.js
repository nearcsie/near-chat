"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessageService = void 0;
const AppError_1 = require("../errors/AppError");
const messageSchemas_1 = require("../validators/messageSchemas");
const validationMessage = (issues) => issues[0]?.message ?? 'Invalid message payload';
const makeMessageService = (messageRepo, roomRepo, roomMemberRepo) => {
    const assertRoomMembership = async (userId, roomId) => {
        const room = await roomRepo.findById(roomId);
        if (!room) {
            throw new AppError_1.NotFoundError('room', roomId);
        }
        const member = await roomMemberRepo.findMember(roomId, userId);
        if (!member) {
            throw new AppError_1.ForbiddenError('User is not a member of this room');
        }
    };
    return {
        async sendMessage(userId, roomId, content, opts = {}) {
            const parsed = messageSchemas_1.sendMessageSchema.safeParse({
                roomId,
                content,
                replyToId: opts.replyToId,
            });
            if (!parsed.success) {
                throw new AppError_1.ValidationError(validationMessage(parsed.error.issues));
            }
            await assertRoomMembership(userId, parsed.data.roomId);
            const messageData = {
                roomId: parsed.data.roomId,
                senderId: userId,
                content: parsed.data.content,
            };
            if (parsed.data.replyToId) {
                messageData.replyToId = parsed.data.replyToId;
            }
            return messageRepo.create(messageData);
        },
        async listForRoom(userId, roomId, opts = {}) {
            const parsed = messageSchemas_1.listMessagesSchema.safeParse({
                roomId,
                beforeId: opts.beforeId,
                limit: opts.limit ?? 50,
            });
            if (!parsed.success) {
                throw new AppError_1.ValidationError(validationMessage(parsed.error.issues));
            }
            await assertRoomMembership(userId, parsed.data.roomId);
            return messageRepo.findByRoom(parsed.data.roomId, {
                beforeId: parsed.data.beforeId,
                limit: parsed.data.limit,
            });
        },
        async recallMessage(userId, roomId, messageId) {
            const parsed = messageSchemas_1.recallMessageSchema.safeParse({ roomId, messageId });
            if (!parsed.success) {
                throw new AppError_1.ValidationError(validationMessage(parsed.error.issues));
            }
            await assertRoomMembership(userId, parsed.data.roomId);
            const existing = await messageRepo.findById(parsed.data.messageId);
            if (!existing || existing.roomId !== parsed.data.roomId) {
                throw new AppError_1.NotFoundError('message', parsed.data.messageId);
            }
            if (existing.senderId !== userId) {
                throw new AppError_1.ForbiddenError('Only the original sender can recall this message');
            }
            return messageRepo.markRecalled(parsed.data.messageId);
        },
    };
};
exports.makeMessageService = makeMessageService;
