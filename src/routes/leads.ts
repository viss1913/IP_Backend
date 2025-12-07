import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db';

const router = Router();

// Интерфейсы для типизации
interface LeadInput {
  // Старый формат (для совместимости)
  source: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phone?: string;
  email?: string;
  preferredTime?: string;
  comment?: string;
  idAgent?: string;
  // Новый упрощённый формат (для фронтенда)
  name?: string; // Полное имя (будет разбито на firstName/lastName)
  contacts?: string; // Телефон или @Telegram
  telegram?: string; // Телеграм клиента
}

interface LeadRow {
  id: string;
  source: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string | null;
  telegram: string | null;
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
  phone?: string;
  telegram?: string;
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
    phone: row.phone || undefined,
    telegram: row.telegram || undefined,
    email: row.email || undefined,
    preferredTime: row.preferred_time || undefined,
    comment: row.comment || undefined,
    idAgent: row.id_agent || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Парсинг полного имени на firstName и lastName
function parseName(fullName: string): { firstName: string; lastName: string; middleName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }
  
  // Если 3+ части, считаем что первое - имя, последнее - фамилия, остальное - отчество
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(' ') || undefined,
  };
}

// Определение типа контакта (телефон или телеграм)
function parseContacts(contacts: string): { phone?: string; telegram?: string } {
  const trimmed = contacts.trim();
  
  // Проверяем, это телеграм (начинается с @)
  if (trimmed.startsWith('@')) {
    return { telegram: trimmed };
  }
  
  // Проверяем, это ссылка на телеграм
  if (trimmed.includes('t.me/') || trimmed.includes('telegram.me/')) {
    return { telegram: trimmed };
  }
  
  // Иначе считаем телефоном
  return { phone: trimmed };
}

// POST /api/leads - создание новой заявки
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      source, 
      // Старый формат
      firstName: oldFirstName, 
      lastName: oldLastName, 
      middleName, 
      phone: oldPhone, 
      email, 
      preferredTime, 
      comment, 
      idAgent,
      // Новый упрощённый формат
      name,
      contacts,
      telegram: directTelegram,
    }: LeadInput = req.body;

    // Валидация обязательных полей
    const errors: Record<string, string> = {};

    if (!source || typeof source !== 'string' || source.trim() === '') {
      errors.source = 'Source is required';
    }

    // Обработка имени: поддерживаем оба формата
    let firstName: string = '';
    let lastName: string = '';
    let finalMiddleName: string | undefined = middleName;
    
    if (name) {
      // Новый формат: парсим полное имя
      const parsed = parseName(name);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
      if (parsed.middleName && !finalMiddleName) {
        finalMiddleName = parsed.middleName;
      }
    } else if (oldFirstName && oldLastName) {
      // Старый формат
      firstName = oldFirstName;
      lastName = oldLastName;
    } else {
      errors.name = 'Name is required (use "name" or "firstName" + "lastName")';
    }

    if (!firstName || firstName.trim() === '') {
      errors.firstName = 'First name is required';
    }

    if (!lastName || lastName.trim() === '') {
      errors.lastName = 'Last name is required';
    }

    // Обработка контактов: телефон или телеграм
    let phone: string | undefined;
    let telegram: string | undefined;

    if (contacts) {
      // Новый формат: определяем тип контакта
      const parsed = parseContacts(contacts);
      phone = parsed.phone;
      telegram = parsed.telegram;
    } else if (directTelegram) {
      // Прямая передача телеграма
      telegram = directTelegram;
    } else if (oldPhone) {
      // Старый формат
      phone = oldPhone;
    }

    // Проверяем, что есть хотя бы один контакт (телефон или телеграм)
    if (!phone && !telegram) {
      errors.contacts = 'Phone or Telegram contact is required';
    }

    // Валидация телефона, если передан
    if (phone && !validatePhone(phone)) {
      errors.phone = 'Invalid phone format';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Создание заявки
    const id = uuidv4();
    const status = 'new';

    // Не передаём created_at и updated_at - они заполнятся автоматически через DEFAULT CURRENT_TIMESTAMP
    await dbRun(
      `INSERT INTO leads (id, source, first_name, last_name, middle_name, phone, telegram, email, preferred_time, comment, id_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        source.trim(),
        firstName.trim(),
        lastName.trim(),
        finalMiddleName?.trim() || null,
        phone?.trim() || null,
        telegram?.trim() || null,
        email?.trim() || null,
        preferredTime?.trim() || null,
        comment?.trim() || null,
        idAgent?.trim() || null,
        status,
      ]
    );

    // Получаем созданную заявку для возврата полных данных
    const createdLead = (await dbGet('SELECT * FROM leads WHERE id = ?', [id])) as LeadRow;

    res.status(201).json({
      id: createdLead.id,
      status: createdLead.status,
      createdAt: createdLead.created_at,
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

    // Не передаём updated_at - он обновится автоматически через ON UPDATE CURRENT_TIMESTAMP
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

