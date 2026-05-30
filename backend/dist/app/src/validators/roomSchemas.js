"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoomSchema = exports.createRoomSchema = exports.roomTypeSchema = void 0;
const zod_1 = require("zod");
exports.roomTypeSchema = zod_1.z.enum(['private', 'group']);
exports.createRoomSchema = zod_1.z.object({
    type: exports.roomTypeSchema.default('group'),
    name: zod_1.z.string().trim().min(1, 'Room name cannot be empty'),
    requireApproval: zod_1.z.boolean().default(false),
    viewHistory: zod_1.z.boolean().default(true),
});
exports.updateRoomSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1, 'Room name cannot be empty').optional(),
    avatarUrl: zod_1.z.string().url('Invalid avatar URL').optional(),
    requireApproval: zod_1.z.boolean().optional(),
    viewHistory: zod_1.z.boolean().optional(),
    isArchived: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one room field must be provided',
});
