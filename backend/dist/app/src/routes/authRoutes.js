"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAuthRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const makeAuthRoutes = (ctrl) => {
    const router = (0, express_1.Router)();
    router.post('/register', ctrl.register.bind(ctrl));
    router.post('/login', ctrl.login.bind(ctrl));
    router.post('/logout', authMiddleware_1.authMiddleware, ctrl.logout.bind(ctrl));
    return router;
};
exports.makeAuthRoutes = makeAuthRoutes;
