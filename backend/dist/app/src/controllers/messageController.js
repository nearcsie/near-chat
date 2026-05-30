"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessageController = void 0;
const AppError_1 = require("../errors/AppError");
const makeMessageController = (service) => ({
    async listForRoom(req, res, next) {
        try {
            const roomId = req.params.roomId;
            const before_id = typeof req.query.before_id === 'string' ? req.query.before_id : undefined;
            const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : undefined;
            const parsedLimit = limitRaw !== undefined ? parseInt(limitRaw, 10) : 50;
            if (limitRaw !== undefined && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100)) {
                return next(new AppError_1.ValidationError('limit must be an integer between 1 and 100'));
            }
            const messages = await service.listForRoom(req.user.userId, roomId, {
                beforeId: before_id,
                limit: parsedLimit,
            });
            res.status(200).json(messages);
        }
        catch (err) {
            next(err);
        }
    },
});
exports.makeMessageController = makeMessageController;
