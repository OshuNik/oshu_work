"""
Rate Limiter Module - Parser HIGH #3
Ограничивает количество запросов от одного пользователя (5 req/sec)
"""
import time
import logging
from typing import Dict, List, Tuple
from threading import Lock
from collections import defaultdict

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token Bucket Rate Limiter реализация.
    Ограничивает: 5 запросов в секунду на пользователя
    """
    
    # Стандартные параметры: 5 запросов в секунду
    DEFAULT_MAX_REQUESTS = 5
    DEFAULT_WINDOW_SECONDS = 1
    
    def __init__(self, max_requests: int = DEFAULT_MAX_REQUESTS, 
                 window_seconds: float = DEFAULT_WINDOW_SECONDS):
        """
        Инициализирует rate limiter.
        
        Args:
            max_requests: Максимум запросов за window (default: 5)
            window_seconds: Длительность окна в секундах (default: 1)
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self._lock = Lock()
        self.stats = {
            'total_checks': 0,
            'allowed': 0,
            'blocked': 0,
            'users_tracked': 0
        }
        
        logger.info(
            f"Rate Limiter initialized: "
            f"{max_requests} requests per {window_seconds} sec"
        )
    
    def check_limit(self, user_id: str) -> Tuple[bool, str]:
        """
        Проверяет превышен ли rate limit для пользователя.
        """
        with self._lock:
            self.stats['total_checks'] += 1
            user_id = str(user_id)
            current_time = time.time()
            window_start = current_time - self.window_seconds
            
            user_requests = self.requests[user_id]
            user_requests = [t for t in user_requests if t > window_start]
            self.requests[user_id] = user_requests
            
            if len(user_requests) >= self.max_requests:
                oldest_request = min(user_requests)
                retry_after = oldest_request + self.window_seconds - current_time
                retry_after_int = int(retry_after) + (1 if retry_after > int(retry_after) else 0)
                
                message = (
                    f"Rate limit exceeded for user {user_id}. "
                    f"Max {self.max_requests} requests per {self.window_seconds}s. "
                    f"Retry after {retry_after_int}s."
                )
                
                self.stats['blocked'] += 1
                logger.warning(f"Rate limit: {message}")
                return False, message
            
            user_requests.append(current_time)
            self.requests[user_id] = user_requests
            
            if len(self.requests) > self.stats['users_tracked']:
                self.stats['users_tracked'] = len(self.requests)
            
            self.stats['allowed'] += 1
            return True, f"Request allowed for user {user_id}"
    
    def get_stats(self) -> Dict:
        """Возвращает статистику"""
        with self._lock:
            total = self.stats['total_checks']
            return {
                'max_requests': self.max_requests,
                'window_seconds': self.window_seconds,
                'total_checks': total,
                'allowed': self.stats['allowed'],
                'blocked': self.stats['blocked'],
                'users': len(self.requests),
                'block_rate': (
                    self.stats['blocked'] / total * 100 if total > 0 else 0
                )
            }
