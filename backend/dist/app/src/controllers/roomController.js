"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRoomController = void 0;
const AppError_1 = require("../errors/AppError");
const makeRoomController = (service) => ({
    async list(req, res, next) {
        try {
            const rooms = await service.list(req.user.userId);
            res.status(200).json(rooms);
        }
        catch (err) {
            next(err);
        }
    },
    async createGroup(req, res, next) {
        try {
            const { name, avatarUrl } = req.body;
            if (!name || !name.trim()) {
                return next(new AppError_1.ValidationError('Room name cannot be empty'));
            }
            const room = await service.create(req.user.userId, { type: 'group', name });
            res.status(201).json(room);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const room = await service.getById(req.params.id, req.user.userId);
            res.status(200).json(room);
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const room = await service.update(req.params.id, req.user.userId, req.body);
            res.status(200).json(room);
        }
        catch (err) {
            next(err);
        }
    },
    async joinByCode(req, res, next) {
        try {
            const room = await service.joinByCode(req.user.userId, req.params.code);
            res.status(200).json(room);
        }
        catch (err) {
            next(err);
        }
    },
    async leave(req, res, next) {
        try {
            await service.leave(req.user.userId, req.params.id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    },
});
exports.makeRoomController = makeRoomController;
