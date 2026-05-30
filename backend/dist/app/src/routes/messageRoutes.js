"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessageRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const makeMessageRoutes = (ctrl) => {
    const router = (0, express_1.Router)();
    router.use(authMiddleware_1.authMiddleware);
    router.get('/:roomId/messages', ctrl.listForRoom.bind(ctrl));
    return router;
};
exports.makeMessageRoutes = makeMessageRoutes;
