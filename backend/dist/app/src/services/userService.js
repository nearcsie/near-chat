"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeUserService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const AppError_1 = require("../errors/AppError");
const userSchemas_1 = require("../validators/userSchemas");
const makeUserService = (repo, jwt) => {
    return {
        async register(data) {
            const existingUser = await repo.findByEmail(data.email);
            if (existingUser) {
                throw new AppError_1.ConflictError('Email already in use');
            }
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash(data.password, salt);
            const user = await repo.create({
                email: data.email,
                name: data.name,
                passwordHash
            });
            const publicUser = {
                userId: user.userId,
                name: user.name,
                avatarUrl: user.avatarUrl
            };
            const token = jwt.signToken({
                userId: user.userId,
                name: user.name
            });
            return {
                token,
                user: publicUser
            };
        },
        async login(data) {
            const user = await repo.findByEmail(data.email);
            if (!user) {
                throw new AppError_1.ValidationError('Invalid email or password');
            }
            const isMatch = await bcryptjs_1.default.compare(data.password, user.passwordHash);
            if (!isMatch) {
                throw new AppError_1.ValidationError('Invalid email or password');
            }
            const publicUser = {
                userId: user.userId,
                name: user.name,
                avatarUrl: user.avatarUrl
            };
            const token = jwt.signToken({
                userId: user.userId,
                name: user.name
            });
            return {
                token,
                user: publicUser
            };
        },
        async getMe(userId) {
            const user = await repo.findById(userId);
            if (!user)
                throw new AppError_1.NotFoundError('user', userId);
            return { userId: user.userId, name: user.name, avatarUrl: user.avatarUrl };
        },
        async updateMe(userId, data) {
            const parsed = userSchemas_1.updateMeSchema.safeParse(data);
            if (!parsed.success) {
                throw new AppError_1.ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload');
            }
            const updated = await repo.update(userId, parsed.data);
            return { userId: updated.userId, name: updated.name, avatarUrl: updated.avatarUrl };
        },
        async search(query) {
            const parsed = userSchemas_1.searchQuerySchema.safeParse({ query });
            if (!parsed.success) {
                throw new AppError_1.ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
            }
            const users = await repo.search(parsed.data.query);
            return users.map((u) => ({ userId: u.userId, name: u.name, avatarUrl: u.avatarUrl }));
        },
    };
};
exports.makeUserService = makeUserService;
