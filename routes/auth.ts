
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connect';

const router = Router();

function createToken(userId: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET təyin edilməyib');
  }

  return jwt.sign({ userId }, secret, {
    expiresIn: '7d',
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 50 ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.trim().length > 255 ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 72
    ) {
      res.status(400).json({
        message: 'Ad, düzgün email və ən azı 8 simvolluq parol tələb olunur',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Email-in mövcudluğunu yoxla
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({
        message: 'Bu email artıq qeydiyyatdadır',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // İstifadəçini PostgreSQL-ə əlavə et
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = result.rows[0];

    const userId = String(user.id);

    res.status(201).json({
      token: createToken(userId),
      user: {
        id: userId,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error: any) {
    console.error('Register error:', error);

    // PostgreSQL unique constraint xətası
    if (error.code === '23505') {
      res.status(409).json({
        message: 'Bu email artıq qeydiyyatdadır',
      });
      return;
    }

    res.status(500).json({
      message: 'Qeydiyyat zamanı server xətası',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        message: 'Email və parol tələb olunur',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // İstifadəçini parol hash-i ilə birlikdə tap
    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      res.status(401).json({
        message: 'Email və ya parol yanlışdır',
      });
      return;
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      res.status(401).json({
        message: 'Email və ya parol yanlışdır',
      });
      return;
    }

    const userId = String(user.id);

    res.json({
      token: createToken(userId),
      user: {
        id: userId,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      message: 'Giriş zamanı server xətası',
    });
  }
});

export default router;
