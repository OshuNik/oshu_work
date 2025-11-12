"""
Graceful Shutdown Module - Parser HIGH #5
Корректно останавливает сервис с очисткой ресурсов
"""
import asyncio
import logging
import signal
from typing import List, Callable, Optional

logger = logging.getLogger(__name__)


class GracefulShutdownManager:
    """Управляет корректной остановкой приложения"""
    
    def __init__(self):
        self.background_tasks: List[asyncio.Task] = []
        self.pending_operations = 0
        self.shutdown_handlers: List[Callable] = []
        self._shutting_down = False
        self._max_shutdown_time = 30  # максимум 30 секунд на shutdown
    
    def register_background_task(self, task: asyncio.Task) -> None:
        """Регистрирует background task для отслеживания"""
        self.background_tasks.append(task)
        logger.debug(f"Registered background task: {task.get_name()}")
    
    def register_shutdown_handler(self, handler: Callable) -> None:
        """Регистрирует handler который будет вызван при shutdown'е"""
        self.shutdown_handlers.append(handler)
        logger.debug(f"Registered shutdown handler: {handler.__name__}")
    
    def increment_pending_operations(self) -> None:
        """Увеличивает счетчик активных операций"""
        self.pending_operations += 1
    
    def decrement_pending_operations(self) -> None:
        """Уменьшает счетчик активных операций"""
        if self.pending_operations > 0:
            self.pending_operations -= 1
    
    async def wait_for_pending_operations(self, timeout: float = 5.0) -> bool:
        """
        Ждет завершения всех активных операций.
        
        Args:
            timeout: Максимальное время ожидания в секундах
            
        Returns:
            bool: True если все операции завершились, False при timeout
        """
        start_time = asyncio.get_event_loop().time()
        
        while self.pending_operations > 0:
            elapsed = asyncio.get_event_loop().time() - start_time
            
            if elapsed > timeout:
                logger.warning(
                    f"Timeout waiting for {self.pending_operations} "
                    f"pending operations (timeout: {timeout}s)"
                )
                return False
            
            logger.debug(f"Waiting for {self.pending_operations} pending operations...")
            await asyncio.sleep(0.1)
        
        logger.info("All pending operations completed")
        return True
    
    async def cancel_background_tasks(self, timeout: float = 5.0) -> None:
        """
        Отменяет все background tasks.
        
        Args:
            timeout: Максимальное время ожидания для отмены каждого task'а
        """
        if not self.background_tasks:
            logger.debug("No background tasks to cancel")
            return
        
        logger.info(f"Cancelling {len(self.background_tasks)} background tasks...")
        
        for task in self.background_tasks:
            if not task.done():
                logger.debug(f"Cancelling task: {task.get_name()}")
                task.cancel()
        
        # Ждем завершения всех tasks
        try:
            await asyncio.wait_for(
                asyncio.gather(*self.background_tasks, return_exceptions=True),
                timeout=timeout
            )
            logger.info("All background tasks cancelled")
        except asyncio.TimeoutError:
            logger.error(f"Timeout cancelling background tasks (timeout: {timeout}s)")
        except Exception as e:
            logger.error(f"Error cancelling background tasks: {e}")
    
    async def execute_shutdown_handlers(self) -> None:
        """Выполняет все зарегистрированные shutdown handlers"""
        if not self.shutdown_handlers:
            logger.debug("No shutdown handlers to execute")
            return
        
        logger.info(f"Executing {len(self.shutdown_handlers)} shutdown handlers...")
        
        for handler in self.shutdown_handlers:
            try:
                logger.debug(f"Executing shutdown handler: {handler.__name__}")
                
                if asyncio.iscoroutinefunction(handler):
                    await handler()
                else:
                    handler()
                
                logger.debug(f"Shutdown handler completed: {handler.__name__}")
            except Exception as e:
                logger.error(f"Error in shutdown handler {handler.__name__}: {e}")
        
        logger.info("All shutdown handlers completed")
    
    async def graceful_shutdown(self) -> None:
        """
        Выполняет корректную остановку приложения.
        
        Последовательность:
        1. Выполняет все shutdown handlers
        2. Ждет завершения активных операций
        3. Отменяет background tasks
        """
        if self._shutting_down:
            logger.warning("Shutdown already in progress")
            return
        
        self._shutting_down = True
        logger.info("Starting graceful shutdown...")
        
        try:
            # Шаг 1: Выполняем handlers (например, сохранение состояния)
            await self.execute_shutdown_handlers()
            
            # Шаг 2: Ждем завершения активных операций
            await self.wait_for_pending_operations(timeout=10.0)
            
            # Шаг 3: Отменяем background tasks
            await self.cancel_background_tasks(timeout=10.0)
            
            logger.info("Graceful shutdown completed successfully")
        except Exception as e:
            logger.error(f"Error during graceful shutdown: {e}")
        finally:
            self._shutting_down = False
    
    def get_status(self) -> dict:
        """Возвращает текущий статус shutdown manager'а"""
        active_tasks = [t for t in self.background_tasks if not t.done()]
        
        return {
            'shutting_down': self._shutting_down,
            'pending_operations': self.pending_operations,
            'background_tasks': len(self.background_tasks),
            'active_tasks': len(active_tasks),
            'shutdown_handlers': len(self.shutdown_handlers)
        }


def setup_signal_handlers(shutdown_manager: GracefulShutdownManager, 
                         loop: asyncio.AbstractEventLoop) -> None:
    """
    Устанавливает обработчики сигналов для graceful shutdown.
    
    Args:
        shutdown_manager: Инстанс GracefulShutdownManager
        loop: asyncio event loop
    """
    def handle_signal(signame):
        logger.info(f"Received signal {signame}, initiating graceful shutdown...")
        
        # Создаем task для graceful shutdown в event loop
        asyncio.create_task(shutdown_manager.graceful_shutdown())
    
    # Регистрируем обработчики для SIGTERM и SIGINT
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(
                sig,
                lambda s=sig.name: handle_signal(s)
            )
            logger.debug(f"Signal handler registered for {sig.name}")
        except Exception as e:
            logger.warning(f"Could not register signal handler for {sig.name}: {e}")
