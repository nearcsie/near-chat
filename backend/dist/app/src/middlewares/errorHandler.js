"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const AppError_1 = require("../errors/AppError");
function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError_1.AppError) {
        const body = {
            statusCode: err.statusCode,
            message: err.message,
            ...(err.code !== undefined && { code: err.code }),
        };
        res.status(err.statusCode).json(body);
        return;
    }
    // Unknown / unexpected errors — never leak stack traces in production
    res.status(500).json({
        statusCode: 500,
        message: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
    });
}
