// Thin wrapper around the backend REST API (see docs/API.md).

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  info: () => request('GET', '/api/info'),
  scenarios: () => request('GET', '/api/scenarios'),
  playable: (scenarioId) => request('GET', `/api/playable${scenarioId ? `?scenarioId=${encodeURIComponent(scenarioId)}` : ''}`),
  state: () => request('GET', '/api/state'),
  debug: () => request('GET', '/api/debug'),
  newGame: (opts) => request('POST', '/api/new', opts),
  turn: (order) => request('POST', '/api/turn', { order }),
  finish: () => request('POST', '/api/finish', {}),
  report: (regenerate = false) => request('POST', '/api/report', { regenerate }),
  actions: (actions) => request('POST', '/api/actions', { actions, source: 'manual' }),
  reflection: (turn, text) => request('POST', '/api/reflection', { turn, text }),
  settings: (s) => request('POST', '/api/settings', s),
  saves: () => request('GET', '/api/saves'),
  save: (name) => request('POST', '/api/save', { name }),
  load: (name) => request('POST', '/api/load', { name })
};

// Live updates: the server pushes a message whenever the game changes
// (including changes made through the MCP server).
export function listen(onMessage) {
  let es;
  const connect = () => {
    es = new EventSource('/api/events');
    es.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => { es.close(); setTimeout(connect, 3000); };
  };
  connect();
}
