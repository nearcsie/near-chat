"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachSocketAuth = void 0;
const jwt_1 = require("../auth/jwt");
const attachSocketAuth = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (typeof token !== 'string' || token.length === 0) {
            next(new Error('Authentication error'));
            return;
        }
        try {
            socket.data.user = (0, jwt_1.verifyToken)(token);
            next();
        }
        catch {
            next(new Error('Authentication error'));
        }
    });
};
exports.attachSocketAuth = attachSocketAuth;
