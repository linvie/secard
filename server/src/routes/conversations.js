const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

const router = express.Router();
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'data', 'settings.json');

function getApiKey() {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    return settings.deepseek_api_key || '';
  } catch {
    return '';
  }
}

// Create a message for a card
router.post('/', (req, res) => {
  const { card_id, role, message } = req.body;

  if (!card_id) {
    return res.status(400).json({ error: 'card_id is required' });
  }
  if (!role || !['user', 'assistant', 'system'].includes(role)) {
    return res.status(400).json({ error: 'role must be user, assistant, or system' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const db = getDb();

  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(card_id);
  if (!card) {
    return res.status(400).json({ error: 'card_id does not exist' });
  }

  const stmt = db.prepare(
    'INSERT INTO conversations (card_id, role, message) VALUES (?, ?, ?)'
  );
  const result = stmt.run(card_id, role, message.trim());

  const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// Get conversation history for a card
router.get('/card/:cardId', (req, res) => {
  const db = getDb();

  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(req.params.cardId);
  if (!card) {
    return res.status(404).json({ error: 'card not found' });
  }

  const messages = db.prepare(
    'SELECT * FROM conversations WHERE card_id = ? ORDER BY created_at ASC'
  ).all(req.params.cardId);

  res.json(messages);
});

// Chat: send user message, get AI response from DeepSeek
router.post('/chat', async (req, res) => {
  const { card_id, message } = req.body;

  if (!card_id) {
    return res.status(400).json({ error: 'card_id is required' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: '请先在设置页配置 DeepSeek API Key' });
  }

  const db = getDb();

  // Get card with associated work info
  const card = db.prepare(`
    SELECT c.*, w.title AS work_title, w.type AS work_type, w.creator AS work_creator, w.year AS work_year
    FROM cards c
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.id = ?
  `).get(card_id);

  if (!card) {
    return res.status(404).json({ error: 'card not found' });
  }

  // Save user message
  const insertMsg = db.prepare(
    'INSERT INTO conversations (card_id, role, message) VALUES (?, ?, ?)'
  );
  insertMsg.run(card_id, 'user', message.trim());

  // Build conversation context
  let systemContent = `你是一位善于引导深度思考的对话伙伴。用户记录了一段关于文艺作品的感想，请基于这段感想和用户展开对话，帮助用户深入探索自己的想法。

用户的原始感想：
"${card.content}"`;

  if (card.work_title) {
    const typeLabel = { music: '音乐', book: '书籍', movie: '电影' }[card.work_type] || '作品';
    systemContent += `\n\n关联作品：${typeLabel}《${card.work_title}》`;
    if (card.work_creator) systemContent += `，创作者：${card.work_creator}`;
    if (card.work_year) systemContent += `，年份：${card.work_year}`;
  }

  systemContent += '\n\n请用简洁、温和的语气回应，引导用户思考而非说教。回复控制在 200 字以内。';

  // Get existing conversation history
  const history = db.prepare(
    'SELECT role, message FROM conversations WHERE card_id = ? ORDER BY created_at ASC'
  ).all(card_id);

  const apiMessages = [
    { role: 'system', content: systemContent },
    ...history.map(h => ({ role: h.role, content: h.message })),
  ];

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(502).json({ error: `DeepSeek API 错误: ${response.status}`, detail: errBody });
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';

    if (!aiContent) {
      return res.status(502).json({ error: 'DeepSeek API 返回内容为空' });
    }

    // Save AI response
    const aiResult = insertMsg.run(card_id, 'assistant', aiContent);
    const aiMsg = db.prepare('SELECT * FROM conversations WHERE id = ?').get(aiResult.lastInsertRowid);

    // Get user message we just saved
    const userMsg = db.prepare(
      'SELECT * FROM conversations WHERE card_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1'
    ).get(card_id, 'user');

    res.json({ user_message: userMsg, assistant_message: aiMsg });
  } catch (err) {
    res.status(502).json({ error: '无法连接 DeepSeek API', detail: err.message });
  }
});

// Generate summary for a card's conversation
router.post('/summary/:cardId', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: '请先在设置页配置 DeepSeek API Key' });
  }

  const db = getDb();
  const cardId = req.params.cardId;

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'card not found' });
  }

  const messages = db.prepare(
    'SELECT role, message FROM conversations WHERE card_id = ? ORDER BY created_at ASC'
  ).all(cardId);

  if (messages.length === 0) {
    return res.status(400).json({ error: '没有对话记录，无法生成摘要' });
  }

  const conversationText = messages
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.message}`)
    .join('\n');

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '请用一句简洁的中文总结以下对话的核心内容和启发。不超过 50 字。只输出摘要本身，不要加引号或前缀。',
          },
          {
            role: 'user',
            content: conversationText,
          },
        ],
        max_tokens: 128,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: `DeepSeek API 错误: ${response.status}` });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '';

    if (!summary) {
      return res.status(502).json({ error: '生成摘要失败' });
    }

    // Update card with summary
    db.prepare('UPDATE cards SET ai_summary = ? WHERE id = ?').run(summary, cardId);

    res.json({ summary });
  } catch (err) {
    res.status(502).json({ error: '无法连接 DeepSeek API', detail: err.message });
  }
});

module.exports = router;
