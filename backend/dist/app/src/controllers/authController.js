"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAuthController = void 0;
const userSchemas_1 = require("../validators/userSchemas");
const AppError_1 = require("../errors/AppError");
const makeAuthController = (service) => ({
    async register(req, res, next) {
        try {
            const parsed = userSchemas_1.registerSchema.safeParse(req.body);
            if (!parsed.success) {
                return next(new AppError_1.ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
            }
            const result = await service.register(parsed.data);
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    },
    async login(req, res, next) {
        try {
            const parsed = userSchemas_1.loginSchema.safeParse(req.body);
            if (!parsed.success) {
                return next(new AppError_1.ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
            }
            const result = await service.login(parsed.data);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    },
    logout(_req, res) {
        res.status(204).send();
    },
});
exports.makeAuthController = makeAuthController;
