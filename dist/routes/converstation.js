"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Converstation_1 = __importDefault(require("../models/Converstation"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.auth);
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        const conversations = await Converstation_1.default.find({
            participants: userId,
        })
            .populate('participants', 'name email')
            .sort({ updatedAt: -1 });
        res.json(conversations);
    }
    catch {
        res.status(500).json({ message: 'Söhbətləri gətirmək olmadı' });
    }
});
// Şəxsi söhbət yarat və ya mövcud olanı tap
router.post('/private', async (req, res) => {
    try {
        const userId = req.userId;
        const { userId: otherUserId } = req.body;
        if (typeof otherUserId !== 'string' ||
            !mongoose_1.default.isValidObjectId(otherUserId) ||
            otherUserId === userId) {
            res.status(400).json({ message: 'İstifadəçi ID-si düzgün deyil' });
            return;
        }
        const otherUser = await User_1.default.findById(otherUserId);
        if (!otherUser) {
            res.status(404).json({ message: 'İstifadəçi tapılmadı' });
            return;
        }
        const participants = [
            new mongoose_1.default.Types.ObjectId(userId),
            new mongoose_1.default.Types.ObjectId(otherUserId),
        ];
        let conversation = await Converstation_1.default.findOne({
            type: 'private',
            participants: { $all: participants, $size: 2 },
        });
        if (!conversation) {
            conversation = await Converstation_1.default.create({
                type: 'private',
                participants,
                createdBy: userId,
            });
        }
        res.status(200).json(conversation);
    }
    catch {
        res.status(500).json({ message: 'Şəxsi söhbət yaratmaq olmadı' });
    }
});
// Qrup yarat
router.post('/group', async (req, res) => {
    try {
        const userId = req.userId;
        const { title, participantIds } = req.body;
        if (typeof title !== 'string' ||
            !title.trim() ||
            title.trim().length > 80 ||
            !Array.isArray(participantIds) ||
            participantIds.some((id) => typeof id !== 'string' || !mongoose_1.default.isValidObjectId(id))) {
            res.status(400).json({
                message: 'Qrup adı və iştirakçı ID-ləri düzgün olmalıdır',
            });
            return;
        }
        const ids = [...new Set([userId, ...participantIds])];
        if (ids.length < 3) {
            res.status(400).json({
                message: 'Qrup üçün özünüzdən əlavə ən azı 2 istifadəçi seçin',
            });
            return;
        }
        const foundCount = await User_1.default.countDocuments({
            _id: { $in: ids },
        });
        if (foundCount !== ids.length) {
            res.status(400).json({
                message: 'İştirakçılardan biri tapılmadı',
            });
            return;
        }
        const conversation = await Converstation_1.default.create({
            type: 'group',
            title: title.trim(),
            participants: ids,
            createdBy: userId,
        });
        res.status(201).json(conversation);
    }
    catch {
        res.status(500).json({ message: 'Qrup yaratmaq olmadı' });
    }
});
exports.default = router;
