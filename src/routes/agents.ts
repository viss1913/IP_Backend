import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { dbRun, dbGet, dbAll } from '../db';

const router = Router();

// Интерфейсы для типизации
interface AgentInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  login?: string;
  password?: string;
  website?: string;
  telegramChannel?: string;
  telegramBot?: string;
  city?: string;
  bankDetails?: string;
  referralLinks?: string[];
}

interface AgentRow {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string;
  email: string | null;
  login: string | null;
  password_hash: string | null;
  website: string | null;
  telegram_channel: string | null;
  telegram_bot: string | null;
  city: string | null;
  bank_details: string | null;
  referral_links: string | null; // JSON строка
  created_at: string;
  updated_at: string;
}

interface AgentResponse {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  login?: string;
  website?: string;
  telegramChannel?: string;
  telegramBot?: string;
  city?: string;
  bankDetails?: string;
  referralLinks?: string[];
  createdAt: string;
  updatedAt: string;
}

// Валидация телефона
function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return cleaned.length >= 10 && /^\d+$/.test(cleaned);
}

// Валидация email
function validateEmail(email: string): boolean {
  if (!email) return true; // опциональное поле
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Преобразование snake_case в camelCase
function toCamelCase(row: AgentRow): AgentResponse {
  let referralLinks: string[] | undefined = undefined;
  if (row.referral_links) {
    try {
      referralLinks = JSON.parse(row.referral_links);
    } catch (e) {
      referralLinks = [];
    }
  }

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name || undefined,
    phone: row.phone,
    email: row.email || undefined,
    login: row.login || undefined,
    website: row.website || undefined,
    telegramChannel: row.telegram_channel || undefined,
    telegramBot: row.telegram_bot || undefined,
    city: row.city || undefined,
    bankDetails: row.bank_details || undefined,
    referralLinks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /api/agents - создание нового агента
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      middleName,
      phone,
      email,
      login,
      password,
      website,
      telegramChannel,
      telegramBot,
      city,
      bankDetails,
      referralLinks,
    }: AgentInput = req.body;

    // Валидация обязательных полей
    const errors: Record<string, string> = {};

    if (!firstName || typeof firstName !== 'string' || firstName.trim() === '') {
      errors.firstName = 'First name is required';
    }

    if (!lastName || typeof lastName !== 'string' || lastName.trim() === '') {
      errors.lastName = 'Last name is required';
    }

    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      errors.phone = 'Phone is required';
    } else if (!validatePhone(phone)) {
      errors.phone = 'Invalid phone format';
    }

    if (email && !validateEmail(email)) {
      errors.email = 'Invalid email format';
    }

    if (referralLinks && !Array.isArray(referralLinks)) {
      errors.referralLinks = 'Referral links must be an array';
    }

    // Проверяем уникальность логина, если он указан
    if (login) {
      const existingLogin = await dbGet('SELECT id FROM agents WHERE login = ?', [login.trim()]);
      if (existingLogin) {
        errors.login = 'Login already exists';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Хешируем пароль, если он указан
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Создание агента
    const id = uuidv4();
    const now = new Date().toISOString();
    const referralLinksJson = referralLinks && referralLinks.length > 0 
      ? JSON.stringify(referralLinks) 
      : null;

    await dbRun(
      `INSERT INTO agents (id, first_name, last_name, middle_name, phone, email, login, password_hash, website, telegram_channel, telegram_bot, city, bank_details, referral_links, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        firstName.trim(),
        lastName.trim(),
        middleName?.trim() || null,
        phone.trim(),
        email?.trim() || null,
        login?.trim() || null,
        passwordHash,
        website?.trim() || null,
        telegramChannel?.trim() || null,
        telegramBot?.trim() || null,
        city?.trim() || null,
        bankDetails?.trim() || null,
        referralLinksJson,
        now,
        now,
      ]
    );

    // Получаем созданного агента для возврата полных данных
    const createdAgent = (await dbGet('SELECT * FROM agents WHERE id = ?', [id])) as AgentRow;

    res.status(201).json(toCamelCase(createdAgent));
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agents - получение списка агентов
router.get('/', async (req: Request, res: Response) => {
  try {
    const { city, limit, offset } = req.query;

    let query = 'SELECT * FROM agents';
    const params: any[] = [];
    const conditions: string[] = [];

    if (city) {
      conditions.push('city = ?');
      params.push(city);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query += ' LIMIT ?';
        params.push(limitNum);
      }
    }

    if (offset) {
      const offsetNum = parseInt(offset as string, 10);
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        query += ' OFFSET ?';
        params.push(offsetNum);
      }
    }

    const rows = (await dbAll(query, params)) as AgentRow[];
    const agents = rows.map(toCamelCase);

    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agents/:id - получение агента по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = (await dbGet('SELECT * FROM agents WHERE id = ?', [id])) as AgentRow | null;

    if (!row) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(toCamelCase(row));
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agents/:id - обновление агента
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      middleName,
      phone,
      email,
      website,
      telegramChannel,
      telegramBot,
      city,
      bankDetails,
      referralLinks,
    }: Partial<AgentInput> = req.body;

    // Проверяем существование агента
    const existing = (await dbGet('SELECT id FROM agents WHERE id = ?', [id])) as { id: string } | null;
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Валидация
    const errors: Record<string, string> = {};

    if (phone !== undefined && (!phone || typeof phone !== 'string' || phone.trim() === '')) {
      errors.phone = 'Phone is required';
    } else if (phone && !validatePhone(phone)) {
      errors.phone = 'Invalid phone format';
    }

    if (email !== undefined && email && !validateEmail(email)) {
      errors.email = 'Invalid email format';
    }

    if (referralLinks !== undefined && !Array.isArray(referralLinks)) {
      errors.referralLinks = 'Referral links must be an array';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Формируем запрос на обновление
    const updates: string[] = [];
    const params: any[] = [];

    if (firstName !== undefined) {
      updates.push('first_name = ?');
      params.push(firstName.trim());
    }

    if (lastName !== undefined) {
      updates.push('last_name = ?');
      params.push(lastName.trim());
    }

    if (middleName !== undefined) {
      updates.push('middle_name = ?');
      params.push(middleName?.trim() || null);
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone.trim());
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email?.trim() || null);
    }

    if (website !== undefined) {
      updates.push('website = ?');
      params.push(website?.trim() || null);
    }

    if (telegramChannel !== undefined) {
      updates.push('telegram_channel = ?');
      params.push(telegramChannel?.trim() || null);
    }

    if (telegramBot !== undefined) {
      updates.push('telegram_bot = ?');
      params.push(telegramBot?.trim() || null);
    }

    if (city !== undefined) {
      updates.push('city = ?');
      params.push(city?.trim() || null);
    }

    if (bankDetails !== undefined) {
      updates.push('bank_details = ?');
      params.push(bankDetails?.trim() || null);
    }

    if (referralLinks !== undefined) {
      updates.push('referral_links = ?');
      params.push(referralLinks && referralLinks.length > 0 ? JSON.stringify(referralLinks) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updatedAt = new Date().toISOString();
    updates.push('updated_at = ?');
    params.push(updatedAt);
    params.push(id);

    await dbRun(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Получаем обновлённого агента
    const row = (await dbGet('SELECT * FROM agents WHERE id = ?', [id])) as AgentRow;
    res.json(toCamelCase(row));
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/agents/:id - удаление агента
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Проверяем существование агента
    const existing = (await dbGet('SELECT id FROM agents WHERE id = ?', [id])) as { id: string } | null;
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    await dbRun('DELETE FROM agents WHERE id = ?', [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

