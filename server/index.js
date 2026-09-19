// Backend server — serves the frontend (public/) and the game API.
// Run:  npm start   then open http://localhost:3000

import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame, applyActions, ACTION_TYPES, formatDate, checkGameOver } from './engine.js';
import { runTurn, generateReport } from './agents.js';
import { llmInfo } from './llm.js';
import { audioInfo, streamClip } from './audio.js';
import { getScenario, listScenarios, scenarioSummary, DEFAULT_SCENARIO_ID } from './data/scenarios/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SAVES = path.join(ROOT, 'saves');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(SAVES, { recursive: true });

// Territory names come straight from each scenario's map file so server and map
// always agree. Built by tools/build-map.mjs from Natural Earth provinces.
const MAPS = {};
function mapNamesFor(mapFile) {
  if (!MAPS[mapFile]) {
    const topo = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', mapFile), 'utf8'));
    MAPS[mapFile] = topo.objects.territories.geometries.map(g => g.properties.name);
  }
  return MAPS[mapFile];
}

// ---------------- state + persistence ----------------
let game = null;
let busy = false;
const AUTOSAVE = path.join(SAVES, 'autosave.json');

function save(file = AUTOSAVE) {
  if (game) fs.writeFileSync(file, JSON.stringify(game, null, 2));
}
function loadFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data?.nations || !data?.territories) throw new Error('not a valid save file');
  return data;
}
try { if (fs.existsSync(AUTOSAVE)) game = loadFile(AUTOSAVE); } catch { game = null; }

