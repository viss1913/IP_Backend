import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTimezoneByCity, getLocalDateTime } from '../utils/timezone';

// Инициализация Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY not found in environment variables');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Генерирует контекст для AI на основе данных агента и его клиентов
 * @param agentName Имя агента
 * @param clients Список клиентов агента
 * @param city Город агента (для определения времени)
 * @returns Сгенерированный контекст от AI
 */
export async function generateAgentContext(
  agentName: string,
  clients: Array<{ firstName: string; lastName: string; middleName?: string; phone: string; status: string }>,
  city?: string | null
): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API key is not configured');
  }

  const timezone = getTimezoneByCity(city);
  const { date, time, fullDateTime } = getLocalDateTime(timezone);

  // Формируем список клиентов
  const clientsList = clients.length > 0
    ? clients.map((client, index) => {
        const fio = `${client.lastName} ${client.firstName}${client.middleName ? ' ' + client.middleName : ''}`;
        return `${index + 1}. ${fio}, телефон: ${client.phone}, статус: ${client.status}`;
      }).join('\n')
    : 'Клиентов пока нет';

  const contextPrompt = `Ты CRM агента. Агента зовут ${agentName}. Его клиенты:\n${clientsList}\n\nДай краткое описание того что нужно делать. Сейчас ${fullDateTime} (дата: ${date}, время: ${time}).`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating AI context:', error);
    // Возвращаем базовый контекст в случае ошибки
    return `Ты CRM агента. Агента зовут ${agentName}. Его клиенты:\n${clientsList}\n\nТекущее время: ${fullDateTime}. Необходимо работать с клиентами, обрабатывать заявки и поддерживать связь.`;
  }
}

/**
 * Простой запрос к AI (для будущего расширения функционала)
 */
export async function askAI(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API key is not configured');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error asking AI:', error);
    throw error;
  }
}

