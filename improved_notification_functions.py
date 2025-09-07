# Улучшенные функции для уведомлений в парсере

import re
from typing import Dict, Any, Optional

async def send_telegram_notification(vacancy_data: dict, user_settings: dict):
    """Отправляет уведомление через Telegram Bot API с кнопками"""
    if not user_settings.get('notifications_enabled', False):
        return
    
    # Проверяем фильтр категории
    category_filter = user_settings.get('notifications_category', 'all')
    vacancy_category = vacancy_data.get('ai_category', 'НЕ ТВОЁ')
    
    if category_filter != 'all':
        category_map = {
            'main': 'ТОЧНО ТВОЁ',
            'maybe': 'МОЖЕТ БЫТЬ',
            'other': 'НЕ ТВОЁ'
        }
        if vacancy_category != category_map.get(category_filter, ''):
            log.info(f"Notification filtered: {vacancy_category} != {category_filter}")
            return
    
    try:
        # Формируем сообщение и кнопки
        message = format_enhanced_notification_message(vacancy_data)
        keyboard = create_inline_keyboard(vacancy_data)
        
        # Отправляем через Bot API
        bot_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': ADMIN_USER_ID,
            'text': message,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True,
            'reply_markup': keyboard
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(bot_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                log.info(f"✅ Enhanced notification sent: {vacancy_data.get('reason', 'Unknown')}")
            else:
                log.error(f"❌ Bot API error: {response.status_code} - {response.text}")
                
    except Exception as e:
        log.error(f"❌ Send notification error: {e}")

def extract_salary_info(text: str) -> Optional[str]:
    """Извлекает информацию о зарплате из текста"""
    salary_patterns = [
        r'(?:зарплата|зп|salary|з/п)[:\s]*([0-9\s\-—–]+(?:к|k|т|тыс|руб|rub|usd|\$|€|eur))',
        r'([0-9]+(?:\s?[0-9]+)*)\s*[-—–]\s*([0-9]+(?:\s?[0-9]+)*)\s*(?:к|k|т|тыс|руб|rub|usd|\$|€|eur)',
        r'от\s+([0-9\s]+)(?:к|k|т|тыс|руб|rub|usd|\$|€|eur)',
        r'до\s+([0-9\s]+)(?:к|k|т|тыс|руб|rub|usd|\$|€|eur)'
    ]
    
    for pattern in salary_patterns:
        match = re.search(pattern, text.lower())
        if match:
            return match.group(0).strip()
    
    return None

def extract_company_name(text: str) -> Optional[str]:
    """Пытается извлечь название компании из текста"""
    # Ищем паттерны типа "Компания ИвановИвановых", "ООО Рога и копыта"
    company_patterns = [
        r'(?:компания|фирма|организация|предприятие)\s+([А-Яа-я\w\s]+)',
        r'(?:ооо|оао|зао|ип|пао)\s+([А-Яа-я\w\s"]+)',
        r'(?:работа\s+в|вакансия\s+в|требуется\s+в)\s+([А-Яа-я\w\s]+)',
    ]
    
    for pattern in company_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            company = match.group(1).strip()
            if len(company) > 3 and len(company) < 50:  # Разумные границы
                return company
    
    return None

def extract_location_info(text: str) -> Optional[str]:
    """Извлекает информацию о локации"""
    location_patterns = [
        r'(?:москва|спб|санкт-петербург|екатеринбург|новосибирск|казань|нижний новгород|красноярск|челябинск|уфа|волгоград|пермь|воронеж)',
        r'(?:удаленно|remote|удаленная работа|на удалении)',
        r'(?:офис|в офисе|офисная работа)',
        r'(?:гибрид|гибридный график|частично удаленно)'
    ]
    
    for pattern in location_patterns:
        match = re.search(pattern, text.lower())
        if match:
            return match.group(0).capitalize()
    
    return None

def format_enhanced_notification_message(vacancy_data: dict) -> str:
    """Улучшенное форматирование сообщения о новой вакансии"""
    category = vacancy_data.get('ai_category', 'НЕ ТВОЁ')
    category_emoji = {
        'ТОЧНО ТВОЁ': '🎯',
        'МОЖЕТ БЫТЬ': '🤔',
        'НЕ ТВОЁ': '❌'
    }
    
    emoji = category_emoji.get(category, '📋')
    text = vacancy_data.get('text', '')
    
    # Заголовок с категорией
    message = f"{emoji} <b>Новая вакансия</b> • {category}\n\n"
    
    # Основной заголовок вакансии
    title = vacancy_data.get('reason') or vacancy_data.get('text_highlighted', '')
    if title:
        # Очищаем заголовок от лишних символов
        title = re.sub(r'[#@\n\r]+', ' ', title).strip()
        if len(title) > 80:
            title = title[:80] + '...'
        message += f"💼 <b>{title}</b>\n"
    
    # Пытаемся извлечь дополнительную информацию из текста
    info_added = False
    
    # Зарплата
    salary = extract_salary_info(text)
    if salary:
        message += f"💰 {salary.upper()}\n"
        info_added = True
    
    # Компания  
    company = extract_company_name(text) or vacancy_data.get('company_name', '')
    if company:
        message += f"🏢 {company}\n"
        info_added = True
    
    # Локация
    location = extract_location_info(text)
    if location:
        message += f"📍 {location}\n"
        info_added = True
    
    # Если извлекли доп информацию, добавляем разделитель
    if info_added:
        message += "\n"
    
    # Ключевое слово (самое важное!)
    if vacancy_data.get('keyword'):
        message += f"🔍 <b>Найдено:</b> <code>{vacancy_data['keyword']}</code>\n"
    
    # Канал источник
    if vacancy_data.get('channel'):
        channel_name = vacancy_data['channel']
        if len(channel_name) > 30:
            channel_name = channel_name[:30] + '...'
        message += f"📡 Канал: <i>{channel_name}</i>\n"
    
    # Время (относительное)
    import datetime
    now = datetime.datetime.now()
    message += f"🕐 {now.strftime('%H:%M')}\n"
    
    # Краткий превью текста если места мало информации
    if not info_added and text:
        preview = re.sub(r'[#@\n\r]+', ' ', text).strip()
        if len(preview) > 100:
            preview = preview[:100] + '...'
        message += f"\n💬 <i>{preview}</i>"
    
    return message

def create_inline_keyboard(vacancy_data: dict) -> dict:
    """Создает инлайн клавиатуру с полезными кнопками"""
    buttons = []
    
    # Первый ряд - основные действия
    row1 = []
    
    # Кнопка "Открыть Mini App"
    row1.append({
        'text': '📱 Mini App',
        'web_app': {'url': 'https://oshunik.github.io/oshu_work/'}
    })
    
    # Кнопка "Добавить в избранное" (callback для будущего функционала)
    row1.append({
        'text': '⭐ В избранное',
        'callback_data': f"fav_{vacancy_data.get('vacancy_id', 'new')}"
    })
    
    buttons.append(row1)
    
    # Второй ряд - ссылки и поиск
    row2 = []
    
    # Кнопка "Перейти к сообщению" 
    if vacancy_data.get('message_link'):
        row2.append({
            'text': '🔗 К сообщению',
            'url': vacancy_data['message_link']
        })
    
    # Кнопка "Найти похожие"
    if vacancy_data.get('keyword'):
        # URL encode для поискового запроса
        import urllib.parse
        search_query = urllib.parse.quote(vacancy_data['keyword'])
        search_url = f"https://oshunik.github.io/oshu_work/?search={search_query}"
        row2.append({
            'text': '🔍 Похожие',
            'url': search_url
        })
    
    if row2:
        buttons.append(row2)
    
    # Третий ряд - действия с уведомлениями
    row3 = []
    
    # Кнопка "Настройки уведомлений"
    row3.append({
        'text': '⚙️ Настройки',
        'url': 'https://oshunik.github.io/oshu_work/settings.html'
    })
    
    # Кнопка "Отключить на час" (callback)
    row3.append({
        'text': '🔕 Отключить на 1ч',
        'callback_data': 'mute_1h'
    })
    
    buttons.append(row3)
    
    return {
        'inline_keyboard': buttons
    }

# Дополнительная функция для обработки callback кнопок (добавить в основной код парсера)
async def handle_callback_query(update: dict):
    """Обрабатывает нажатия на inline кнопки"""
    callback_query = update.get('callback_query')
    if not callback_query:
        return
    
    data = callback_query.get('data', '')
    chat_id = callback_query['from']['id']
    message_id = callback_query['message']['message_id']
    
    try:
        if data.startswith('fav_'):
            # Обработка добавления в избранное
            vacancy_id = data.replace('fav_', '')
            # TODO: Добавить в Supabase таблицу favorites
            
            # Отвечаем пользователю
            answer_text = "⭐ Добавлено в избранное!"
            
        elif data == 'mute_1h':
            # Отключение уведомлений на час
            # TODO: Сохранить время отключения в настройках
            answer_text = "🔕 Уведомления отключены на 1 час"
            
        else:
            answer_text = "Функция в разработке"
        
        # Отправляем ответ на callback
        answer_url = f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery"
        payload = {
            'callback_query_id': callback_query['id'],
            'text': answer_text,
            'show_alert': False
        }
        
        async with httpx.AsyncClient() as client:
            await client.post(answer_url, json=payload, timeout=10)
            
        log.info(f"✅ Callback handled: {data}")
        
    except Exception as e:
        log.error(f"❌ Callback error: {e}")

# Для webhook обработки (если захотите в будущем):
"""
@app.post("/webhook")
async def telegram_webhook(update: dict):
    # Обрабатываем callback queries от кнопок
    if 'callback_query' in update:
        await handle_callback_query(update)
    
    return {"ok": True}
"""