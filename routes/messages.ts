
import { Router } from 'express';
import pool from '../db/connect';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(auth);

// GET /api/messages/:conversationId
router.get('/:conversationId', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { conversationId } = req.params;

    if (!/^[1-9]\d*$/.test(conversationId)) {
      res.status(400).json({
        message: 'Söhbət ID-si düzgün deyil',
      });
      return;
    }

    // İstifadəçinin bu söhbətin iştirakçısı olduğunu yoxla
    const conversation = await pool.query(
      `SELECT c.id
       FROM conversations c
       INNER JOIN conversation_participants cp
         ON cp.conversation_id = c.id
       WHERE c.id = $1
       AND cp.user_id = $2`,
      [conversationId, userId]
    );

    if (conversation.rowCount === 0) {
      res.status(404).json({
        message: 'Söhbət tapılmadı',
      });
      return;
    }

    // Pagination parametrləri
    const requestedLimit = Number(req.query.limit) || 200;
    const limit = Math.min(Math.max(requestedLimit, 1), 200);

    const requestedOffset = Number(req.query.offset) || 0;
    const offset = Math.max(
      0,
      Math.min(
        Number.isSafeInteger(requestedOffset) ? requestedOffset : 0,
        1000000
      )
    );

    // Mesajları və göndərənlərin məlumatlarını gətir
    const result = await pool.query(
      `SELECT
         m.id::text AS id,
         m.conversation_id::text AS "conversationId",
         m.sender_id::text AS "senderId",
         m.text,
         m.created_at AS "createdAt",
         m.updated_at AS "updatedAt",
         json_build_object(
           'id', u.id::text,
           'name', u.name,
           'email', u.email
         ) AS sender
       FROM messages m
       INNER JOIN users u
         ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    res.json(result.rows);

  } catch (error) {
    console.error('Get messages error:', error);

    res.status(500).json({
      message: 'Mesajları gətirmək olmadı',
    });
  }
});

export default router;
