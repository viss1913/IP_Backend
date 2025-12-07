import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db';
import { generateAgentContext } from '../services/gemini';

const router = Router();

// Интерфейсы для типизации
interface SessionInput {
  idAgent: string;
  idLead?: string;
}

interface SessionRow {
  id: string;
  id_agent: string;
  id_lead: string | null;
  context_ai: string | null;
  ai_response: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SessionResponse {
  id: string;
  idAgent: string;
  idLead?: string;
  contextAi?: string;
  aiResponse?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentInfo {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  city: string | null;
}

interface ClientInfo {
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string;
  status: string;
}

// Преобразование snake_case в camelCase
function toCamelCase(row: SessionRow): SessionResponse {
  return {
    id: row.id,
    idAgent: row.id_agent,
    idLead: row.id_lead || undefined,
    contextAi: row.context_ai || undefined,
    aiResponse: row.ai_response || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /api/sessions - создание новой сессии с AI контекстом
router.post('/', async (req: Request, res: Response) => {
  try {
    const { idAgent, idLead }: SessionInput = req.body;

    // Валидация
    if (!idAgent || typeof idAgent !== 'string') {
      return res.status(400).json({ error: 'idAgent is required' });
    }

    // Проверяем существование агента
    const agent = (await dbGet(
      'SELECT id, first_name, last_name, middle_name, city FROM agents WHERE id = ?',
      [idAgent]
    )) as AgentInfo | null;

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Получаем клиентов агента
    const clients = (await dbAll(
      `SELECT first_name, last_name, middle_name, phone, status 
       FROM leads 
       WHERE id_agent = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [idAgent]
    )) as ClientInfo[];

    // Формируем имя агента
    const agentName = `${agent.last_name} ${agent.first_name}${agent.middle_name ? ' ' + agent.middle_name : ''}`;

    // Генерируем контекст через AI
    let contextAi: string;
    let aiResponse: string | null = null;

    try {
      contextAi = await generateAgentContext(
        agentName,
        clients.map(client => ({
          firstName: client.first_name,
          lastName: client.last_name,
          middleName: client.middle_name || undefined,
          phone: client.phone,
          status: client.status,
        })),
        agent.city
      );
      aiResponse = contextAi; // Сохраняем ответ AI как контекст
    } catch (error) {
      console.error('Error generating AI context:', error);
      // Если AI недоступен, создаём базовый контекст
      contextAi = `Ты CRM агента. Агента зовут ${agentName}. У агента ${clients.length} клиентов.`;
    }

    // Создание сессии
    const id = uuidv4();
    const status = 'active';
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO sessions (id, id_agent, id_lead, context_ai, ai_response, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        idAgent,
        idLead || null,
        contextAi,
        aiResponse,
        status,
        now,
        now,
      ]
    );

    // Получаем созданную сессию
    const session = (await dbGet('SELECT * FROM sessions WHERE id = ?', [id])) as SessionRow;

    res.status(201).json(toCamelCase(session));
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions - получение списка сессий
router.get('/', async (req: Request, res: Response) => {
  try {
    const { idAgent, status, limit, offset } = req.query;

    let query = 'SELECT * FROM sessions';
    const params: any[] = [];
    const conditions: string[] = [];

    if (idAgent) {
      conditions.push('id_agent = ?');
      params.push(idAgent);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
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

    const rows = (await dbAll(query, params)) as SessionRow[];
    const sessions = rows.map(toCamelCase);

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/:id - получение сессии по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = (await dbGet('SELECT * FROM sessions WHERE id = ?', [id])) as SessionRow | null;

    if (!row) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(toCamelCase(row));
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/sessions/:id - обновление сессии
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, idLead } = req.body;

    // Проверяем существование сессии
    const existing = (await dbGet('SELECT id FROM sessions WHERE id = ?', [id])) as { id: string } | null;
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (idLead !== undefined) {
      updates.push('id_lead = ?');
      params.push(idLead || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updatedAt = new Date().toISOString();
    updates.push('updated_at = ?');
    params.push(updatedAt);
    params.push(id);

    await dbRun(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Получаем обновлённую сессию
    const row = (await dbGet('SELECT * FROM sessions WHERE id = ?', [id])) as SessionRow;
    res.json(toCamelCase(row));
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

