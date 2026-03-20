const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// Create a card
router.post('/', (req, res) => {
  const { content, work_id } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }

  const db = getDb();

  if (work_id != null) {
    const work = db.prepare('SELECT id FROM works WHERE id = ?').get(work_id);
    if (!work) {
      return res.status(400).json({ error: 'work_id does not exist' });
    }
  }

  const stmt = db.prepare(
    'INSERT INTO cards (content, work_id) VALUES (?, ?)'
  );
  const result = stmt.run(content.trim(), work_id ?? null);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
});

// Get card by id
router.get('/:id', (req, res) => {
  const db = getDb();
  const card = db.prepare(`
    SELECT c.*, w.title AS work_title, w.type AS work_type, w.creator AS work_creator
    FROM cards c
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!card) {
    return res.status(404).json({ error: 'card not found' });
  }

  const messageCount = db.prepare(
    'SELECT COUNT(*) AS count FROM conversations WHERE card_id = ?'
  ).get(card.id).count;

  res.json({ ...card, message_count: messageCount });
});

// List cards (newest first), with work name and conversation count
router.get('/', (req, res) => {
  const db = getDb();
  const cards = db.prepare(`
    SELECT c.*, w.title AS work_title,
      (SELECT COUNT(*) FROM conversations WHERE card_id = c.id) AS message_count
    FROM cards c
    LEFT JOIN works w ON c.work_id = w.id
    ORDER BY c.created_at DESC
  `).all();

  res.json(cards);
});

module.exports = router;
