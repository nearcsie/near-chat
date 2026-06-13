"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachSockets = void 0;
const AppError_1 = require("../errors/AppError");
const toApiError = (err) => {
    if (err instanceof AppError_1.AppError) {
        return { statusCode: err.statusCode, message: err.message, code: err.code };
    }
    return { statusCode: 500, message: 'Internal server error' };
};
const attachSockets = (io, deps) => {
    io.on('connection', (socket) => {
        const userId = socket.data.user.userId;
        socket.on('join_room', ({ roomId }) => {
            socket.join(`room_${roomId}`);
        });
        socket.on('leave_room', ({ roomId }) => {
            socket.leave(`room_${roomId}`);
        });
        socket.on('send_message', async ({ roomId, content, replyTo }) => {
            try {
                const message = await deps.messageService.sendMessage(userId, roomId, content, {
                    replyToId: replyTo,
                });
                io.to(`room_${roomId}`).emit('new_message', message);
            }
            catch (err) {
                socket.emit('error', toApiError(err));
            }
        });
        socket.on('recall_message', async ({ messageId }) => {
            try {
                const existing = await deps.messageRepository.findById(messageId);
                if (!existing) {
                    throw new AppError_1.NotFoundError('message', messageId);
                }
                if (existing.senderId !== userId) {
                    throw new AppError_1.ForbiddenError('Only the original sender can recall this message');
                }
                const recalled = await deps.messageService.recallMessage(userId, existing.roomId, messageId);
                io.to(`room_${existing.roomId}`).emit('message_recalled', {
                    messageId: recalled.messageId,
                });
            }
            catch (err) {
                socket.emit('error', toApiError(err));
            }
        });
        socket.on('typing', ({ roomId, isTyping }) => {
            socket.to(`room_${roomId}`).emit('user_typing', { roomId, userId, isTyping });
        });
        socket.on('read_receipt', ({ roomId, messageId }) => {
            socket.to(`room_${roomId}`).emit('read_update', { roomId, userId, messageId });
        });
    });
};
exports.attachSockets = attachSockets;
