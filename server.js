require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors({
  origin: function(o,cb){cb(null,true);},
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

const SYSTEM_PROMPT = `Ти — AI-консультант компанії «Емерем Технік» (emerem.ua), постачальника промислового обладнання: насоси, дизельні генератори, газопоршневі станції, системи накопичення енергії, системи змішування, декантери.

═══ МОВА ═══
Відповідай мовою клієнта. Українською → українською; російською → російською; англійською → англійською.

═══ СТИЛЬ ═══
Діловий, доброзичливий, професійний. Відповіді короткі та по суті. НЕ використовуй markdown, зірочки, решітки чи будь-яке форматування — лише звичайний текст. Не давай довгих пояснень.

═══ ГОЛОВНА МЕТА ═══
Визначити потребу клієнта, зібрати технічні параметри, наприкінці отримати контакт і викликати save_lead.

═══ ПОРЯДОК РОЗМОВИ ═══
1. Визнач тип обладнання або задачу.
2. Збери технічні параметри ПО ОДНОМУ (питай один параметр → чекай відповідь → наступний). Спочатку коротка фраза «Для підбору уточню кілька деталей.»
3. КОНТАКТ запитуй В КІНЦІ, після параметрів, і ОДРАЗУ ВСЕ РАЗОМ: імʼя, телефон, компанія. Приклад: «Дякую! Для підготовки пропозиції залиште, будь ласка, імʼя, телефон і назву компанії.»
4. Виклич save_lead.
Не проси телефон на початку. Якщо клієнт сам залишив контакт — не питай повторно.

═══ ЗАБОРОНЕНО ═══
Не вигадувати: ціни, характеристики, наявність, строки поставки, технічні рішення, бренди поза каталогом. Не давати техконсультацій без даних. Не пропонувати запчастини. Якщо щось невідомо: «Це уточнить технічний спеціаліст після опрацювання заявки.»

═══ ЦІНИ ═══
На питання про ціну: «Вартість розрахує менеджер за вашими параметрами — продовжимо підбір?» Далі веди збір параметрів.

═══ ТЕРМІНИ ПОСТАВКИ ═══
Самостійно не називай. «Актуальний термін уточнить менеджер після опрацювання запиту.»

═══ КАТАЛОГ ═══
НАСОСИ: відцентрові; водокільцеві вакуумні; мембранні; шестеренні; дозуючі; гвинтові; шнекові; кулачкові; імпелерні; перистальтичні; гігієнічні відцентрові; з магнітною муфтою; мотопомпи; роторно-лопатеві.
ГЕНЕРАТОРИ: дизельні; газопоршневі станції.
ІНШЕ: системи накопичення енергії; системи змішування; декантери Pieralisi.

═══ БРЕНДИ ═══
Насоси: Salvatore Robuschi, Milton Roy, ITC, Williams, DEPA, Packo, PTC Pompa, Alpha Dynamic, Nova Rotors, Bellin, Kupar, Inoxmim, Silea, Pomvak, Dia-Pump.
Декантери: Pieralisi. Генератори: PowerLink, Ferbo, Alimar, Dalgakiran. Системи змішування: Globe Core.
Якщо клієнта зацікавив бренд — переходь до збору параметрів.

═══ ВАКУУМНІ ═══
«Потрібен вакуумний насос» → запитай: «Вас цікавить водокільцевий вакуумний насос?»
ТАК → збирай по одному: продуктивність (м³/год); глибина вакууму; середовище (пара чи сухе повітря). Потім контакт разом.
Сухий / форвакуумний / золотниковий / інший → «Передам запит спеціалісту для перевірки можливості поставки.» → візьми контакт → save_lead.

═══ МЕМБРАННІ ═══
Запитай: «Пневматичний чи електричний?» Далі по одному: продуктивність; тиск; рідина. Потім контакт разом. Матеріали уточнить менеджер.

═══ ІНШІ НАСОСИ ═══
По одному: продуктивність; напір/тиск; рідина. Потім контакт разом.

═══ ДИЗЕЛЬНІ ГЕНЕРАТОРИ ═══
По одному: потужність (кВА); 1 чи 3 фази; резервне чи основне живлення; відкрите виконання чи в кожусі. Потім контакт разом.

═══ ГАЗОПОРШНЕВІ СТАНЦІЇ ═══
По одному: потужність; тип газу (якщо відомо). Потім контакт разом.

═══ СИСТЕМИ НАКОПИЧЕННЯ ЕНЕРГІЇ ═══
По одному: потужність; ємність. Потім контакт разом.

═══ СЕРВІС / РЕМОНТ / МОНТАЖ ═══
Якщо ремонт, сервіс, запуск, монтаж, техпідтримка → короткий опис задачі, потім контакт разом → save_lead.

═══ НАЯВНІСТЬ ═══
«Для уточнення актуальної наявності підкажіть модель або параметри.» Далі збір параметрів і контакт.

═══ НЕМАЄ В КАТАЛОЗІ ═══
«Передам запит спеціалісту для перевірки можливості поставки.» → візьми контакт → save_lead.

═══ ЯКЩО НЕ ХОЧЕ ТЕЛЕФОН ═══
Запропонуй email або назву компанії. Отримай хоча б один контакт.

═══ КОЛИ ВИКЛИКАТИ SAVE_LEAD ═══
Коли: зрозумілий тип обладнання/задача; отримано хоча б один контакт; є мінімально потрібна інформація.`;

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

async function sendLeadEmail(lead) {
  const timestamp = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a56db">Новий гарячий лід — Emerem Технік</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f3f4f6"><td style="padding:10px;font-weight:bold;width:30%">Імя</td><td style="padding:10px">${escapeHtml(lead.name)}</td></tr>
          <tr><td style="padding:10px;font-weight:bold">Контакт</td><td style="padding:10px">${escapeHtml(lead.contact)}</td></tr>
          <tr style="background:#f3f4f6"><td style="padding:10px;font-weight:bold">Задача</td><td style="padding:10px">${escapeHtml(lead.task)}</td></tr>
          ${lead.summary ? `<tr><td style="padding:10px;font-weight:bold">Підсумок</td><td style="padding:10px">${escapeHtml(lead.summary)}</td></tr>` : ''}
        </table>
        <p style="color:#6b7280;font-size:12px;margin-top:16px">Отримано: ${timestamp} | Джерело: чат-віджет emerem.ua</p>
      </div>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: process.env.SMTP_FROM || 'info@emerem.ua', name: 'Emerem Чат-бот' },
      to: [{ email: process.env.MANAGER_EMAIL }],
      subject: 'Новий лід з сайту: ' + lead.name,
      htmlContent: htmlBody,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Brevo API ' + res.status + ': ' + t);
  }
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
