// Optional MCP server
// ------------------------------------------------------------------
// The web game does NOT need MCP: the backend already turns the LLM's JSON
// into actions. This server is an extra. It exposes the running game as MCP
// tools so an MCP client (Claude Desktop, Claude Code, Cursor, VS Code, …) can
// read the state, play turns or apply actions — and you watch the map update
// live in the browser.
//
// It talks to the web server over HTTP, so start the game first (npm start),
// then point your MCP client at:  node /absolute/path/to/mcp/server.js
// Set GAME_URL if the game is not on http://localhost:3000.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const GAME_URL = (process.env.GAME_URL || 'http://localhost:3000').replace(/\/+$/, '');

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`${GAME_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error(`Cannot reach the game at ${GAME_URL}. Start it with "npm start" first.`);
  }
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
const fail = (err) => ({ content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });

function summarize(s) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const majors = Object.values(s.nations).filter(n => !n.minor || n.faction || s.wars.some(w => w.includes(n.tag)));
  return {
    date: `${months[s.date.month - 1]} ${s.date.year}`,
    turn: s.turn,
    scenarioId: s.scenarioId,
    player: s.player,
    realism: s.realism,
    gameOver: s.gameOver,
    wars: s.wars.map(([a, b]) => `${a} vs ${b}`),
    nations: majors.map(n => ({ tag: n.tag, name: n.name, leader: n.leader, faction: n.faction, capitulated: n.capitulated, indicators: n.indicators })),
    occupied: Object.entries(s.territories).filter(([, t]) => Object.keys(t.occupation).length)
      .map(([name, t]) => ({ territory: name, owner: t.owner, occupation: t.occupation })),
    lastTurn: s.journal.at(-1) ? { headline: s.journal.at(-1).headline, narrative: s.journal.at(-1).narrative } : null,
    advisors: s.advisors || null
  };
}

const server = new McpServer({ name: 'wwii-strategy-game', version: '0.1.0' });

server.registerTool('get_game_state', {
  title: 'Get game state',
  description: 'Current date, player nation, wars, key indicators of every major nation and all occupied territories.'
}, async () => {
  try { return text(summarize(await call('GET', '/api/state'))); } catch (e) { return fail(e); }
});

server.registerTool('take_turn', {
  title: 'Take a turn',
  description: 'Send a natural-language order for the player nation. The AI agents resolve it, time advances and the map updates. Returns the narrative, outcome and history lesson.',
  inputSchema: { order: z.string().min(1).max(1200).describe('What the player nation does, in plain words') }
}, async ({ order }) => {
  try {
    const { entry } = await call('POST', '/api/turn', { order });
    return text({
      period: `${entry.dateBefore} -> ${entry.dateAfter}`, headline: entry.headline, feasibility: entry.feasibility,
      narrative: entry.narrative, advisors: entry.advisors, reactions: entry.reactions, lesson: entry.lesson
    });
  } catch (e) { return fail(e); }
});

server.registerTool('apply_actions', {
  title: 'Apply actions',
  description: 'Apply game actions directly (no AI). Each action is an object with a "type" such as occupy_territory, annex_territory, change_indicator, declare_war, make_peace, join_faction, change_relation, set_leader, add_event. See docs/ACTIONS.md for fields.',
  inputSchema: { actions: z.array(z.record(z.string(), z.any())).min(1).max(40) }
}, async ({ actions }) => {
  try {
    const r = await call('POST', '/api/actions', { actions, source: 'mcp' });
    return text({ applied: r.applied.map(a => a.summary), rejected: r.rejected });
  } catch (e) { return fail(e); }
});

server.registerTool('list_scenarios', {
  title: 'List scenarios',
  description: 'List the available campaigns (id, title, playable nations).'
}, async () => {
  try { return text(await call('GET', '/api/scenarios')); } catch (e) { return fail(e); }
});

server.registerTool('new_game', {
  title: 'Start a new game',
  description: 'Start a new campaign. Defaults to the WWII scenario ("ww2-1939"); use "china-1939" for China’s War of Resistance.',
  inputSchema: {
    scenarioId: z.string().optional().describe('Scenario id, e.g. ww2-1939 or china-1939'),
    player: z.string().optional().describe('Nation tag, e.g. GER, CHN, CCP'),
    realism: z.enum(['historical', 'sandbox']).optional(),
    lang: z.enum(['en', 'zh-Hant', 'zh-Hans']).optional()
  }
}, async (args) => {
  try { return text(summarize(await call('POST', '/api/new', args))); } catch (e) { return fail(e); }
});

server.registerTool('finish_game', {
  title: 'Finish the campaign',
  description: 'End the current campaign early. Afterwards, call get_report for the graded after-action report.'
}, async () => {
  try { return text(summarize(await call('POST', '/api/finish', {}))); } catch (e) { return fail(e); }
});

server.registerTool('get_report', {
  title: 'Get the after-action report',
  description: 'Generate (or return the cached) end-of-campaign report with grades, overall score and the most important decisions.'
}, async () => {
  try { return text(await call('POST', '/api/report', {})); } catch (e) { return fail(e); }
});

server.registerTool('get_journal', {
  title: 'Get the student journal',
  description: 'The full leader’s journal (orders, outcomes, lessons, reflections) as Markdown.'
}, async () => {
  try { return text(await call('GET', '/api/journal.md')); } catch (e) { return fail(e); }
});

await server.connect(new StdioServerTransport());
