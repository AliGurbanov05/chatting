"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function auth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
        ? header.slice(7)
        : null;
    if (!token) {
        res.status(401).json({ message: 'Giriş tələb olunur' });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'JWT konfiqurasiyası yoxdur' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (typeof payload === 'string' ||
            typeof payload.userId !== 'string') {
            res.status(401).json({ message: 'Token düzgün deyil' });
            return;
        }
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({
            message: 'Token etibarsızdır və ya vaxtı bitib',
        });
    }
}
