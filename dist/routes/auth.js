"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const router = (0, express_1.Router)();
function createToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET təyin edilməyib');
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: '7d' });
}
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (typeof name !== 'string' ||
            name.trim().length < 2 ||
            typeof email !== 'string' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            typeof password !== 'string' ||
            password.length < 8 ||
            password.length > 72) {
            res.status(400).json({
                message: 'Ad, düzgün email və ən azı 8 simvolluq parol tələb olunur',
            });
            return;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User_1.default.findOne({ email: normalizedEmail });
        if (existing) {
            res.status(409).json({ message: 'Bu email artıq qeydiyyatdadır' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await User_1.default.create({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
        });
        res.status(201).json({
            token: createToken(user.id),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(409).json({ message: 'Bu email artıq qeydiyyatdadır' });
            return;
        }
        res.status(500).json({ message: 'Qeydiyyat zamanı server xətası' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' ||
            typeof password !== 'string') {
            res.status(400).json({ message: 'Email və parol tələb olunur' });
            return;
        }
        const user = await User_1.default.findOne({
            email: email.trim().toLowerCase(),
        }).select('+passwordHash');
        if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
            res.status(401).json({ message: 'Email və ya parol yanlışdır' });
            return;
        }
        res.json({
            token: createToken(user.id),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch {
        res.status(500).json({ message: 'Giriş zamanı server xətası' });
    }
});
exports.default = router;
