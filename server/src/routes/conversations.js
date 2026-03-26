const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

const router = express.Router();
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'data', 'settings.json');

function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function getApiKey() {
  return getSettings().deepseek_api_key || '';
}

// AI style presets: each defines a persona and tone for the conversation
const AI_STYLE_PRESETS = {
  thoughtful: {
    name: '深度思考',
    prompt: '你是一位善于引导深度思考的对话伙伴。请基于用户的感想，用启发性的问题和深入的观察帮助用户探索自己的想法。你可以分析作品的主题、创作背景、艺术手法，将用户的感受与更广阔的文化和人生经验联系起来。语气温和而富有洞察力，像一位博学且善于倾听的朋友。回复要有实质内容和深度，不要只是泛泛而谈。',
    temperature: 0.7,
  },
  warm: {
    name: '温暖共情',
    prompt: '你是一位温暖、善于共情的倾听者。请认真感受用户文字中的情绪，给予真诚的回应和情感上的支持。你可以分享类似的感受、回忆相关的生活场景，让对话充满温度。不急于分析或建议，先让用户感到被理解和接纳，然后再温柔地引导更深入的表达。语气亲切自然，像在和一位懂你的老友深夜聊天。',
    temperature: 0.8,
  },
  critical: {
    name: '犀利点评',
    prompt: '你是一位有独到见解的文艺评论者。请基于用户的感想，给出有深度、有锐度的评论和延伸思考。你可以从艺术技法、叙事结构、文化语境等角度切入，提出不同视角甚至温和的反驳，引用其他作品进行对比分析，激发更深层的思考。语气直接但不刻薄，像一位犀利而有见地的书评人。观点要鲜明，论据要充分。',
    temperature: 0.6,
  },
  creative: {
    name: '自由联想',
    prompt: '你是一位富有想象力的创意伙伴。请基于用户的感想，自由地联想到其他作品、意象、故事、哲学概念或生活经验，编织出意想不到的连接。你可以跨越不同的艺术形式、时代和文化，寻找隐藏的共鸣和呼应。语气轻松有趣，像一场天马行空的头脑风暴，让人眼前一亮。',
    temperature: 0.9,
  },
  concise: {
    name: '简洁精炼',
    prompt: '你是一位言简意赅的对话者。请用精炼但有力的语言回应用户的感想，每次回复控制在三到五句话以内。一针见血，不说废话，但要有信息量和启发性，像禅宗语录般简洁有力。',
    temperature: 0.5,
  },
};

function buildSystemPrompt(card, styleKey, customPrompt) {
  const style = AI_STYLE_PRESETS[styleKey];
  const persona = styleKey === 'custom' && customPrompt ? customPrompt : (style || AI_STYLE_PRESETS.thoughtful).prompt;

  let systemContent = `${persona}\n\n用户的原始感想：\n"${card.content}"`;

  if (card.work_title) {
    const typeLabel = { music: '音乐', book: '书籍', movie: '电影' }[card.work_type] || '作品';
    systemContent += `\n\n关联作品：${typeLabel}《${card.work_title}》`;
    if (card.work_creator) systemContent += `，创作者：${card.work_creator}`;
    if (card.work_year) systemContent += `，年份：${card.work_year}`;
  }

  systemContent += '\n\n请根据对话的深度和复杂度自然地调整回复长度。简单的回应可以简短，但如果话题值得深入探讨，请充分展开你的想法，不要刻意压缩。用中文回复。';

  return systemContent;
}

function getStyleTemperature(styleKey) {
  const style = AI_STYLE_PRESETS[styleKey];
  return style ? style.temperature : 0.7;
}

// Get available AI style presets
router.get('/styles', (req, res) => {
  const styles = Object.entries(AI_STYLE_PRESETS).map(([key, val]) => ({
    key,
    name: val.name,
    description: val.prompt,
  }));
  styles.push({ key: 'custom', name: '自定义', description: '使用自定义的对话提示词' });
  res.json(styles);
});

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

