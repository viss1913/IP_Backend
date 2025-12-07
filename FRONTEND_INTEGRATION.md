# Интеграция фронтенда с бекендом

## 🔗 Подключение фронтенда к бекенду

### URL бекенда

**Для локальной разработки:**
```
http://localhost:3000
```

**Для продакшена (Railway):**
```
https://your-project.up.railway.app
```

## 📝 Создание заявки с фронтенда

### Эндпоинт
```
POST /api/leads
```

### Обязательные поля:
- `source` (string) - источник заявки (например: "consultation", "career", "contact")
- `name` (string) - **полное имя клиента** (будет автоматически разбито на имя/фамилию/отчество)
- `contacts` (string) - **телефон или телеграм** (например: "+7 900 000-00-00" или "@username")

### Опциональные поля:
- `preferredTime` (string) - желаемое время связи (например: "будни, вечер")
- `comment` (string) - комментарий
- `idAgent` (string, UUID) - ID агента для назначения заявки

### Альтернативный формат (для совместимости):
Можно использовать старый формат с отдельными полями:
- `firstName`, `lastName`, `middleName` - вместо `name`
- `phone` - вместо `contacts` (если это телефон)
- `telegram` - если нужно передать телеграм отдельно

### Пример запроса (JavaScript/Fetch) - Упрощённый формат:

```javascript
async function submitLead(formData) {
  const API_URL = 'https://your-project.up.railway.app/api'; // или http://localhost:3000/api для локальной разработки
  
  try {
    const response = await fetch(`${API_URL}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'consultation', // или 'career', 'contact' и т.д.
        name: formData.name, // Полное имя (например: "Иван Иванов" или "Иван Иванович Иванов")
        contacts: formData.contacts, // Телефон или @Telegram (например: "+7 900 000-00-00" или "@username")
        preferredTime: formData.preferredTime || undefined, // Например: "будни, вечер"
        comment: formData.comment || undefined,
        // idAgent: '00000000-0000-0000-0000-000000000001' // опционально, если нужно назначить конкретному агенту
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors ? JSON.stringify(errorData.errors) : 'Ошибка отправки заявки');
    }

    const result = await response.json();
    console.log('Заявка создана:', result);
    return result;
  } catch (error) {
    console.error('Ошибка:', error);
    throw error;
  }
}
```

### Пример с обработкой формы (Vanilla JS) - для вашей формы:

```html
<form id="leadForm">
  <input type="text" name="name" placeholder="Ваше имя" required>
  <input type="text" name="contacts" placeholder="Телефон или @Telegram" required>
  <input type="text" name="preferredTime" placeholder="Например: будни, вечер">
  <textarea name="comment" placeholder="Дополнительные пожелания..."></textarea>
  <button type="submit">Отправить заявку</button>
</form>

<script>
const API_URL = 'https://your-project.up.railway.app/api'; // Замените на ваш URL Railway

document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = {
    source: 'consultation', // Определите источник заявки (consultation, contact, career и т.д.)
    name: formData.get('name'), // Полное имя
    contacts: formData.get('contacts'), // Телефон или @Telegram
    preferredTime: formData.get('preferredTime') || undefined,
    comment: formData.get('comment') || undefined,
  };

  try {
    const response = await fetch(`${API_URL}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (response.ok) {
      alert('Заявка успешно отправлена!');
      e.target.reset();
    } else {
      alert('Ошибка: ' + (result.errors ? JSON.stringify(result.errors) : result.error));
    }
  } catch (error) {
    alert('Ошибка подключения к серверу');
    console.error(error);
  }
});
</script>
```

### Пример с React - для вашей формы:

```jsx
import { useState } from 'react';

const API_URL = 'https://your-project.up.railway.app/api'; // Замените на ваш URL

function LeadForm() {
  const [formData, setFormData] = useState({
    name: '',
    contacts: '',
    preferredTime: '',
    comment: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'consultation', // или другой источник
          name: formData.name,
          contacts: formData.contacts,
          preferredTime: formData.preferredTime || undefined,
          comment: formData.comment || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.errors ? JSON.stringify(result.errors) : result.error);
      }

      setSuccess(true);
      setFormData({
        name: '',
        contacts: '',
        preferredTime: '',
        comment: '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Ваше имя"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Телефон или @Telegram"
        value={formData.contacts}
        onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Например: будни, вечер"
        value={formData.preferredTime}
        onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
      />
      <textarea
        placeholder="Дополнительные пожелания..."
        value={formData.comment}
        onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Отправка...' : 'Отправить заявку'}
      </button>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">Заявка успешно отправлена!</div>}
    </form>
  );
}
```

## 🔒 CORS

CORS уже настроен на бекенде, поэтому запросы с любого домена будут работать. Если нужно ограничить доступ, можно настроить в `src/server.ts`:

```typescript
app.use(cors({
  origin: 'https://your-frontend-domain.com' // или массив доменов
}));
```

## 📋 Формат ответа

### Успешный ответ (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "new",
  "createdAt": "2025-01-07T10:21:18.000Z"
}
```

### Ошибка валидации (400):
```json
{
  "errors": {
    "firstName": "First name is required",
    "phone": "Invalid phone format"
  }
}
```

## 🎯 Источники заявок (source)

Рекомендуемые значения для поля `source`:
- `"consultation"` - консультация
- `"career"` - карьера
- `"contact"` - контакты
- `"landing"` - лендинг
- `"referral"` - реферальная ссылка
- Или любое другое значение по вашему усмотрению

## ⚙️ Настройка переменных окружения на фронте

Создайте файл `.env` (или `.env.local`) в папке фронтенда:

```env
REACT_APP_API_URL=https://your-project.up.railway.app/api
# или для других фреймворков:
VITE_API_URL=https://your-project.up.railway.app/api
NEXT_PUBLIC_API_URL=https://your-project.up.railway.app/api
```

Используйте в коде:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
```

## ✅ Проверка работы

1. Откройте консоль браузера (F12)
2. Отправьте тестовую заявку
3. Проверьте Network tab - должен быть запрос к `/api/leads` со статусом 201
4. Проверьте в админке бекенда через `GET /api/leads` - заявка должна появиться

