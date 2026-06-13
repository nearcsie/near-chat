"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAttachmentRoutes = makeAttachmentRoutes;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const upload = (0, multer_1.default)({ dest: 'uploads/' });
function makeAttachmentRoutes(attachmentController) {
    const router = (0, express_1.Router)();
    router.post('/', authMiddleware_1.authMiddleware, upload.single('file'), attachmentController.upload);
    router.get('/:id', authMiddleware_1.authMiddleware, attachmentController.download);
    return router;
}
