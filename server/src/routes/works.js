const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// Create a work
router.post('/', (req, res) => {
  const { type, title, creator, year, cover_url, external_id, external_source } = req.body;

  if (!type || !['music', 'book', 'movie'].includes(type)) {
    return res.status(400).json({ error: 'type must be one of: music, book, movie' });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO works (type, title, creator, year, cover_url, external_id, external_source) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    type,
    title.trim(),
    creator?.trim() || null,
    year ?? null,
    cover_url?.trim() || null,
    external_id?.trim() || null,
    external_source?.trim() || null
  );

  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(work);
});

// List works
router.get('/', (req, res) => {
  const db = getDb();
  const { type, q } = req.query;

  let sql = 'SELECT * FROM works';
  const conditions = [];
  const params = [];

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (q) {
    conditions.push('(title LIKE ? OR creator LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  const works = db.prepare(sql).all(...params);
  res.json(works);
});

// Search external sources (MusicBrainz / Open Library)
router.get('/search', async (req, res) => {
  const { type, q } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'q (query) is required' });
  }
  if (!type || !['music', 'book'].includes(type)) {
    return res.status(400).json({ error: 'type must be music or book' });
  }

  try {
    const query = q.trim();
    let results;
    if (type === 'music') {
      results = await searchMusicBrainz(query);
    } else {
      results = await searchOpenLibrary(query);
    }
    res.json(rankResults(results, query));
  } catch (err) {
    console.error('External search error:', err);
    res.status(502).json({ error: 'External search failed' });
  }
});

// Get work by id (with card count)
router.get('/:id', (req, res) => {
  const db = getDb();
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id);
  if (!work) {
    return res.status(404).json({ error: 'work not found' });
  }

  const cardCount = db.prepare(
    'SELECT COUNT(*) AS count FROM cards WHERE work_id = ?'
  ).get(work.id).count;

  res.json({ ...work, card_count: cardCount });
});

// Update a work
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'work not found' });
  }

  const { type, title, creator, year, cover_url, external_id, external_source } = req.body;

  if (type && !['music', 'book', 'movie'].includes(type)) {
    return res.status(400).json({ error: 'type must be one of: music, book, movie' });
  }

  const updated = {
    type: type || existing.type,
    title: title?.trim() || existing.title,
    creator: creator !== undefined ? (creator?.trim() || null) : existing.creator,
    year: year !== undefined ? year : existing.year,
    cover_url: cover_url !== undefined ? (cover_url?.trim() || null) : existing.cover_url,
    external_id: external_id !== undefined ? (external_id?.trim() || null) : existing.external_id,
    external_source: external_source !== undefined ? (external_source?.trim() || null) : existing.external_source,
  };

  db.prepare(
    'UPDATE works SET type = ?, title = ?, creator = ?, year = ?, cover_url = ?, external_id = ?, external_source = ? WHERE id = ?'
  ).run(updated.type, updated.title, updated.creator, updated.year, updated.cover_url, updated.external_id, updated.external_source, req.params.id);

  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id);
  res.json(work);
});

// Delete a work
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'work not found' });
  }

  db.prepare('DELETE FROM works WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Helpers ---

function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function computeRelevanceScore(item, query) {
  let score = 0;
  const q = query.toLowerCase();
  const title = (item.title || '').toLowerCase();
  const creator = (item.creator || '').toLowerCase();

  // Title matching
  if (title === q) {
    score += 100;
  } else if (title.startsWith(q)) {
    score += 60;
  } else if (title.includes(q)) {
    score += 30;
  }

  // Chinese result boost when query contains Chinese
  if (containsChinese(query) && containsChinese(item.title || '')) {
    score += 40;
  }

  // Creator matching
  if (creator.includes(q)) {
    score += 20;
  }

  // Metadata completeness
  if (item.cover_url) score += 5;
  if (item.year) score += 3;
  if (item.creator) score += 3;

  return score;
}

function rankResults(results, query) {
  return results
    .map((item) => ({ ...item, _score: computeRelevanceScore(item, query) }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...item }) => item);
}

// --- External search helpers ---

// MusicBrainz rate limiting: minimum 1 second between requests
let lastMBRequestTime = 0;

async function fetchCoverArt(mbid) {
  try {
    const resp = await fetch(
      `https://coverartarchive.org/release-group/${mbid}/front-250`,
      { redirect: 'manual' }
    );
    if (resp.status === 307 || resp.status === 302) {
      return resp.headers.get('location');
    }
    return null;
  } catch {
    return null;
  }
}

async function searchMusicBrainz(query) {
  // Enforce rate limit
  const now = Date.now();
  const elapsed = now - lastMBRequestTime;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastMBRequestTime = Date.now();

  const luceneQuery = `releasegroup:${query} AND primarytype:album`;
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=10&dismax=true`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SikaApp/1.0 (local)' },
  });
  if (!resp.ok) {
    throw new Error(`MusicBrainz returned ${resp.status}`);
  }
  const data = await resp.json();

  const results = (data['release-groups'] || []).map((rg) => ({
    external_id: rg.id,
    title: rg.title,
    creator: rg['artist-credit']?.map((ac) => ac.name).join(', ') || null,
    year: rg['first-release-date']?.slice(0, 4) ? parseInt(rg['first-release-date'].slice(0, 4), 10) || null : null,
    cover_url: null,
    external_source: 'musicbrainz',
    type: 'music',
  }));

  // Fetch covers in parallel from Cover Art Archive
  const coverPromises = results.map((r) => fetchCoverArt(r.external_id));
  const covers = await Promise.all(coverPromises);
  results.forEach((r, i) => {
    if (covers[i]) r.cover_url = covers[i];
  });

  return results;
}

async function searchOpenLibrary(query) {
  const fields = 'key,title,author_name,cover_i,first_publish_year,isbn,language,edition_count';
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&limit=10`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Open Library returned ${resp.status}`);
  }
  const data = await resp.json();

  return (data.docs || []).slice(0, 10).map((doc) => ({
    external_id: doc.key || null,
    title: doc.title,
    creator: doc.author_name?.join(', ') || null,
    year: doc.first_publish_year || null,
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    external_source: 'openlibrary',
    type: 'book',
  }));
}

module.exports = router;
