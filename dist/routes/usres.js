"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const currentUserId = req.userId;
        const users = await User_1.default.find({
            _id: { $ne: new mongoose_1.default.Types.ObjectId(currentUserId) },
        })
            .select('name email')
            .sort({ name: 1 });
        res.json(users);
    }
    catch {
        res.status(500).json({ message: 'İstifadəçiləri gətirmək olmadı' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, email } = req.body;
        if (typeof name !== 'string' ||
            !name.trim() ||
            typeof email !== 'string' ||
            !email.trim()) {
            res.status(400).json({
                message: 'Ad və email tələb olunur',
            });
            return;
        }
        const user = await User_1.default.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
        });
        res.status(201).json(user);
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(409).json({
                message: 'Bu email artıq mövcuddur',
            });
            return;
        }
        if (error.name === 'ValidationError') {
            res.status(400).json({
                message: 'Göndərilən məlumatlar düzgün deyil',
            });
            return;
        }
        res.status(500).json({ message: 'Server xətası' });
    }
});
exports.default = router;
