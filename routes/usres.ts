import { Router } from 'express';
import pool from '../db/connect';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users
// Bütün istifadəçiləri gətirir (özümüzdən başqa)
router.get('/', auth, async (req, res) => {
  try {
    const currentUserId = (req as AuthRequest).userId;

    const result = await pool.query(
      `SELECT id, name, email, created_at
       FROM users
       WHERE id != $1
       ORDER BY name ASC`,
      [currentUserId]
    );

    const users = result.rows.map((user) => ({
      id: String(user.id),
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    }));

    res.json(users);

  } catch (error) {
    console.error('Users fetch error:', error);

    res.status(500).json({
      message: 'İstifadəçiləri gətirmək olmadı',
    });
  }
});

export default router;
