"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Converstation_1 = __importDefault(require("../models/Converstation"));
const Mesasge_1 = __importDefault(require("../models/Mesasge"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.auth);
// GET /api/messages/:conversationId
router.get('/:conversationId', async (req, res) => {
    try {
        const userId = req.userId;
        const { conversationId } = req.params;
        if (!mongoose_1.default.isValidObjectId(conversationId)) {
            res.status(400).json({ message: 'Söhbət ID-si düzgün deyil' });
            return;
        }
        const conversation = await Converstation_1.default.findOne({
            _id: conversationId,
            participants: userId,
        });
        if (!conversation) {
            res.status(404).json({ message: 'Söhbət tapılmadı' });
            return;
        }
        const messages = await Mesasge_1.default.find({
            conversation: conversationId,
        })
            .populate('sender', 'name email')
            .sort({ createdAt: 1 })
            .limit(200);
        res.json(messages);
    }
    catch {
        res.status(500).json({ message: 'Mesajları gətirmək olmadı' });
    }
});
exports.default = router;
