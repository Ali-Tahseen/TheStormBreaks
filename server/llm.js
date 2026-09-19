// LLM client — works with any OpenAI-compatible chat completions API.
// ------------------------------------------------------------------
// Default: DeepSeek (https://api.deepseek.com, model "deepseek-chat").
// To switch models later, change .env only:
//   LLM_BASE_URL=https://api.openai.com/v1   LLM_MODEL=gpt-4o-mini
//   LLM_BASE_URL=http://localhost:11434/v1   LLM_MODEL=qwen2.5   (Ollama, free, offline)
// If no API key is set, the game runs in offline demo mode (server/mock.js).

const cfg = () => ({
  baseUrl: (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  model: process.env.LLM_MODEL || 'deepseek-chat',
  jsonMode: (process.env.LLM_JSON_MODE || 'true') !== 'false',
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 90000)
});

export function llmConfigured() {
  const c = cfg();
  // Local servers (Ollama, LM Studio) usually need no key.
  return Boolean(c.apiKey) || /localhost|127\.0\.0\.1/.test(c.baseUrl);
}

export function llmInfo() {
  const c = cfg();
  return { baseUrl: c.baseUrl, model: c.model, configured: llmConfigured() };
}

/**
 * Send a system + user message and get back parsed JSON.
 * Retries once if the model returns empty or invalid JSON.
 * @returns {Promise<{json: object, raw: string, ms: number}>}
 */
export async function chatJSON(system, user, { temperature = 0.8, maxTokens = 2500 } = {}) {
  const c = cfg();
  const body = {
    model: c.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) }
    ],
    temperature,
    max_tokens: maxTokens
  };
  if (c.jsonMode) body.response_format = { type: 'json_object' };

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
    try {
      const res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {})
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const raw = data?.choices?.[0]?.message?.content ?? '';
      const json = parseJSONLoose(raw);
      if (!json) throw new Error('model returned empty or invalid JSON');
      return { json, raw, ms: Date.now() - started };
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error(`LLM request timed out after ${c.timeoutMs} ms`) : err;
      // Auth / quota errors will not fix themselves — stop early.
      if (/ 40[1-3]:/.test(String(lastErr.message))) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// Accepts plain JSON, JSON wrapped in ```json fences, or JSON with text around it.
export function parseJSONLoose(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* ignore */ }
  }
  return null;
}
