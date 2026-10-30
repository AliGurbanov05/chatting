"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const Converstation_1 = __importDefault(require("./models/Converstation"));
const Mesasge_1 = __importDefault(require("./models/Mesasge"));
const auth_1 = __importDefault(require("./routes/auth"));
const usres_1 = __importDefault(require("./routes/usres"));
const converstation_1 = __importDefault(require("./routes/converstation"));
const messages_1 = __importDefault(require("./routes/messages"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' },
});
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '20kb' }));
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/api/auth', auth_1.default);
app.use('/api/users', usres_1.default);
app.use('/api/conversations', converstation_1.default);
app.use('/api/messages', messages_1.default);
// Socket.IO bağlantısında JWT yoxlanılır
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const secret = process.env.JWT_SECRET;
    if (!secret || typeof token !== 'string') {
        return next(new Error('Autentifikasiya tələb olunur'));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (typeof payload === 'string' ||
            typeof payload.userId !== 'string') {
            return next(new Error('Token düzgün deyil'));
        }
        socket.data.userId = payload.userId;
        next();
    }
    catch {
        next(new Error('Token etibarsızdır'));
    }
});
io.on('connection', (socket) => {
    const userId = socket.data.userId;
    // Müştəri yalnız iştirakçısı olduğu söhbətə qoşula bilər
    socket.on('conversation:join', async (conversationId, callback) => {
        try {
            if (typeof conversationId !== 'string' ||
                !mongoose_1.default.isValidObjectId(conversationId)) {
                callback?.({ error: 'Söhbət ID-si düzgün deyil' });
                return;
            }
            const conversation = await Converstation_1.default.findOne({
                _id: conversationId,
                participants: userId,
            });
            if (!conversation) {
                callback?.({ error: 'Söhbət tapılmadı' });
                return;
            }
            socket.join(`conversation:${conversationId}`);
            callback?.({ ok: true });
        }
        catch {
            callback?.({ error: 'Söhbətə qoşulmaq olmadı' });
        }
    });
    socket.on('message:send', async (payload, callback) => {
        try {
            const conversationId = payload?.conversationId;
            const text = payload?.text;
            if (typeof conversationId !== 'string' ||
                !mongoose_1.default.isValidObjectId(conversationId) ||
                typeof text !== 'string' ||
                !text.trim() ||
                text.trim().length > 5000) {
                callback?.({ error: 'Mesaj məlumatları düzgün deyil' });
                return;
            }
            const conversation = await Converstation_1.default.findOne({
                _id: conversationId,
                participants: userId,
            });
            if (!conversation) {
                callback?.({ error: 'Bu söhbətə mesaj göndərə bilməzsiniz' });
                return;
            }
            // Əvvəl MongoDB-də saxla, sonra digər iştirakçılara çatdır
            const message = await Mesasge_1.default.create({
                conversation: conversationId,
                sender: userId,
                text: text.trim(),
            });
            await Converstation_1.default.updateOne({ _id: conversationId }, { $set: { updatedAt: new Date() } });
            const savedMessage = await Mesasge_1.default.findById(message._id)
                .populate('sender', 'name email');
            io.to(`conversation:${conversationId}`).emit('message:new', savedMessage);
            callback?.({ ok: true, message: savedMessage });
        }
        catch {
            callback?.({ error: 'Mesaj göndərmək mümkün olmadı' });
        }
    });
});
async function startServer() {
    const uri = process.env.MONGODB_URI;
    const secret = process.env.JWT_SECRET;
    if (!uri || !secret || secret.length < 32) {
        throw new Error('MONGODB_URI və uzun JWT_SECRET təyin edilməlidir');
    }
    await mongoose_1.default.connect(uri);
    console.log('MongoDB bağlantısı uğurludur');
    const port = Number(process.env.PORT) || 3000;
    httpServer.listen(port, '0.0.0.0', () => {
        console.log(`API və Socket.IO port ${port}-də işləyir`);
    });
}
startServer().catch((error) => {
    console.error('Server başlatma xətası:', error);
    process.exit(1);
});
