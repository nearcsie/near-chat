"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeUserRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const makeUserRoutes = (ctrl) => {
    const router = (0, express_1.Router)();
    router.use(authMiddleware_1.authMiddleware);
    router.get('/me', ctrl.getMe.bind(ctrl));
    router.patch('/me', ctrl.updateMe.bind(ctrl));
    router.get('/search', ctrl.search.bind(ctrl));
    return router;
};
exports.makeUserRoutes = makeUserRoutes;
