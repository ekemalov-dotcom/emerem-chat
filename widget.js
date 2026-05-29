(function () {
  'use strict';

  // ─── Config from <script data-*> ─────────────────────────────────────────────

  var scriptEl = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var SERVER_URL = (scriptEl.getAttribute('data-server') || '').replace(/\/$/, '');
  var BOT_NAME   = scriptEl.getAttribute('data-name')   || 'Emerem Технік';
  var BOT_COLOR  = scriptEl.getAttribute('data-color')  || '#1a56db';

  if (!SERVER_URL) {
    console.error('[EmeremWidget] data-server attribute is required');
    return;
  }

  // ─── Session ID ───────────────────────────────────────────────────────────────

  function generateId() {
    return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var sessionId = (function () {
    try {
      var stored = sessionStorage.getItem('emerem_session');
      if (stored) return stored;
    } catch (_) {}
    var id = generateId();
    try { sessionStorage.setItem('emerem_session', id); } catch (_) {}
    return id;
  })();

  // ─── CSS ──────────────────────────────────────────────────────────────────────

  var CSS = [
    '#em-widget-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:' + BOT_COLOR + ';border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:99999;transition:transform .2s}',
    '#em-widget-btn:hover{transform:scale(1.08)}',
    '#em-widget-btn svg{width:26px;height:26px;fill:#fff}',
    '#em-chat-window{position:fixed;bottom:90px;right:24px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 110px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;z-index:99998;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px}',
    '#em-chat-window.em-hidden{display:none}',
    '#em-chat-header{background:' + BOT_COLOR + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#em-chat-header .em-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#em-chat-header .em-avatar svg{width:20px;height:20px;fill:#fff}',
    '#em-chat-header .em-title{flex:1;font-weight:600;font-size:15px}',
    '#em-chat-header .em-subtitle{font-size:11px;opacity:.8;margin-top:2px}',
    '#em-close-btn{background:none;border:none;color:#fff;cursor:pointer;padding:4px;opacity:.8;line-height:1}',
    '#em-close-btn:hover{opacity:1}',
    '#em-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}',
    '#em-messages::-webkit-scrollbar{width:4px}',
    '#em-messages::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px}',
    '.em-msg{max-width:82%;word-wrap:break-word;line-height:1.5}',
    '.em-msg-bot{align-self:flex-start;background:#f3f4f6;color:#111;padding:10px 13px;border-radius:4px 14px 14px 14px}',
    '.em-msg-user{align-self:flex-end;background:' + BOT_COLOR + ';color:#fff;padding:10px 13px;border-radius:14px 4px 14px 14px}',
    '.em-msg-time{font-size:10px;opacity:.55;margin-top:4px;text-align:right}',
    '.em-msg-bot .em-msg-time{text-align:left}',
    '.em-typing{display:flex;gap:4px;padding:10px 14px;background:#f3f4f6;border-radius:4px 14px 14px 14px;width:fit-content}',
    '.em-typing span{width:7px;height:7px;background:#9ca3af;border-radius:50%;animation:em-bounce .9s infinite}',
    '.em-typing span:nth-child(2){animation-delay:.15s}',
    '.em-typing span:nth-child(3){animation-delay:.3s}',
    '@keyframes em-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}',
    '#em-input-area{display:flex;gap:8px;padding:12px;border-top:1px solid #f0f0f0;flex-shrink:0}',
    '#em-input{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:9px 12px;font-size:14px;outline:none;resize:none;height:40px;max-height:100px;overflow-y:auto;font-family:inherit;transition:border-color .2s}',
    '#em-input:focus{border-color:' + BOT_COLOR + '}',
    '#em-send-btn{width:40px;height:40px;border-radius:10px;background:' + BOT_COLOR + ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s}',
    '#em-send-btn:disabled{opacity:.5;cursor:default}',
    '#em-send-btn svg{width:18px;height:18px;fill:#fff}',
    '#em-lead-badge{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:12px;padding:8px 12px;margin:0 16px 8px;border-radius:8px;text-align:center}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ─── HTML ─────────────────────────────────────────────────────────────────────

  var chatIcon = '<svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.52 3.66 1.424 5.174L2.05 21.95a.75.75 0 0 0 .998.998l4.777-1.374A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z"/></svg>';
  var closeIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var sendIcon = '<svg viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z"/></svg>';
  var botIcon = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM3 21a1 1 0 0 1 1-1h16a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1z"/></svg>';

  // Button
  var btn = document.createElement('button');
  btn.id = 'em-widget-btn';
  btn.setAttribute('aria-label', 'Відкрити чат');
  btn.innerHTML = chatIcon;

  // Window
  var win = document.createElement('div');
  win.id = 'em-chat-window';
  win.className = 'em-hidden';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'Чат з ' + BOT_NAME);
  win.innerHTML = [
    '<div id="em-chat-header">',
      '<div class="em-avatar">' + botIcon + '</div>',
      '<div>',
        '<div class="em-title">' + escapeText(BOT_NAME) + '</div>',
        '<div class="em-subtitle">Підбір промислового обладнання</div>',
      '</div>',
      '<button id="em-close-btn" aria-label="Закрити чат">' + closeIcon + '</button>',
    '</div>',
    '<div id="em-messages" role="log" aria-live="polite"></div>',
    '<div id="em-input-area">',
      '<textarea id="em-input" placeholder="Напишіть ваше запитання..." rows="1" aria-label="Повідомлення"></textarea>',
      '<button id="em-send-btn" aria-label="Надіслати">' + sendIcon + '</button>',
    '</div>',
  ].join('');

  document.body.appendChild(btn);
  document.body.appendChild(win);

  // ─── DOM refs ─────────────────────────────────────────────────────────────────

  var messagesEl  = document.getElementById('em-messages');
  var inputEl     = document.getElementById('em-input');
  var sendBtn     = document.getElementById('em-send-btn');
  var closeBtn    = document.getElementById('em-close-btn');
  var isOpen      = false;
  var isLoading   = false;
  var greeted     = false;

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function escapeText(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function formatTime() {
    var d = new Date();
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(text, role) {
    var wrap = document.createElement('div');
    wrap.className = 'em-msg ' + (role === 'user' ? 'em-msg-user' : 'em-msg-bot');

    var content = document.createElement('div');
    content.textContent = text;

    var time = document.createElement('div');
    time.className = 'em-msg-time';
    time.textContent = formatTime();

    wrap.appendChild(content);
    wrap.appendChild(time);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'em-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    scrollBottom();
    return el;
  }

  function showLeadBadge() {
    var existing = document.getElementById('em-lead-badge');
    if (existing) return;
    var badge = document.createElement('div');
    badge.id = 'em-lead-badge';
    badge.textContent = '✅ Ваш запит прийнято. Менеджер зв\'яжеться найближчим часом!';
    // Insert before input area
    var inputArea = document.getElementById('em-input-area');
    win.insertBefore(badge, inputArea);
  }

  function setLoading(val) {
    isLoading = val;
    sendBtn.disabled = val;
    inputEl.disabled = val;
  }

  // ─── API call ────────────────────────────────────────────────────────────────

  function sendMessage(text) {
    if (!text || isLoading) return;

    addMessage(text, 'user');
    inputEl.value = '';
    inputEl.style.height = '40px';
    setLoading(true);

    var typing = showTyping();

    fetch(SERVER_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId: sessionId }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Помилка сервера'); });
        return r.json();
      })
      .then(function (data) {
        typing.remove();
        addMessage(data.response, 'bot');
        if (data.leadSaved) showLeadBadge();
      })
      .catch(function (err) {
        typing.remove();
        addMessage('Вибачте, виникла помилка. Спробуйте ще раз або зателефонуйте нам.', 'bot');
        console.error('[EmeremWidget]', err.message);
      })
      .finally(function () {
        setLoading(false);
        inputEl.focus();
      });
  }

  // ─── Greeting ────────────────────────────────────────────────────────────────

  function sendGreeting() {
    if (greeted) return;
    greeted = true;

    var typing = showTyping();
    setLoading(true);

    var greeting = 'Вітаю! 👋 Я асистент Emerem Технік. Допоможу вам підібрати насоси, компресори, генератори або інше промислове обладнання.\n\nЯк я можу вам допомогти?';

    setTimeout(function () {
      typing.remove();
      addMessage(greeting, 'bot');
      setLoading(false);
      inputEl.focus();
    }, 600);
  }

  // ─── Open / close ────────────────────────────────────────────────────────────

  function openChat() {
    isOpen = true;
    win.classList.remove('em-hidden');
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = closeIcon;
    sendGreeting();
    inputEl.focus();
  }

  function closeChat() {
    isOpen = false;
    win.classList.add('em-hidden');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = chatIcon;
  }

  btn.addEventListener('click', function () {
    isOpen ? closeChat() : openChat();
  });

  closeBtn.addEventListener('click', closeChat);

  // ─── Input ────────────────────────────────────────────────────────────────────

  inputEl.addEventListener('input', function () {
    // Auto-grow textarea
    this.style.height = '40px';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value.trim());
    }
  });

  sendBtn.addEventListener('click', function () {
    sendMessage(inputEl.value.trim());
  });

  // ─── Keyboard accessibility ───────────────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

})();
