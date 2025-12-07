// Маппинг городов России на часовые пояса
const cityTimezones: Record<string, string> = {
  // Москва и область
  'Москва': 'Europe/Moscow',
  'Санкт-Петербург': 'Europe/Moscow',
  'Новосибирск': 'Asia/Novosibirsk',
  'Екатеринбург': 'Asia/Yekaterinburg',
  'Казань': 'Europe/Moscow',
  'Нижний Новгород': 'Europe/Moscow',
  'Челябинск': 'Asia/Yekaterinburg',
  'Самара': 'Europe/Samara',
  'Омск': 'Asia/Omsk',
  'Ростов-на-Дону': 'Europe/Moscow',
  'Уфа': 'Asia/Yekaterinburg',
  'Красноярск': 'Asia/Krasnoyarsk',
  'Воронеж': 'Europe/Moscow',
  'Пермь': 'Asia/Yekaterinburg',
  'Волгоград': 'Europe/Volgograd',
  'Краснодар': 'Europe/Moscow',
  'Саратов': 'Europe/Saratov',
  'Тюмень': 'Asia/Yekaterinburg',
  'Тольятти': 'Europe/Samara',
  'Ижевск': 'Europe/Samara',
  'Барнаул': 'Asia/Barnaul',
  'Ульяновск': 'Europe/Samara',
  'Иркутск': 'Asia/Irkutsk',
  'Хабаровск': 'Asia/Vladivostok',
  'Ярославль': 'Europe/Moscow',
  'Владивосток': 'Asia/Vladivostok',
  'Махачкала': 'Europe/Moscow',
  'Томск': 'Asia/Tomsk',
  'Оренбург': 'Asia/Yekaterinburg',
  'Кемерово': 'Asia/Krasnoyarsk',
  'Новокузнецк': 'Asia/Krasnoyarsk',
  'Рязань': 'Europe/Moscow',
  'Астрахань': 'Europe/Astrakhan',
  'Набережные Челны': 'Europe/Moscow',
  'Пенза': 'Europe/Moscow',
  'Липецк': 'Europe/Moscow',
  'Киров': 'Europe/Moscow',
  'Чебоксары': 'Europe/Moscow',
  'Калининград': 'Europe/Kaliningrad',
  'Тула': 'Europe/Moscow',
  'Курск': 'Europe/Moscow',
  'Сочи': 'Europe/Moscow',
  'Ставрополь': 'Europe/Moscow',
  'Улан-Удэ': 'Asia/Irkutsk',
  'Магнитогорск': 'Asia/Yekaterinburg',
  'Тверь': 'Europe/Moscow',
  'Иваново': 'Europe/Moscow',
  'Брянск': 'Europe/Moscow',
  'Белгород': 'Europe/Moscow',
  'Сургут': 'Asia/Yekaterinburg',
  'Владимир': 'Europe/Moscow',
  'Нижний Тагил': 'Asia/Yekaterinburg',
  'Архангельск': 'Europe/Moscow',
  'Чита': 'Asia/Chita',
  'Смоленск': 'Europe/Moscow',
  'Калуга': 'Europe/Moscow',
  'Саранск': 'Europe/Moscow',
  'Курган': 'Asia/Yekaterinburg',
  'Вологда': 'Europe/Moscow',
  'Орёл': 'Europe/Moscow',
  'Череповец': 'Europe/Moscow',
  'Мурманск': 'Europe/Moscow',
  'Якутск': 'Asia/Yakutsk',
  'Грозный': 'Europe/Moscow',
  'Владикавказ': 'Europe/Moscow',
  'Симферополь': 'Europe/Simferopol',
  'Севастополь': 'Europe/Simferopol',
};

/**
 * Получает часовой пояс для города
 * @param city Название города
 * @returns Часовой пояс (IANA timezone) или 'Europe/Moscow' по умолчанию
 */
export function getTimezoneByCity(city: string | null | undefined): string {
  if (!city) {
    return 'Europe/Moscow'; // По умолчанию московское время
  }

  const normalizedCity = city.trim();
  return cityTimezones[normalizedCity] || 'Europe/Moscow';
}

/**
 * Получает текущую дату и время для указанного часового пояса
 * @param timezone Часовой пояс (IANA)
 * @returns Объект с датой и временем в формате для AI
 */
export function getLocalDateTime(timezone: string): { date: string; time: string; fullDateTime: string } {
  const now = new Date();
  
  // Форматируем дату и время для указанного часового пояса
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
  });

  const parts = formatter.formatToParts(now);
  const dateObj: Record<string, string> = {};
  parts.forEach(part => {
    dateObj[part.type] = part.value;
  });

  const date = `${dateObj.weekday}, ${dateObj.day} ${dateObj.month} ${dateObj.year}`;
  const time = `${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;
  const fullDateTime = `${date}, ${time}`;

  return { date, time, fullDateTime };
}

