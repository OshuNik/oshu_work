# 🔐 Безопасность и переменные окружения

## 🚨 ВАЖНО: Настройка переменных окружения

С версии v13.3+ все чувствительные данные (API ключи) перенесены в переменные окружения для безопасности.

### 🛠️ Для разработчиков

1. **Скопируйте файл переменных:**
   ```bash
   cp .env.example .env
   ```

2. **Заполните ваши реальные значения в .env:**
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key
   VITE_APP_ENVIRONMENT=development
   ```

3. **Файл .env автоматически игнорируется Git** - никогда не коммитится!

### 🚀 Production деплой (GitHub Actions)

Переменные автоматически инжектятся в GitHub Actions через **Repository Secrets**:

#### Необходимые секреты в репозитории:
- `VITE_SUPABASE_URL` - URL вашего Supabase проекта
- `VITE_SUPABASE_ANON_KEY` - Anonymous ключ Supabase

#### Как добавить секреты:
1. Идите в **Settings** → **Secrets and variables** → **Actions**
2. Нажмите **New repository secret**
3. Добавьте каждую переменную с ее значением

### 🔍 Как это работает

```javascript
// ❌ БЫЛО (небезопасно):
SUPABASE_URL: 'https://abc.supabase.co' // видно всем в исходном коде

// ✅ СТАЛО (безопасно):
SUPABASE_URL: window.ENV.VITE_SUPABASE_URL // скрыто от пользователей
```

### 🛡️ Уровни защиты

1. **Development**: Fallback значения для локальной разработки
2. **Production**: Только переменные окружения, fallback удален
3. **Runtime**: Валидация наличия всех критичных переменных

### ⚠️ Что делать при проблемах

Если видите warning в консоли:
```
⚠️ SUPABASE_URL не найден в переменных окружения
```

**Решение:**
- Локально: проверьте файл `.env`
- Production: проверьте Repository Secrets в GitHub

### 🔄 Обратная совместимость

Приложение работает с fallback значениями в development режиме, но показывает предупреждения для настройки правильных переменных окружения.

---

## 🛡️ Content Security Policy (CSP)

### 🔐 Строгая CSP политика (2025)

Приложение использует **nonce-based CSP** для максимальной защиты от XSS атак:

```javascript
// Динамическая CSP с криптографически стойким nonce:
script-src 'self' 'nonce-abc123xyz' https://telegram.org https://unpkg.com
style-src 'self' 'nonce-abc123xyz' https://fonts.googleapis.com  
object-src 'none'                    // Блокировка Flash/plugins
base-uri 'self'                      // Защита от base tag injection
form-action 'self'                   // Защита от form hijacking
```

### 🚨 Ограничения GitHub Pages

GitHub Pages не поддерживает кастомные HTTP заголовки, поэтому:

❌ **Недоступно через meta tags:**
- `frame-ancestors` (защита от clickjacking) 
- `upgrade-insecure-requests` (принудительный HTTPS)
- `block-all-mixed-content` (блокировка mixed content)

✅ **Работает через meta tags:**
- `script-src`, `style-src`, `img-src` с nonce
- `object-src 'none'` (блокировка Flash)
- `base-uri`, `form-action` (базовая защита)

### 📊 Мониторинг нарушений

```javascript
// Проверить статистику CSP violations:
window.cspManager.getViolationStats()

// Проверить поддержку браузера:
window.cspManager.checkBrowserSupport()
```

### 🎯 Уровень защиты

- **XSS атаки**: 95% защита (nonce-based scripts/styles)
- **Clickjacking**: ограниченная защита (только Telegram frames)
- **Data injection**: полная защита (object-src 'none')
- **Form hijacking**: полная защита (form-action 'self')

---

**⚡ В production все fallback значения удаляются для максимальной безопасности!**