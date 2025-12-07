import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db';

const router = Router();

// Интерфейсы для типизации
interface LeadInput {
  source: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  preferredTime?: string;
  comment?: string;
  idAgent?: string;
}

interface LeadRow {
  id: string;
  source: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string;
  email: string | null;
  preferred_time: string | null;
  comment: string | null;
  id_agent: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface LeadResponse {
  id: string;
  source: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  preferredTime?: string;
  comment?: string;
  idAgent?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Валидация телефона (базовая проверка)
function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Убираем пробелы, дефисы, скобки и проверяем наличие цифр
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return cleaned.length >= 10 && /^\d+$/.test(cleaned);
}

// Преобразование snake_case в camelCase
function toCamelCase(row: LeadRow): LeadResponse {
  return {
    id: row.id,
    source: row.source,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name || undefined,
    phone: row.phone,
    email: row.email || undefined,
    preferredTime: row.preferred_time || undefined,
    comment: row.comment || undefined,
    idAgent: row.id_agent || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /api/leads - создание новой заявки
router.post('/', async (req: Request, res: Response) => {
  try {
    const { source, firstName, lastName, middleName, phone, email, preferredTime, comment, idAgent }: LeadInput = req.body;

    // Валидация обязательных полей
    const errors: Record<string, string> = {};

    if (!source || typeof source !== 'string' || source.trim() === '') {
      errors.source = 'Source is required';
    }

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

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Создание заявки
    const id = uuidv4();
    const status = 'new';
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO leads (id, source, first_name, last_name, middle_name, phone, email, preferred_time, comment, id_agent, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        source.trim(),
        firstName.trim(),
        lastName.trim(),
        middleName?.trim() || null,
        phone.trim(),
        email?.trim() || null,
        preferredTime?.trim() || null,
        comment?.trim() || null,
        idAgent?.trim() || null,
        status,
        now,
        now,
      ]
    );

    res.status(201).json({
      id,
      status,
      createdAt: now,
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leads - получение списка заявок
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, idAgent, limit, offset } = req.query;

    let query = 'SELECT * FROM leads';
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (idAgent) {
      conditions.push('id_agent = ?');
      params.push(idAgent);
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

    const rows = (await dbAll(query, params)) as LeadRow[];
    const leads = rows.map(toCamelCase);

    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/leads/:id - обновление заявки (статус и/или idAgent)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, idAgent } = req.body;

    if (!status && idAgent === undefined) {
      return res.status(400).json({ error: 'At least status or idAgent must be provided' });
    }

    const updatedAt = new Date().toISOString();
    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      if (typeof status !== 'string') {
        return res.status(400).json({ error: 'Status must be a string' });
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (idAgent !== undefined) {
      updates.push('id_agent = ?');
      params.push(idAgent?.trim() || null);
    }

    updates.push('updated_at = ?');
    params.push(updatedAt);
    params.push(id);

    await dbRun(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Получаем обновлённую заявку
    const row = (await dbGet('SELECT * FROM leads WHERE id = ?', [id])) as LeadRow | undefined;

    if (!row) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(toCamelCase(row));
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

