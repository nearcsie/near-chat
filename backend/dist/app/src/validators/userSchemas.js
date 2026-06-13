"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchQuerySchema = exports.updateMeSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    name: zod_1.z.string().min(1, 'Name cannot be empty'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password cannot be empty'),
});
exports.updateMeSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1, 'Name cannot be empty').optional(),
    bio: zod_1.z.string().trim().optional(),
    avatarUrl: zod_1.z.string().url('Invalid avatar URL').optional(),
    warningEnabled: zod_1.z.boolean().optional(),
    warningDays: zod_1.z.number().int().min(1).optional(),
})
    .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
});
exports.searchQuerySchema = zod_1.z.object({
    query: zod_1.z.string().trim().min(1, 'Search query cannot be empty'),
});
