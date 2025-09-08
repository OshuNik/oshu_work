#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой парсер вакансий с базовыми уведомлениями
Без сложных функций извлечения данных и кнопок
"""

import asyncio
import logging
import re
import httpx
import datetime
from typing import Dict, Any, Optional, List
from telethon import TelegramClient, events
from telethon.tl.types import Message
import os
import json

# =============================================================================
# КОНФИГУРАЦИЯ
# =============================================================================

# Telegram API
API_ID = "21221734"
API_HASH = "c3a6bb45a04b2d0b98e5c45c8e6f7eca"
PHONE = "+79110241896"

# Supabase
SUPABASE_URL = "https://lwfhtwnfqmdjwzrdznvv.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Zmh0d25mcW1kandgenJkam52diIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzMzMjQxMjQyLCJleHAiOjIwNDg4MTcyNDJ9.rT9gRGQ40z6sPKJFMF5oRiJgFdT8RtVVvbKb6T4x9uE"

# Telegram Bot для уведомлений
BOT_TOKEN = '8289350418:AAFdMsPV60DLnsyGeg8GNE7-HGUPr82Oc2w'
ADMIN_USER_ID = '1521478462'

# =============================================================================
# НАСТРОЙКА ЛОГИРОВАНИЯ
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('parser.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# =============================================================================
# ПРОСТЫЕ ФУНКЦИИ УВЕДОМЛЕНИЙ
# =============================================================================

def format_simple_notification_message(vacancy_data: dict) -> str:
    """Простое форматирование сообщения о новой вакансии"""
    category = vacancy_data.get('ai_category', 'НЕ ТВОЁ')
    category_emoji = {
        'ТОЧНО ТВОЁ': '🎯',
        'МОЖЕТ БЫТЬ': '🤔',
        'НЕ ТВОЁ': '❌'
    }
    
    emoji = category_emoji.get(category, '📋')
    
    # Простое сообщение
    message = f"{emoji} <b>Новая вакансия!</b>\n\n"
    
    # Заголовок вакансии
    title = vacancy_data.get('reason') or vacancy_data.get('keyword', 'Неизвестно')
    if title:
        message += f"💼 <b>{title}</b>\n"
    
    # Компания если есть
    if vacancy_data.get('company_name'):
        message += f"🏢 {vacancy_data['company_name']}\n"
    
    # Категория
    message += f"📂 Категория: <b>{category}</b>\n"
    
    # Канал источник
    if vacancy_data.get('channel'):
        channel_name = vacancy_data['channel']
        if len(channel_name) > 30:
            channel_name = channel_name[:30] + '...'
        message += f"📡 Канал: <i>{channel_name}</i>\n"
    
    # ID вакансии
    if vacancy_data.get('vacancy_id'):
        message += f"🆔 ID: <code>{vacancy_data['vacancy_id']}</code>\n"
    
    # Время
    now = datetime.datetime.now()
    message += f"🕐 {now.strftime('%H:%M')}"
    
    # Краткий превью текста
    text = vacancy_data.get('text', '')
    if text:
        preview = re.sub(r'[#@\n\r]+', ' ', text).strip()
        if len(preview) > 150:
            preview = preview[:150] + '...'
        message += f"\n\n💬 <i>{preview}</i>"
    
    return message

async def send_simple_telegram_notification(vacancy_data: dict, user_settings: dict):
    """Отправляет простое уведомление через Telegram Bot API"""
    if not user_settings.get('notifications_enabled', False):
        log.info("Уведомления отключены в настройках пользователя")
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
        # Формируем простое сообщение
        message = format_simple_notification_message(vacancy_data)
        
        # Отправляем через Bot API
        bot_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': ADMIN_USER_ID,
            'text': message,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(bot_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                log.info(f"✅ Simple notification sent: {vacancy_data.get('reason', 'Unknown')}")
                return True
            else:
                log.error(f"❌ Bot API error: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        log.error(f"❌ Send notification error: {e}")
        return False

# =============================================================================
# ОСНОВНОЙ ПАРСЕР
# =============================================================================

class VacancyParser:
    def __init__(self):
        self.client = TelegramClient('vacancy_parser', API_ID, API_HASH)
        self.processed_messages = set()
        self.keywords = []
        self.channels = []
        self.user_settings = {
            'notifications_enabled': True,
            'notifications_category': 'all'  # all|main|maybe|other
        }
        
        # HTTP клиент для Supabase
        self.http_headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        
    async def load_keywords_and_channels(self):
        """Загружает ключевые слова и каналы из Supabase"""
        try:
            async with httpx.AsyncClient() as client:
                # Загружаем ключевые слова из настроек
                keywords_url = f"{SUPABASE_URL}/rest/v1/settings?select=keywords"
                keywords_response = await client.get(keywords_url, headers=self.http_headers)
                
                if keywords_response.status_code == 200:
                    settings_data = keywords_response.json()
                    if settings_data:
                        keywords_str = settings_data[0].get('keywords', '')
                        if keywords_str:
                            self.keywords = [kw.strip() for kw in keywords_str.split(',') if kw.strip()]
                        log.info(f"Keywords updated: {len(self.keywords)}")
                
                # Загружаем каналы
                channels_url = f"{SUPABASE_URL}/rest/v1/channels?select=channel_id&is_enabled=eq.true"
                channels_response = await client.get(channels_url, headers=self.http_headers)
                
                if channels_response.status_code == 200:
                    channels_data = channels_response.json()
                    new_channels = [str(ch['channel_id']) for ch in channels_data]
                    
                    if set(new_channels) != set(self.channels):
                        self.channels = new_channels
                        log.info(f"Channels updated: {len(self.channels)} listening.")
                    else:
                        log.info(f"Channels unchanged: {len(self.channels)} listening.")
                
                # Загружаем настройки уведомлений
                settings_url = f"{SUPABASE_URL}/rest/v1/user_settings?select=*&user_id=eq.{ADMIN_USER_ID}"
                settings_response = await client.get(settings_url, headers=self.http_headers)
                
                if settings_response.status_code == 200:
                    settings_data = settings_response.json()
                    if settings_data:
                        user_setting = settings_data[0]
                        self.user_settings = {
                            'notifications_enabled': user_setting.get('notifications_enabled', True),
                            'notifications_category': user_setting.get('notifications_category', 'all')
                        }
                        log.info(f"User settings updated: {self.user_settings}")
            
        except Exception as e:
            log.error(f"❌ Error loading data: {e}")

    def classify_vacancy(self, text: str, found_keywords: List[str]) -> str:
        """Классифицирует вакансию по категориям"""
        if not text:
            return 'НЕ ТВОЁ'
            
        text_lower = text.lower()
        
        # Высокоприоритетные ключевые слова
        high_priority = [
            'javascript', 'js', 'react', 'vue', 'angular', 'node.js', 'nodejs',
            'frontend', 'фронтенд', 'full stack', 'fullstack', 'senior',
            'высокая зарплата', 'remote', 'удаленно'
        ]
        
        # Исключающие слова  
        exclude_words = [
            'продавец', 'менеджер по продажам', 'курьер', 'водитель',
            'уборщик', 'грузчик', 'стажер', 'junior', 'джуниор'
        ]
        
        # Проверяем исключающие слова
        for word in exclude_words:
            if word in text_lower:
                return 'НЕ ТВОЁ'
        
        # Проверяем высокоприоритетные слова
        high_priority_count = sum(1 for word in high_priority if word in text_lower)
        
        if high_priority_count >= 2:
            return 'ТОЧНО ТВОЁ'
        elif high_priority_count >= 1 or len(found_keywords) >= 2:
            return 'МОЖЕТ БЫТЬ'
        else:
            return 'НЕ ТВОЁ'

    async def save_vacancy_to_db(self, vacancy_data: dict) -> bool:
        """Сохраняет вакансию в базу данных"""
        try:
            async with httpx.AsyncClient() as client:
                vacancy_url = f"{SUPABASE_URL}/rest/v1/vacancies"
                response = await client.post(vacancy_url, headers=self.http_headers, json=vacancy_data)
                
                if response.status_code in [200, 201]:
                    log.info(f"✅ Vacancy saved: {vacancy_data.get('reason', 'Unknown')}")
                    return True
                else:
                    log.error(f"❌ Failed to save vacancy: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            log.error(f"❌ Database save error: {e}")
            return False

    async def process_message(self, message: Message):
        """Обрабатывает новое сообщение"""
        if not message.text:
            return
            
        # Избегаем дубликатов
        message_id = f"{message.chat_id}_{message.id}"
        if message_id in self.processed_messages:
            return
        self.processed_messages.add(message_id)
        
        text = message.text
        chat = await message.get_chat()
        channel_name = getattr(chat, 'title', getattr(chat, 'username', 'Unknown'))
        
        # Проверяем ключевые слова
        found_keywords = []
        for keyword in self.keywords:
            if keyword.lower() in text.lower():
                found_keywords.append(keyword)
        
        if not found_keywords:
            return
            
        # Классифицируем вакансию
        ai_category = self.classify_vacancy(text, found_keywords)
        
        # Формируем данные вакансии
        vacancy_data = {
            'text': text[:2000],  # Ограничиваем длину
            'channel': channel_name,
            'keyword': ', '.join(found_keywords),
            'ai_category': ai_category,
            'reason': found_keywords[0] if found_keywords else 'Неизвестно',
            'vacancy_id': f"tg_{message.chat_id}_{message.id}",
            'message_link': f"https://t.me/c/{str(message.chat_id)[4:]}/{message.id}",
            'created_at': datetime.datetime.now().isoformat()
        }
        
        # Сохраняем в базу данных
        saved = await self.save_vacancy_to_db(vacancy_data)
        
        if saved:
            log.info(f"🔍 Found vacancy: {ai_category} | {found_keywords[0]} | {channel_name}")
            
            # Отправляем простое уведомление
            notification_sent = await send_simple_telegram_notification(vacancy_data, self.user_settings)
            
            if notification_sent:
                log.info(f"📱 Simple notification sent for: {found_keywords[0]}")
            else:
                log.warning(f"⚠️ Failed to send notification for: {found_keywords[0]}")

    async def start_parsing(self):
        """Запускает парсер"""
        log.info("🚀 Starting simple vacancy parser...")
        
        # Подключаемся к Telegram
        await self.client.start(phone=PHONE)
        log.info("✅ Telegram connection established")
        
        # Загружаем настройки
        await self.load_keywords_and_channels()
        
        # Подписываемся на каналы
        channel_entities = []
        for channel_id in self.channels:
            try:
                entity = await self.client.get_entity(int(channel_id))
                channel_entities.append(int(channel_id))
                log.info(f"✅ Subscribed to channel: {channel_id}")
            except Exception as e:
                log.error(f"❌ Failed to subscribe to {channel_id}: {e}")
        
        # Обработчик новых сообщений
        @self.client.on(events.NewMessage(chats=channel_entities))
        async def handler(event):
            await self.process_message(event.message)
        
        log.info("🎯 Simple parser started! Waiting for new messages...")
        
        # Обновляем настройки каждые 5 минут
        async def update_settings():
            while True:
                await asyncio.sleep(300)  # 5 минут
                try:
                    await self.load_keywords_and_channels()
                    log.info("🔄 Settings updated")
                except Exception as e:
                    log.error(f"❌ Settings update error: {e}")
        
        # Запускаем обновление настроек в фоне
        asyncio.create_task(update_settings())
        
        # Держим программу активной
        await self.client.run_until_disconnected()

# =============================================================================
# ЗАПУСК
# =============================================================================

async def main():
    """Главная функция"""
    parser = VacancyParser()
    try:
        await parser.start_parsing()
    except KeyboardInterrupt:
        log.info("👋 Parser stopped by user")
    except Exception as e:
        log.error(f"💥 Critical error: {e}")
    finally:
        if parser.client:
            await parser.client.disconnect()

if __name__ == "__main__":
    # Запускаем парсер
    asyncio.run(main())