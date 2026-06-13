"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRoomRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const makeRoomRoutes = (ctrl) => {
    const router = (0, express_1.Router)();
    router.use(authMiddleware_1.authMiddleware);
    router.get('/', ctrl.list.bind(ctrl));
    router.post('/group', ctrl.createGroup.bind(ctrl));
    router.post('/join/:code', ctrl.joinByCode.bind(ctrl));
    router.get('/:id', ctrl.getById.bind(ctrl));
    router.patch('/:id', ctrl.update.bind(ctrl));
    router.delete('/:id/leave', ctrl.leave.bind(ctrl));
    return router;
};
exports.makeRoomRoutes = makeRoomRoutes;
