const KEY = 'pos_offline_queue';

export function getQueue() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function enqueue(type, body) {
  const queue = getQueue();
  const item = { id: Date.now() + Math.random(), type, body, createdAt: new Date().toISOString() };
  queue.push(item);
  try { localStorage.setItem(KEY, JSON.stringify(queue)); } catch {}
  return item;
}

export function dequeue(id) {
  const queue = getQueue().filter(i => i.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(queue)); } catch {}
}

export function queueSize() {
  return getQueue().length;
}
