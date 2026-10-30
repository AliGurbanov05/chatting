import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';

import pool from './db/connect';

import authRoutes from './routes/auth';
import usersRoutes from './routes/usres';
import conversationsRoutes from './routes/converstation';
import messagesRoutes from './routes/messages';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);

// JWT autentifikasiyası
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const secret = process.env.JWT_SECRET;

  if (!secret || typeof token !== 'string') {
    return next(new Error('Autentifikasiya tələb olunur'));
  }

  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload === 'string' ||
      !['string', 'number'].includes(typeof payload.userId) ||
      !/^[1-9]\d*$/.test(String(payload.userId))
    ) {
      return next(new Error('Token düzgün deyil'));
    }

    socket.data.userId = String(payload.userId);
    next();
  } catch {
    next(new Error('Token etibarsızdır'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId as string;

  // Söhbətə qoşulma
  socket.on(
    'conversation:join',
    async (
      conversationId: unknown,
      callback?: (result: any) => void
    ) => {
      try {
        if (
          typeof conversationId !== 'string' ||
          !/^[1-9]\d*$/.test(conversationId)
        ) {
          callback?.({ error: 'Söhbət ID-si düzgün deyil' });
          return;
        }

        const result = await pool.query(
          `SELECT 1
           FROM conversation_participants
           WHERE conversation_id = $1
           AND user_id = $2`,
          [conversationId, userId]
        );

        if (result.rowCount === 0) {
          callback?.({ error: 'Söhbət tapılmadı' });
          return;
        }

        socket.join(`conversation:${conversationId}`);

        callback?.({ ok: true });
      } catch (error) {
        console.error('Conversation join error:', error);
        callback?.({ error: 'Söhbətə qoşulmaq olmadı' });
      }
    }
  );

  // Mesaj göndərilməsi
  socket.on(
    'message:send',
    async (
      payload: any,
      callback?: (result: any) => void
    ) => {
      try {
        const conversationId = payload?.conversationId;
        const text = payload?.text;

        if (
          typeof conversationId !== 'string' ||
          !/^[1-9]\d*$/.test(conversationId) ||
          typeof text !== 'string' ||
          !text.trim() ||
          text.trim().length > 5000
        ) {
          callback?.({ error: 'Mesaj məlumatları düzgün deyil' });
          return;
        }

        // İstifadəçinin söhbətin iştirakçısı olduğunu yoxla
        const conversation = await pool.query(
          `SELECT id
           FROM conversations
           WHERE id = $1
           AND EXISTS (
             SELECT 1
             FROM conversation_participants
             WHERE conversation_id = conversations.id
             AND user_id = $2
           )`,
          [conversationId, userId]
        );

        if (conversation.rowCount === 0) {
          callback?.({
            error: 'Bu söhbətə mesaj göndərə bilməzsiniz',
          });
          return;
        }

        // Mesajı PostgreSQL-də saxla
        const inserted = await pool.query(
          `INSERT INTO messages
            (conversation_id, sender_id, text)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id,
                     text, created_at, updated_at`,
          [conversationId, userId, text.trim()]
        );

        // Söhbətin yenilənmə tarixini dəyiş
        await pool.query(
          `UPDATE conversations
           SET updated_at = NOW()
           WHERE id = $1`,
          [conversationId]
        );

        const messageRow = inserted.rows[0];

        // Göndərən istifadəçinin məlumatlarını əldə et
        const senderResult = await pool.query(
          `SELECT id, name, email
           FROM users
           WHERE id = $1`,
          [userId]
        );

        const sender = senderResult.rows[0];

        const savedMessage = {
          id: messageRow.id,
          conversationId: messageRow.conversation_id,
          senderId: messageRow.sender_id,
          sender: {
            id: sender.id,
            name: sender.name,
            email: sender.email,
          },
          text: messageRow.text,
          createdAt: messageRow.created_at,
          updatedAt: messageRow.updated_at,
        };

        // Mesajı söhbətin iştirakçılarına göndər
        io.to(`conversation:${conversationId}`).emit(
          'message:new',
          savedMessage
        );

        callback?.({
          ok: true,
          message: savedMessage,
        });

      } catch (error) {
        console.error('Message send error:', error);
        callback?.({
          error: 'Mesaj göndərmək mümkün olmadı',
        });
      }
    }
  );
});

// Serverin başladılması
async function startServer() {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.JWT_SECRET;

  if (!databaseUrl || !secret || secret.length < 32) {
    throw new Error(
      'DATABASE_URL və ən azı 32 simvolluq JWT_SECRET təyin edilməlidir'
    );
  }

  // PostgreSQL bağlantısını yoxla
  await pool.query('SELECT 1');

  console.log('PostgreSQL bağlantısı uğurludur');

  const port = Number(process.env.PORT) || 10000;

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`API və Socket.IO port ${port}-də işləyir`);
  });
}

startServer().catch((error) => {
  console.error('Server başlatma xətası:', error);
  process.exit(1);
});
