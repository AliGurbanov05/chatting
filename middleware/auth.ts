import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type AuthRequest = Request & {
  userId?: string;
};

export function auth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    res.status(401).json({
      message: 'Giriş tələb olunur',
    });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    res.status(500).json({
      message: 'JWT konfiqurasiyası düzgün deyil',
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload === 'string' ||
      typeof payload.userId !== 'string' ||
      !/^[1-9]\d*$/.test(payload.userId)
    ) {
      res.status(401).json({
        message: 'Token düzgün deyil',
      });
      return;
    }

    req.userId = payload.userId;

    next();

  } catch {
    res.status(401).json({
      message: 'Token etibarsızdır və ya vaxtı bitib',
    });
  }
}