// Chat: send user message, get AI response from DeepSeek (streaming SSE)
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
  const userResult = insertMsg.run(card_id, 'user', message.trim());
  const userMsg = db.prepare('SELECT * FROM conversations WHERE id = ?').get(userResult.lastInsertRowid);

  // Build conversation context using AI style
  const settings = getSettings();
  const styleKey = settings.ai_style || 'thoughtful';
  const customPrompt = settings.ai_custom_prompt || '';
  const systemContent = buildSystemPrompt(card, styleKey, customPrompt);

  // Get existing conversation history
  const history = db.prepare(
    'SELECT role, message FROM conversations WHERE card_id = ? ORDER BY created_at ASC'
  ).all(card_id);

  const apiMessages = [
    { role: 'system', content: systemContent },
    ...history.map(h => ({ role: h.role, content: h.message })),
  ];

  const temperature = getStyleTemperature(styleKey);

  // Log AI request details for debugging
  console.log('\n========== AI Chat Request ==========');
  console.log(`[AI] Card ID: ${card_id}`);
  console.log(`[AI] Style: ${styleKey} (temperature: ${temperature})`);
  console.log(`[AI] System Prompt:\n${systemContent}`);
  console.log(`[AI] Message count: ${apiMessages.length} (1 system + ${history.length} history)`);
  console.log(`[AI] User message: ${message.trim()}`);
  console.log('=====================================\n');

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send user message event first
  res.write(`data: ${JSON.stringify({ type: 'user_message', data: userMsg })}\n\n`);

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
        max_tokens: 2048,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.log(`[AI] API Error: ${response.status} - ${errBody}`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: `DeepSeek API 错误: ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    if (!fullContent) {
      console.log('[AI] Response: empty');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'DeepSeek API 返回内容为空' })}\n\n`);
      res.end();
      return;
    }

    console.log(`\n---------- AI Response ----------`);
    console.log(`[AI] Response length: ${fullContent.length} chars`);
    console.log(`[AI] Response: ${fullContent}`);
    console.log(`---------------------------------\n`);

    // Save AI response to DB
    const aiResult = insertMsg.run(card_id, 'assistant', fullContent);
    const aiMsg = db.prepare('SELECT * FROM conversations WHERE id = ?').get(aiResult.lastInsertRowid);

    // Send done event with the saved message
    res.write(`data: ${JSON.stringify({ type: 'done', data: aiMsg })}\n\n`);
    res.end();
  } catch (err) {
    console.log(`[AI] Connection error: ${err.message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', error: '无法连接 DeepSeek API' })}\n\n`);
    res.end();
  }
});

// Regenerate: delete the last AI response and generate a new one (streaming SSE)
router.post('/regenerate', async (req, res) => {
  const { card_id } = req.body;

  if (!card_id) {
    return res.status(400).json({ error: 'card_id is required' });
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

  // Find the last assistant message and delete it
  const lastAssistant = db.prepare(
    'SELECT id FROM conversations WHERE card_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1'
  ).get(card_id, 'assistant');

  const deletedId = lastAssistant?.id || null;
  if (lastAssistant) {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(lastAssistant.id);
  }

  // Build conversation context using AI style
  const settings = getSettings();
  const styleKey = settings.ai_style || 'thoughtful';
  const customPrompt = settings.ai_custom_prompt || '';
  const systemContent = buildSystemPrompt(card, styleKey, customPrompt);

  // Get remaining conversation history
  const history = db.prepare(
    'SELECT role, message FROM conversations WHERE card_id = ? ORDER BY created_at ASC'
  ).all(card_id);

  const apiMessages = [
    { role: 'system', content: systemContent },
    ...history.map(h => ({ role: h.role, content: h.message })),
  ];

  const temperature = getStyleTemperature(styleKey);

  // Log regenerate request
  console.log('\n========== AI Regenerate Request ==========');
  console.log(`[AI] Card ID: ${card_id}, Deleted msg ID: ${deletedId}`);
  console.log(`[AI] Style: ${styleKey} (temperature: ${temperature})`);
  console.log(`[AI] System Prompt:\n${systemContent}`);
  console.log(`[AI] Message count: ${apiMessages.length}`);
  console.log('============================================\n');

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send deleted_id event
  res.write(`data: ${JSON.stringify({ type: 'deleted', deleted_id: deletedId })}\n\n`);

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
        max_tokens: 2048,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.log(`[AI] Regenerate API Error: ${response.status} - ${errBody}`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: `DeepSeek API 错误: ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    if (!fullContent) {
      console.log('[AI] Regenerate response: empty');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'DeepSeek API 返回内容为空' })}\n\n`);
      res.end();
      return;
    }

    console.log(`\n---------- AI Regenerate Response ----------`);
    console.log(`[AI] Response length: ${fullContent.length} chars`);
    console.log(`[AI] Response: ${fullContent}`);
    console.log(`---------------------------------------------\n`);

    // Save new AI response
    const insertMsg = db.prepare(
      'INSERT INTO conversations (card_id, role, message) VALUES (?, ?, ?)'
    );
    const aiResult = insertMsg.run(card_id, 'assistant', fullContent);
    const aiMsg = db.prepare('SELECT * FROM conversations WHERE id = ?').get(aiResult.lastInsertRowid);

    res.write(`data: ${JSON.stringify({ type: 'done', data: aiMsg })}\n\n`);
    res.end();
  } catch (err) {
    console.log(`[AI] Regenerate connection error: ${err.message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', error: '无法连接 DeepSeek API' })}\n\n`);
    res.end();
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
