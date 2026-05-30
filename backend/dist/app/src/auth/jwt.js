"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signToken = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET is not defined in production environment.');
        }
        return 'default-dev-secret';
    }
    return secret;
};
exports.getJwtSecret = getJwtSecret;
const signToken = (payload) => {
    const secret = (0, exports.getJwtSecret)();
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn: '7d' });
};
exports.signToken = signToken;
const verifyToken = (token) => {
    const secret = (0, exports.getJwtSecret)();
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyToken = verifyToken;
