# Emerem Технік — AI Чат-віджет

Чат-бот для сайту [emerem.ua](https://emerem.ua) на базі Claude API.  
Кваліфікує лідів (ім'я + контакт + задача) і надсилає email менеджеру при гарячому ліді.

## Стек

- **Node.js** + **Express** — сервер
- **@anthropic-ai/sdk** — Claude API (`claude-sonnet-4-6`)
- **nodemailer** — відправка email
- **Чистий JS** — віджет без залежностей

---

## Встановлення

```bash
git clone <repo>
cd emerem-chat

npm install
```

Скопіюйте `.env.example` → `.env` і заповніть змінні:

```bash
cp .env.example .env
```

Відредагуйте `.env`:

| Змінна | Опис |
|--------|------|
| `ANTHROPIC_API_KEY` | Ключ Anthropic API |
| `SMTP_HOST` | SMTP-сервер (наприклад `smtp.gmail.com`) |
| `SMTP_PORT` | Порт (зазвичай `587`) |
| `SMTP_USER` | Email відправника |
| `SMTP_PASS` | Пароль або App Password |
| `MANAGER_EMAIL` | Email, куди надсилати ліди |
| `ALLOWED_ORIGINS` | Дозволені домени CORS (або `*`) |

### Gmail App Password

1. Увімкніть 2FA в Google Account
2. Перейдіть: **Аккаунт → Безпека → Паролі застосунків**
3. Створіть пароль для "Пошта" і вставте в `SMTP_PASS`

---

## Запуск

**Розробка:**

```bash
node server.js
```

**Продакшн (з auto-restart):**

```bash
npm install -g pm2
pm2 start server.js --name emerem-chat
pm2 save
pm2 startup
```

Сервер доступний на `http://localhost:3000`.  
Перевірка: `GET http://localhost:3000/health`

---

## Вставка на сайт

Додайте перед закриваючим тегом `</body>`:

```html
<script
  src="https://your-server.com/widget.js"
  data-server="https://your-server.com"
  data-name="Emerem Технік"
  data-color="#1a56db"
></script>
```

Або роздайте `widget.js` через сам Express:

```js
// Додайте до server.js:
app.use(express.static('.'));
```

### Параметри `<script>`

| Атрибут | Опис | За замовчуванням |
|---------|------|-----------------|
| `data-server` | URL бекенду (обов'язково) | — |
| `data-name` | Назва бота в заголовку | `Emerem Технік` |
| `data-color` | Основний колір (HEX) | `#1a56db` |

---

## Як працює кваліфікація ліда

1. Бот веде природну розмову з відвідувачем
2. Поступово з'ясовує **ім'я**, **контакт** (телефон/email) і **задачу**
3. Коли всі три параметри відомі — викликає внутрішній інструмент `save_lead`
4. Менеджер отримує листа на `MANAGER_EMAIL` з деталями

Якщо відвідувач не хоче залишати контакт — бот продовжує консультувати без тиску.

---

## API

### `POST /api/chat`

```json
// Request
{ "message": "Потрібен насос для свердловини", "sessionId": "sess_abc123" }

// Response
{
  "response": "Розкажіть, яка глибина свердловини і потрібна витрата?",
  "leadSaved": false
}
```

Коли лід кваліфіковано:

```json
{ "response": "Дякуємо, Іване! Наш менеджер зв'яжеться з вами найближчим часом.", "leadSaved": true }
```

### `GET /health`

```json
{ "ok": true, "sessions": 3 }
```

---

## Структура

```
emerem-chat/
├── server.js      # Express + Claude API + email
├── widget.js      # Чат-віджет (чистий JS)
├── .env.example   # Шаблон змінних середовища
└── README.md
```

---

## Ліцензія

MIT
