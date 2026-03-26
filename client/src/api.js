const BASE = '/api';

export async function fetchCards() {
  const res = await fetch(`${BASE}/cards`);
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
}

export async function fetchCard(id) {
  const res = await fetch(`${BASE}/cards/${id}`);
  if (!res.ok) throw new Error('Failed to fetch card');
  return res.json();
}

export async function createCard({ content, work_id }) {
  const res = await fetch(`${BASE}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, work_id: work_id || null }),
  });
  if (!res.ok) throw new Error('Failed to create card');
  return res.json();
}

export async function fetchWork(id) {
  const res = await fetch(`${BASE}/works/${id}`);
  if (!res.ok) throw new Error('Failed to fetch work');
  return res.json();
}

export async function fetchWorkCards(workId) {
  const res = await fetch(`${BASE}/cards?work_id=${workId}`);
  if (!res.ok) throw new Error('Failed to fetch work cards');
  return res.json();
}

export async function searchWorks({ type, q }) {
  const params = new URLSearchParams({ type, q });
  const res = await fetch(`${BASE}/works/search?${params}`);
  if (!res.ok) throw new Error('Failed to search works');
  return res.json();
}

export async function fetchConversations(cardId) {
  const res = await fetch(`${BASE}/conversations/card/${cardId}`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function createWork(work) {
  const res = await fetch(`${BASE}/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(work),
  });
  if (!res.ok) throw new Error('Failed to create work');
  return res.json();
}

export async function sendChat(card_id, message) {
  const res = await fetch(`${BASE}/conversations/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send message');
  }
  return res.json();
}

export async function generateSummary(cardId) {
  const res = await fetch(`${BASE}/conversations/summary/${cardId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate summary');
  }
  return res.json();
}

export async function fetchAiStyles() {
  const res = await fetch(`${BASE}/conversations/styles`);
  if (!res.ok) throw new Error('Failed to fetch AI styles');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings) {
  const res = await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function fetchSettingsStatus() {
  const res = await fetch(`${BASE}/settings/status`);
  if (!res.ok) throw new Error('Failed to fetch settings status');
  return res.json();
}
