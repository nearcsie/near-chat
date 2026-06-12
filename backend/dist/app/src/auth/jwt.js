"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signToken = void 0;
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
const signToken = (payload) => {
    const secret = getJwtSecret();
    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d');
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
exports.signToken = signToken;
const verifyToken = (token) => {
    const secret = getJwtSecret();
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyToken = verifyToken;
