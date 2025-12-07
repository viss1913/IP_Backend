import mysql from 'mysql2/promise';

// Проверка обязательных переменных окружения
if (!process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  throw new Error('Missing required database environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME');
}

// Конфигурация подключения к MySQL
const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Создаём пул соединений
const pool = mysql.createPool(dbConfig);

// Обёртки для удобной работы с БД
export const dbRun = async (query: string, params?: any[]): Promise<any> => {
  const [result] = await pool.execute(query, params || []);
  return result;
};

export const dbGet = async (query: string, params?: any[]): Promise<any> => {
  const [rows] = await pool.execute(query, params || []) as any[];
  return rows[0] || null;
};

export const dbAll = async (query: string, params?: any[]): Promise<any[]> => {
  const [rows] = await pool.execute(query, params || []) as any[];
  return rows;
};

// Инициализация таблицы leads
export async function initDatabase(): Promise<void> {
  try {
    // Создаём базу данных, если её нет
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await connection.end();

    // Создаём таблицу leads
    await dbRun(`
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(36) PRIMARY KEY,
        source VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        middle_name VARCHAR(255),
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        preferred_time VARCHAR(255),
        comment TEXT,
        id_agent VARCHAR(36),
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Добавляем колонку id_agent, если таблица уже существовала
    try {
      await dbRun(`ALTER TABLE leads ADD COLUMN id_agent VARCHAR(36)`);
    } catch (error: any) {
      // Игнорируем ошибку, если колонка уже существует
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }

    // Создаём таблицу agents
    await dbRun(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(36) PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        middle_name VARCHAR(255),
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        login VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        website VARCHAR(255),
        telegram VARCHAR(255),
        telegram_channel VARCHAR(255),
        telegram_bot VARCHAR(255),
        city VARCHAR(255),
        bank_details TEXT,
        referral_links JSON,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Добавляем колонку telegram, если таблица уже существовала
    try {
      await dbRun(`ALTER TABLE agents ADD COLUMN telegram VARCHAR(255)`);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }

    // Добавляем колонки login и password_hash, если таблица уже существовала
    try {
      await dbRun(`ALTER TABLE agents ADD COLUMN login VARCHAR(255) UNIQUE`);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }

    try {
      await dbRun(`ALTER TABLE agents ADD COLUMN password_hash VARCHAR(255)`);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }

    // Создаём таблицу sessions
    await dbRun(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        id_agent VARCHAR(36) NOT NULL,
        id_lead VARCHAR(36),
        context_ai TEXT,
        ai_response TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (id_agent) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (id_lead) REFERENCES leads(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Создаём дефолтного агента, если агентов нет
    await createDefaultAgent();

    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Создание дефолтного агента при первом запуске
async function createDefaultAgent(): Promise<void> {
  try {
    // Проверяем, есть ли уже агенты
    const agents = await dbAll('SELECT id FROM agents LIMIT 1');
    
    if (agents.length === 0) {
      // Получаем данные дефолтного агента из переменных окружения или используем значения по умолчанию
      const defaultAgentId = process.env.DEFAULT_AGENT_ID || '00000000-0000-0000-0000-000000000001';
      const firstName = process.env.DEFAULT_AGENT_FIRST_NAME || 'Александр';
      const lastName = process.env.DEFAULT_AGENT_LAST_NAME || 'Виссаров';
      const middleName = process.env.DEFAULT_AGENT_MIDDLE_NAME || null;
      const phone = process.env.DEFAULT_AGENT_PHONE || '+79773575301';
      const email = process.env.DEFAULT_AGENT_EMAIL || 'vissarovav@bank-future.com';
      const city = process.env.DEFAULT_AGENT_CITY || 'Москва';
      const website = process.env.DEFAULT_AGENT_WEBSITE || 'https://www.vissarov-consulting.ru/';
      const telegram = process.env.DEFAULT_AGENT_TELEGRAM || '@alex_vitte';
      const telegramChannel = process.env.DEFAULT_AGENT_TELEGRAM_CHANNEL || 'https://t.me/vissarov_pensia';
      const telegramBot = process.env.DEFAULT_AGENT_TELEGRAM_BOT || 'https://t.me/aiAsolbot';
      
      // Логин и пароль для дефолтного агента
      const login = process.env.DEFAULT_AGENT_LOGIN || 'admin';
      const password = process.env.DEFAULT_AGENT_PASSWORD || 'admin123';
      
      // Хешируем пароль
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.default.hash(password, 10);

      // Не передаём created_at и updated_at - они заполнятся автоматически через DEFAULT CURRENT_TIMESTAMP
      await dbRun(
        `INSERT INTO agents (id, first_name, last_name, middle_name, phone, email, login, password_hash, city, website, telegram, telegram_channel, telegram_bot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          defaultAgentId,
          firstName,
          lastName,
          middleName,
          phone,
          email,
          login,
          passwordHash,
          city,
          website,
          telegram,
          telegramChannel,
          telegramBot,
        ]
      );

      console.log(`Default agent created: ${lastName} ${firstName} (ID: ${defaultAgentId})`);
      console.log(`Login: ${login}, Password: ${password}`);
      console.log(`Email: ${email}, Phone: ${phone}`);
      console.log(`Website: ${website}`);
      console.log(`Telegram: ${telegram}, Channel: ${telegramChannel}, Bot: ${telegramBot}`);
      console.log('⚠️  IMPORTANT: Change default password after first login!');
    }
  } catch (error) {
    console.error('Error creating default agent:', error);
    // Не прерываем инициализацию, если не удалось создать дефолтного агента
  }
}

// Закрытие соединений с БД
export async function closeDatabase(): Promise<void> {
  await pool.end();
}
