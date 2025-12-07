import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware для проверки admin токена
 * Используется для защиты эндпоинтов создания/удаления агентов
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken) {
    // Если токен не настроен, пропускаем (для разработки)
    return next();
  }

  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!token || token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized. Admin token required.' });
  }

  next();
}

/**
 * Middleware для проверки JWT токена агента
 * Добавляет agentId в req для использования в роутах
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.replace('Bearer ', '');

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Добавляем ID агента в request для использования в роутах
    (req as any).agentId = decoded.id;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