const publicState = (s) => {
  if (!s) return null;
  const { lastTurnDebug, lastReportDebug, ...rest } = s;
  return rest;
};
const safeName = (n) => String(n || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'save';

// ---------------- live updates (Server-Sent Events) ----------------
// The browser listens here so changes made from elsewhere (e.g. the MCP server)
// appear on the map immediately.
const clients = new Set();
function broadcast(type = 'state') {
  const msg = `data: ${JSON.stringify({ type, version: game?.version ?? 0 })}\n\n`;
  for (const res of clients) res.write(msg);
}

// ---------------- app ----------------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC));

app.get('/api/info', (req, res) => {
  const active = getScenario(game?.scenarioId || DEFAULT_SCENARIO_ID);
  res.json({
    llm: llmInfo(),
    audio: audioInfo(),
    scenarios: listScenarios(),
    scenario: scenarioSummary(active),
    indicators: active.indicators,
    factions: active.factions,
    actionTypes: ACTION_TYPES,
    languages: [{ id: 'en', label: 'English' }, { id: 'zh-Hant', label: '繁體中文' }, { id: 'zh-Hans', label: '简体中文' }],
    hasGame: !!game
  });
});

app.get('/api/scenarios', (req, res) => res.json(listScenarios()));

app.get('/api/playable', (req, res) => {
  const scenario = getScenario(req.query?.scenarioId || game?.scenarioId || DEFAULT_SCENARIO_ID);
  res.json(Object.entries(scenario.nations).filter(([, n]) => n.playable)
    .map(([tag, n]) => ({ tag, name: n.name, leader: n.leader, ideology: n.ideology, faction: n.faction, color: n.color })));
});

app.get('/api/timeline', (req, res) => {
  const scenario = getScenario(req.query?.scenarioId || game?.scenarioId || DEFAULT_SCENARIO_ID);
  res.json(scenario.timeline);
});

app.get('/api/state', (req, res) => {
  if (!game) return res.status(404).json({ error: 'No game in progress. Start a new game.' });
  res.json(publicState(game));
});

app.get('/api/debug', (req, res) => res.json(game?.lastTurnDebug || null));

app.get('/api/audio/clip', async (req, res) => {
  try {
    await streamClip(game, { turn: req.query.turn, kind: req.query.kind }, req, res);
  } catch (err) {
    if (res.headersSent || res.destroyed || res.writableEnded) {
      if (!res.writableEnded && !res.destroyed) res.end();
      return;
    }
    const status = Number(err.status) || 502;
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/new', (req, res) => {
  const { player, studentName, realism, lang, scenarioId } = req.body || {};
  const scenario = getScenario(scenarioId);
  game = createGame({ scenarioId: scenario.id, player, studentName, realism }, mapNamesFor(scenario.mapFile));
  game.lang = ['en', 'zh-Hant', 'zh-Hans'].includes(lang) ? lang : 'en';
  save(); broadcast();
  res.json(publicState(game));
});

app.post('/api/turn', async (req, res) => {
  if (!game) return res.status(400).json({ error: 'Start a new game first.' });
  if (game.gameOver) return res.status(400).json({ error: `The campaign is over: ${game.gameOver.reason}` });
  const order = String(req.body?.order || '').trim();
  if (!order) return res.status(400).json({ error: 'Type an order for your nation first.' });
  if (order.length > 1200) return res.status(400).json({ error: 'Orders are limited to 1200 characters. Shorten the order and send it again.' });
  if (busy) return res.status(409).json({ error: 'A turn is already being resolved. Wait for it to finish.' });

  busy = true;
  broadcast('busy');
  const backup = JSON.stringify(game);
  try {
    const entry = await runTurn(game, order, { lang: game.lang || 'en' });
    save(); broadcast();
    res.json({ entry, state: publicState(game) });
  } catch (err) {
    game = JSON.parse(backup);         // a failed turn changes nothing
    console.error('[turn failed]', err);
    res.status(502).json({ error: `The AI game master could not resolve this turn: ${err.message}` });
  } finally {
    busy = false;
    broadcast('idle');
  }
});

// Apply raw actions directly (debugging, teacher scenario editing, MCP).
app.post('/api/actions', (req, res) => {
  if (!game) return res.status(400).json({ error: 'Start a new game first.' });
  game.lastChangedTerritories = [];
  const result = applyActions(game, req.body?.actions, { source: req.body?.source || 'manual' });
  game.gameOver = checkGameOver(game);
  save(); broadcast();
  res.json({ ...result, state: publicState(game) });
});

// End the campaign deliberately (the "Finish Game" button).
app.post('/api/finish', (req, res) => {
  if (!game) return res.status(400).json({ error: 'Start a new game first.' });
  if (!game.gameOver) {
    const scenario = getScenario(game.scenarioId);
    game.gameOver = { reason: scenario.playerEndReason || 'You chose to end the campaign.', endedByPlayer: true };
  }
  save(); broadcast();
  res.json(publicState(game));
});

// Generate (or return the cached) deterministic end-of-campaign report.
app.post('/api/report', async (req, res) => {
  if (!game) return res.status(400).json({ error: 'Start a new game first.' });
  if (busy) return res.status(409).json({ error: 'A turn is already being resolved. Wait for it to finish.' });
  busy = true;
  broadcast('busy');
  try {
    const regenerate = Boolean(req.body?.regenerate || req.query?.regenerate);
    const report = await generateReport(game, { lang: game.lang || 'en', regenerate });
    save(); broadcast();
    res.json(report);
  } catch (err) {
    console.error('[report failed]', err);
    res.status(502).json({ error: `The examiner could not write the report: ${err.message}` });
  } finally {
    busy = false;
    broadcast('idle');
  }
});

app.get('/api/report.json', async (req, res) => {
  if (!game) return res.status(404).json({ error: 'No game in progress.' });
  if (!game.report) { try { await generateReport(game, { lang: game.lang || 'en' }); save(); } catch { /* fall through */ } }
  res.set('Content-Disposition', 'attachment; filename="campaign-report.json"');
  res.json(game.report || null);
});

app.post('/api/reflection', (req, res) => {
  const entry = game?.journal.find(j => j.turn === Number(req.body?.turn));
  if (!entry) return res.status(404).json({ error: 'Turn not found.' });
  entry.reflection = String(req.body?.text || '').slice(0, 3000);
  save();
  res.json({ ok: true });
});

app.post('/api/settings', (req, res) => {
  if (!game) return res.status(400).json({ error: 'Start a new game first.' });
  const { realism, lang } = req.body || {};
  if (realism === 'historical' || realism === 'sandbox') game.realism = realism;
  if (['en', 'zh-Hant', 'zh-Hans'].includes(lang)) game.lang = lang;
  save(); broadcast();
  res.json(publicState(game));
});

app.get('/api/saves', (req, res) => {
  const files = fs.readdirSync(SAVES).filter(f => f.endsWith('.json'))
    .map(f => ({ name: f.replace(/\.json$/, ''), modified: fs.statSync(path.join(SAVES, f)).mtime }))
    .sort((a, b) => b.modified - a.modified);
  res.json(files);
});

app.post('/api/save', (req, res) => {
  if (!game) return res.status(400).json({ error: 'Nothing to save yet.' });
  const name = safeName(req.body?.name);
  save(path.join(SAVES, `${name}.json`));
  res.json({ ok: true, name });
});

app.post('/api/load', (req, res) => {
  try {
    game = loadFile(path.join(SAVES, `${safeName(req.body?.name)}.json`));
    save(); broadcast();
    res.json(publicState(game));
  } catch (err) {
    res.status(404).json({ error: `Could not load that save: ${err.message}` });
  }
});

// ---------- Markdown exports ----------
function reportMarkdown(r) {
  if (!r) return [];
  const lines = ['## After-action report', '', r.summary, ''];
  lines.push(`**Overall: ${r.overall?.score ?? '—'}/100 (${r.overall?.letter || '—'} — ${r.overall?.label || ''})**`, '');
  lines.push('| Rubric | Score | Comment |', '|---|---|---|');
  for (const [k, g] of Object.entries(r.grades || {})) {
    lines.push(`| ${k.replace(/_/g, ' ')} | ${g.score} | ${String(g.rationale || '').replace(/\|/g, '/')} |`);
  }
  lines.push('');
  if (r.key_decisions?.length) {
    lines.push('### Most important decisions', '');
    for (const d of r.key_decisions) lines.push(`- **Turn ${d.turn}** (${d.rating}): ${d.order} — ${d.outcome} ${d.impact}`);
    lines.push('');
  }
  if (r.timeline_diff?.length) {
    lines.push('### Real history vs your timeline', '');
    for (const t of r.timeline_diff) lines.push(`- **Real:** ${t.real_history}  `, `  **Yours:** ${t.your_timeline}`);
    lines.push('');
  }
  if (r.lessons?.length) lines.push('### Lessons', '', ...r.lessons.map(l => `- ${l}`), '');
  return lines;
}

// Student journal as Markdown — for teachers, portfolios and assessment.
app.get('/api/journal.md', (req, res) => {
  if (!game) return res.status(404).send('No game in progress.');
  const n = game.nations[game.player];
  const scenario = getScenario(game.scenarioId);
  const lines = [
    `# Leader's journal — ${n.name}`,
    '',
    `Student: ${game.studentName || '(not given)'}  `,
    `Scenario: ${scenario.title} (from ${formatDate(scenario.startDate)})  `,
    `Mode: ${game.realism}  `,
    `Current date: ${formatDate(game.date)}, turn ${game.turn}`,
    ''
  ];
  for (const j of game.journal) {
    lines.push(`## Turn ${j.turn}: ${j.dateBefore} → ${j.dateAfter}`, '');
    lines.push(`**My order:** ${j.order}`, '');
    lines.push(`**Outcome (${j.feasibility}):** ${j.headline}`, '', j.narrative, '');
    if (j.advisorNotes?.length) lines.push('**Advisor notes:**', ...j.advisorNotes.map(a => `- ${a}`), '');
    if (j.lesson) {
      lines.push(`**Real history — ${j.lesson.title}:** ${j.lesson.what_really_happened}`, '');
      if (j.lesson.how_your_timeline_differs) lines.push(`**How my timeline differs:** ${j.lesson.how_your_timeline_differs}`, '');
      if (j.lesson.key_terms?.length) lines.push('**Key terms:**', ...j.lesson.key_terms.map(k => `- ${k.term}: ${k.definition}`), '');
      lines.push(`**Reflection question:** ${j.lesson.reflection_question}`, '');
    }
    lines.push(`**My reflection:** ${j.reflection || '(not answered)'}`, '', '---', '');
  }
  if (game.gameOver) lines.push('## Campaign ended', '', game.gameOver.reason, '');
  if (game.report) lines.push(...reportMarkdown(game.report));
  res.type('text/markdown').send(lines.join('\n'));
});

app.get('/api/report.md', (req, res) => {
  if (!game) return res.status(404).send('No game in progress.');
  const n = game.nations[game.player];
  const head = [`# Campaign report — ${n.name}`, '', `Student: ${game.studentName || '(not given)'}  `, `Period: ${formatDate(game.date)}`, ''];
  res.type('text/markdown').send([...head, ...reportMarkdown(game.report)].join('\n'));
});

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'hello', version: game?.version ?? 0 })}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
});

app.listen(PORT, () => {
  const info = llmInfo();
  const audio = audioInfo();
  console.log(`\n  The Storm Breaks — running at http://localhost:${PORT}`);
  console.log(info.configured
    ? `  AI: ${info.model} via ${info.baseUrl}`
    : '  AI: offline demo mode (no API key). Copy .env.example to .env and add your DeepSeek key for full AI turns.');
  console.log(audio.configured
    ? '  Audio: ElevenLabs TTS ready'
    : '  Audio: off (set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to enable narration).');
  console.log('');
});
