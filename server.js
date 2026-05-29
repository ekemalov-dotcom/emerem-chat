require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
}));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory sessions — для продакшну замінити на Redis/DB
const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 година

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ти — корпоративний AI-асистент компанії Emerem Технік (emerem.ua).
Компанія спеціалізується на постачанні та технічному обслуговуванні промислового обладнання:
насосів, компресорів, генераторів та іншого інженерного устаткування для виробництв і підприємств.

═══ ТВОЯ РОЛЬ ═══
• Допомагати клієнтам з підбором обладнання під їхню задачу
• Відповідати на технічні запитання (продуктивність, тиск, потужність тощо)
• Вести природну розмову, поступово збираючи контактну інформацію
• Коли матимеш ім'я + контакт + задачу клієнта — зберегти ліда через інструмент save_lead

═══ КВАЛІФІКАЦІЯ ЛІДА ═══
Тобі потрібно з'ясувати три речі (не одразу — у ході діалогу):
1. Ім'я клієнта
2. Контакт (телефон або email)
3. Задача / потреба (яке обладнання, для чого, які параметри)

Коли всі три пункти відомі — одразу викликай save_lead.

═══ ПРАВИЛА СПІЛКУВАННЯ ═══
• Відповідай ТІЛЬКИ українською мовою
• Будь ввічливим, лаконічним і компетентним
• Не питай всі дані одразу — веди природну консультацію
• Якщо клієнт питає про ціни — поясни, що вартість залежить від специфіки проекту,
  і запропонуй зв'язатися з менеджером (але спочатку збери контакт)
• Якщо клієнт не хоче залишати контакт — продовжуй консультувати, не наполягай`;

// ─── Claude tool: save_lead ───────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'save_lead',
    description: 'Зберегти кваліфікований лід. Викликати лише коли відомі ім\'я, контакт і задача.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Ім\'я або прізвище клієнта',
        },
        contact: {
          type: 'string',
          description: 'Телефон або email клієнта',
        },
        task: {
          type: 'string',
          description: 'Задача клієнта: яке обладнання потрібно і для чого',
        },
        summary: {
          type: 'string',
          description: 'Короткий підсумок діалогу (2–3 речення)',
        },
      },
      required: ['name', 'contact', 'task'],
    },
  },
];

// ─── Email ────────────────────────────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendLeadEmail(lead) {
  const transporter = createTransporter();
  const timestamp = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });

  await transporter.sendMail({
    from: `"Emerem Чат-бот" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: process.env.MANAGER_EMAIL,
    subject: `🔥 Новий лід з сайту: ${lead.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a56db">🔥 Новий гарячий лід — Emerem Технік</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f3f4f6">
            <td style="padding:10px;font-weight:bold;width:30%">Ім'я</td>
            <td style="padding:10px">${escapeHtml(lead.name)}</td>
          </tr>
          <tr>
            <td style="padding:10px;font-weight:bold">Контакт</td>
            <td style="padding:10px">${escapeHtml(lead.contact)}</td>
          </tr>
          <tr style="background:#f3f4f6">
            <td style="padding:10px;font-weight:bold">Задача</td>
            <td style="padding:10px">${escapeHtml(lead.task)}</td>
          </tr>
          ${lead.summary ? `
          <tr>
            <td style="padding:10px;font-weight:bold">Підсумок</td>
            <td style="padding:10px">${escapeHtml(lead.summary)}</td>
          </tr>` : ''}
        </table>
        <p style="color:#6b7280;font-size:12px;margin-top:16px">
          Отримано: ${timestamp} | Джерело: чат-віджет emerem.ua
        </p>
      </div>
    `,
    text: `Новий лід\nІм'я: ${lead.name}\nКонтакт: ${lead.contact}\nЗадача: ${lead.task}${lead.summary ? '\nПідсумок: ' + lead.summary : ''}\n\nОтримано: ${timestamp}`,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Chat endpoint ────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'message too long' });
  }

  // Get or create session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], updatedAt: Date.now(), leadSaved: false });
  }
  const session = sessions.get(sessionId);
  session.updatedAt = Date.now();

  session.history.push({ role: 'user', content: message.trim() });

  try {
    // First Claude call
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: session.history,
    });

    let replyText = '';
    let leadSaved = false;
    let lead = null;

    // Extract text and tool calls from response
    for (const block of response.content) {
      if (block.type === 'text') replyText += block.text;
    }

    const toolUseBlock = response.content.find(b => b.type === 'tool_use' && b.name === 'save_lead');

    if (toolUseBlock && !session.leadSaved) {
      lead = toolUseBlock.input;

      // Append assistant message (with tool call) to history
      session.history.push({ role: 'assistant', content: response.content });

      // Provide tool result
      session.history.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify({ status: 'ok', message: 'Лід збережено. Менеджер зв\'яжеться найближчим часом.' }),
        }],
      });

      // Second Claude call — get final reply after tool execution
      const finalResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: session.history,
      });

      replyText = '';
      for (const block of finalResponse.content) {
        if (block.type === 'text') replyText += block.text;
      }

      session.history.push({ role: 'assistant', content: finalResponse.content });
      session.leadSaved = true;
      leadSaved = true;

      // Fire-and-forget email
      sendLeadEmail(lead).catch(err =>
        console.error('[email] Failed to send lead email:', err.message)
      );

    } else {
      session.history.push({ role: 'assistant', content: response.content });
    }

    return res.json({
      response: replyText.trim(),
      leadSaved,
    });

  } catch (err) {
    // Remove the user message we just added if the call failed
    session.history.pop();
    console.error('[claude] Error:', err.message);
    return res.status(500).json({ error: 'Помилка сервера. Спробуйте ще раз.' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, sessions: sessions.size }));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Emerem chat server listening on http://localhost:${PORT}`);
});
