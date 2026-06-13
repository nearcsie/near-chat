"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recallMessageSchema = exports.listMessagesSchema = exports.sendMessageSchema = void 0;
const zod_1 = require("zod");
const idSchema = zod_1.z.string().trim().min(1, 'Id cannot be empty');
exports.sendMessageSchema = zod_1.z.object({
    roomId: idSchema,
    content: zod_1.z.string().trim().min(1, 'Message content cannot be empty'),
    replyToId: idSchema.optional(),
});
exports.listMessagesSchema = zod_1.z.object({
    roomId: idSchema,
    beforeId: idSchema.optional(),
    limit: zod_1.z.number().int().min(1).max(100).default(50),
});
exports.recallMessageSchema = zod_1.z.object({
    roomId: idSchema,
    messageId: idSchema,
});
