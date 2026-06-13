"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jwt_1 = require("../auth/jwt");
const AppError_1 = require("../errors/AppError");
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError_1.AppError(401, 'Unauthorized: Missing or invalid Authorization header');
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = payload;
        next();
    }
    catch (error) {
        throw new AppError_1.AppError(401, 'Unauthorized: Invalid token');
    }
};
exports.authMiddleware = authMiddleware;
