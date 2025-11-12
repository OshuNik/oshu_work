"""
Input Validation Module - Parser HIGH #1
Валидирует входящие сообщения для предотвращения XSS, DoS и других атак
"""
import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


class MessageValidator:
    """Валидирует сообщения согласно требованиям безопасности"""
    
    # Максимальная длина сообщения (4000 символов)
    MAX_MESSAGE_LENGTH = 4000
    
    # Минимальная длина (не пусто и не только пробелы)
    MIN_MESSAGE_LENGTH = 1
    
    @staticmethod
    def validate_message(message: str) -> Tuple[bool, str]:
        """
        Валидирует сообщение. Возвращает (is_valid, error_message).
        
        Проверяет:
        - Тип данных (должна быть строка)
        - Длина (1-4000 символов)
        - Отсутствие контрольных символов
        - Не только пробелы
        
        Args:
            message: Текст сообщения для валидации
            
        Returns:
            Tuple[bool, str]: (is_valid, error_message)
        """
        
        # Проверка типа данных
        if not isinstance(message, str):
            return False, f"Message must be string, got {type(message).__name__}"
        
        # Проверка на пустоту
        if len(message) == 0:
            return False, "Message cannot be empty"
        
        # Проверка максимальной длины
        if len(message) > MessageValidator.MAX_MESSAGE_LENGTH:
            return False, f"Message exceeds max length of {MessageValidator.MAX_MESSAGE_LENGTH} characters"
        
        # Проверка на контрольные символы (включая null byte)
        if '\x00' in message:
            return False, "Message contains null byte (\x00)"
        
        # Проверка на другие контрольные символы (ASCII < 32, кроме пробела, табуляции, новой строки)
        for i, char in enumerate(message):
            char_code = ord(char)
            # Разрешаем: 9 (tab), 10 (LF), 11 (VT), 12 (FF), 13 (CR), 32+ (printable)
            if char_code < 32 and char_code not in (9, 10, 11, 12, 13):
                return False, f"Message contains invalid control character at position {i} (ASCII {char_code})"
        
        # Проверка на только пробелы/whitespace
        if message.strip() == '':
            return False, "Message cannot contain only whitespace"
        
        return True, ""
    
    @staticmethod
    def sanitize_message(message: str) -> str:
        """
        Очищает сообщение от потенциально опасных символов.
        Не отбраковывает сообщение, а очищает его.
        
        Args:
            message: Исходное сообщение
            
        Returns:
            str: Очищенное сообщение
        """
        if not isinstance(message, str):
            return ""
        
        # Удаляем null bytes
        message = message.replace('\x00', '')
        
        # Удаляем контрольные символы (кроме стандартных whitespace)
        message = ''.join(
            char if ord(char) >= 32 or char in '\t\n\r\v\f' 
            else '' 
            for char in message
        )
        
        # Стриптим leading/trailing whitespace но сохраняем структуру
        return message.strip()


class RateLimitValidator:
    """Валидирует rate limit параметры"""
    
    @staticmethod
    def validate_rate_limit_config(max_requests: int, window_seconds: int) -> Tuple[bool, str]:
        """
        Валидирует конфигурацию rate limiting
        
        Args:
            max_requests: Максимум запросов за window
            window_seconds: Длительность окна в секундах
            
        Returns:
            Tuple[bool, str]: (is_valid, error_message)
        """
        if not isinstance(max_requests, int) or max_requests <= 0:
            return False, "max_requests must be positive integer"
        
        if not isinstance(window_seconds, int) or window_seconds <= 0:
            return False, "window_seconds must be positive integer"
        
        if max_requests > 10000:
            return False, "max_requests exceeds reasonable limit of 10000"
        
        if window_seconds > 86400:  # 24 часа
            return False, "window_seconds exceeds 24 hours"
        
        return True, ""


class UserIdValidator:
    """Валидирует user IDs для rate limiting"""
    
    VALID_USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_\-]{1,50}$')
    
    @staticmethod
    def validate_user_id(user_id: str) -> Tuple[bool, str]:
        """
        Валидирует user ID
        
        Args:
            user_id: ID пользователя (может быть Telegram ID или username)
            
        Returns:
            Tuple[bool, str]: (is_valid, error_message)
        """
        if not isinstance(user_id, str):
            user_id = str(user_id)
        
        if len(user_id) == 0:
            return False, "user_id cannot be empty"
        
        if len(user_id) > 50:
            return False, "user_id is too long (max 50 chars)"
        
        # Проверяем что это либо число, либо строка с буквами/цифрами/подчеркиванием/дефисом
        if not (user_id.isdigit() or UserIdValidator.VALID_USER_ID_PATTERN.match(user_id)):
            return False, "user_id contains invalid characters"
        
        return True, ""
