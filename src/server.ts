import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import leadsRouter from './routes/leads';
import agentsRouter from './routes/agents';
import sessionsRouter from './routes/sessions';
import authRouter from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы (HTML страницы)
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/sessions', sessionsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Инициализация БД и запуск сервера
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

