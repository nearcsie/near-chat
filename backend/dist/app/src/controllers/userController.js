"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeUserController = void 0;
const userSchemas_1 = require("../validators/userSchemas");
const AppError_1 = require("../errors/AppError");
const makeUserController = (service) => ({
    async getMe(req, res, next) {
        try {
            const userId = req.user.userId;
            const user = await service.getMe(userId);
            res.status(200).json(user);
        }
        catch (err) {
            next(err);
        }
    },
    async updateMe(req, res, next) {
        try {
            const parsed = userSchemas_1.updateMeSchema.safeParse(req.body);
            if (!parsed.success) {
                return next(new AppError_1.ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
            }
            const userId = req.user.userId;
            const updated = await service.updateMe(userId, parsed.data);
            res.status(200).json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async search(req, res, next) {
        try {
            const parsed = userSchemas_1.searchQuerySchema.safeParse({ query: req.query.query });
            if (!parsed.success) {
                return next(new AppError_1.ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query'));
            }
            const users = await service.search(parsed.data.query);
            res.status(200).json(users);
        }
        catch (err) {
            next(err);
        }
    },
});
exports.makeUserController = makeUserController;
