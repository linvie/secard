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

export async function searchWorks({ type, q }) {
  const params = new URLSearchParams({ type, q });
  const res = await fetch(`${BASE}/works/search?${params}`);
  if (!res.ok) throw new Error('Failed to search works');
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
