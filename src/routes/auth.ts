import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { dbGet } from '../db';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

interface LoginRequest {
  login: string; // email или phone
  password: string;
}

interface AgentRow {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  login: string | null;
  password_hash: string | null;
  email: string | null;
  phone: string;
}

// POST /api/auth/login - вход агента
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password }: LoginRequest = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    // Ищем агента по login (может быть email или phone)
    const agent = (await dbGet(
      'SELECT id, first_name, last_name, middle_name, login, password_hash, email, phone FROM agents WHERE login = ? OR email = ? OR phone = ?',
      [login, login, login]
    )) as AgentRow | null;

    if (!agent) {
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    // Проверяем пароль
    if (!agent.password_hash) {
      return res.status(401).json({ error: 'Password not set for this agent' });
    }

    const isPasswordValid = await bcrypt.compare(password, agent.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    // Создаём JWT токен
    const token = jwt.sign(
      {
        id: agent.id,
        login: agent.login,
        firstName: agent.first_name,
        lastName: agent.last_name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      agent: {
        id: agent.id,
        firstName: agent.first_name,
        lastName: agent.last_name,
        middleName: agent.middle_name || undefined,
        email: agent.email || undefined,
        phone: agent.phone,
        login: agent.login || undefined,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me - получение информации о текущем агенте
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Токен должен быть проверен middleware requireAuth
    const agentId = (req as any).agentId;

    const agent = (await dbGet(
      'SELECT id, first_name, last_name, middle_name, email, phone, login, city, website, telegram_channel, telegram_bot, bank_details, referral_links FROM agents WHERE id = ?',
      [agentId]
    )) as any;

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let referralLinks: string[] | undefined = undefined;
    if (agent.referral_links) {
      try {
        referralLinks = JSON.parse(agent.referral_links);
      } catch (e) {
        referralLinks = [];
      }
    }

    res.json({
      id: agent.id,
      firstName: agent.first_name,
      lastName: agent.last_name,
      middleName: agent.middle_name || undefined,
      email: agent.email || undefined,
      phone: agent.phone,
      login: agent.login || undefined,
      city: agent.city || undefined,
      website: agent.website || undefined,
      telegramChannel: agent.telegram_channel || undefined,
      telegramBot: agent.telegram_bot || undefined,
      bankDetails: agent.bank_details || undefined,
      referralLinks,
    });
  } catch (error) {
    console.error('Error fetching agent info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

