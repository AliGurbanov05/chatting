
import { Router } from 'express';
import pool from '../db/connect';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(auth);

// GET /api/conversations
// İstifadəçinin bütün söhbətlərini gətir
router.get('/', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;

    const result = await pool.query(
      `SELECT
         c.id::text AS id,
         c.type,
         c.title,
         c.created_by::text AS "createdBy",
         c.created_at AS "createdAt",
         c.updated_at AS "updatedAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', u.id::text,
               'name', u.name,
               'email', u.email
             )
             ORDER BY u.name
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'::json
         ) AS participants
       FROM conversations c
       INNER JOIN conversation_participants mine
         ON mine.conversation_id = c.id
        AND mine.user_id = $1
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id
       LEFT JOIN users u
         ON u.id = cp.user_id
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error);

    res.status(500).json({
      message: 'Söhbətləri gətirmək olmadı',
    });
  }
});


// POST /api/conversations/private
// Şəxsi söhbət yarat və ya mövcud olanı tap
router.post('/private', async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const userId = (req as AuthRequest).userId!;
    const { otherUserId } = req.body ?? {};

    if (
      typeof otherUserId !== 'string' ||
      !/^[1-9]\d*$/.test(otherUserId) ||
      otherUserId === userId
    ) {
      res.status(400).json({
        message: 'İstifadəçi ID-si düzgün deyil',
      });
      return;
    }

    await client.query('BEGIN');
    transactionStarted = true;

    const otherUser = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [otherUserId]
    );

    if (otherUser.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      res.status(404).json({
        message: 'İstifadəçi tapılmadı',
      });
      return;
    }

    const sortedIds = [userId, otherUserId].sort(
      (a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0
    );

    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`private:${sortedIds[0]}:${sortedIds[1]}`]
    );

    const existing = await client.query(
      `SELECT c.id
       FROM conversations c
       INNER JOIN conversation_participants cp
         ON cp.conversation_id = c.id
       WHERE c.type = 'private'
         AND cp.user_id = ANY($1::bigint[])
       GROUP BY c.id
       HAVING COUNT(DISTINCT cp.user_id) = 2
         AND (
           SELECT COUNT(*)
           FROM conversation_participants all_cp
           WHERE all_cp.conversation_id = c.id
         ) = 2
       LIMIT 1`,
      [[userId, otherUserId]]
    );

    let conversationId: string;

    if (existing.rowCount && existing.rowCount > 0) {
      conversationId = String(existing.rows[0].id);
    } else {
      const created = await client.query(
        `INSERT INTO conversations (type, created_by)
         VALUES ('private', $1)
         RETURNING id`,
        [userId]
      );

      conversationId = String(created.rows[0].id);

      await client.query(
        `INSERT INTO conversation_participants
          (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId, otherUserId]
      );
    }

    const result = await client.query(
      `SELECT
         c.id::text AS id,
         c.type,
         c.title,
         c.created_by::text AS "createdBy",
         c.created_at AS "createdAt",
         c.updated_at AS "updatedAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', u.id::text,
               'name', u.name,
               'email', u.email
             )
             ORDER BY u.name
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'::json
         ) AS participants
       FROM conversations c
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id
       LEFT JOIN users u
         ON u.id = cp.user_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    res.status(200).json(result.rows[0]);

  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(console.error);
    }

    console.error('Private conversation error:', error);

    res.status(500).json({
      message: 'Şəxsi söhbət yaratmaq olmadı',
    });

  } finally {
    client.release();
  }
});


// POST /api/conversations/group
// Yeni qrup yarat
router.post('/group', async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const userId = (req as AuthRequest).userId!;
    const { title, participantIds } = req.body ?? {};

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 80 ||
      !Array.isArray(participantIds) ||
      participantIds.some(
        (id: unknown) =>
          typeof id !== 'string' ||
          !/^[1-9]\d*$/.test(id)
      )
    ) {
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

    await client.query('BEGIN');
    transactionStarted = true;

    const found = await client.query(
      `SELECT id
       FROM users
       WHERE id = ANY($1::bigint[])`,
      [ids]
    );

    if (found.rowCount !== ids.length) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      res.status(400).json({
        message: 'İştirakçılardan biri tapılmadı',
      });
      return;
    }

    const conversation = await client.query(
      `INSERT INTO conversations (type, title, created_by)
       VALUES ('group', $1, $2)
       RETURNING id`,
      [title.trim(), userId]
    );

    const conversationId = String(conversation.rows[0].id);

    const values: unknown[] = [];

    const placeholders = ids.map((id, index) => {
      values.push(conversationId, id);
      const position = index * 2;

      return `($${position + 1}, $${position + 2})`;
    });

    await client.query(
      `INSERT INTO conversation_participants
        (conversation_id, user_id)
       VALUES ${placeholders.join(', ')}`,
      values
    );

    const result = await client.query(
      `SELECT
         c.id::text AS id,
         c.type,
         c.title,
         c.created_by::text AS "createdBy",
         c.created_at AS "createdAt",
         c.updated_at AS "updatedAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', u.id::text,
               'name', u.name,
               'email', u.email
             )
             ORDER BY u.name
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'::json
         ) AS participants
       FROM conversations c
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id
       LEFT JOIN users u
         ON u.id = cp.user_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    res.status(201).json(result.rows[0]);

  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(console.error);
    }

    console.error('Group conversation error:', error);

    res.status(500).json({
      message: 'Qrup yaratmaq olmadı',
    });

  } finally {
    client.release();
  }
});

export default router;
