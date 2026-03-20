const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

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

module.exports = router;
