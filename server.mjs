import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateAIPlan } from './model.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/model.mjs', ['model.mjs', 'text/javascript; charset=utf-8']]
]);
const model = process.env.OLLAMA_MODEL || 'gemma3:4b';
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

export function buildPrompt(input) {
  return `You are a product manager's experiment planning assistant. Use only the supplied problem and evidence. Do not invent users, results, dates, or citations. Reply with one JSON object containing string fields hypothesis, target_users, primary_metric, decision_rationale and string-array fields guardrails, instrumentation, risks, evidence_ids. evidence_ids must be selected only from the provided IDs. If evidence is weak, say so in decision_rationale. Keep recommendations concise and practical.\n\nInput: ${JSON.stringify(input)}`;
}

export function makeServer({ fetchImpl = fetch, ollamaBase = ollamaUrl } = {}) {
  return createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'POST' && pathname === '/api/plan') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 30000) throw new Error('Input is too large.');
        }
        const input = JSON.parse(body);
        if (typeof input.problem !== 'string' || !input.problem.trim() || input.problem.length > 2500) throw new Error('Enter a product problem under 2,500 characters.');
        if (!Array.isArray(input.evidence) || input.evidence.length > 8 || input.evidence.some(e => !/^E[1-8]$/.test(e.id) || typeof e.text !== 'string' || e.text.length > 400)) throw new Error('Provide up to eight short evidence notes.');
        const response = await fetchImpl(`${ollamaBase}/api/generate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model, prompt: buildPrompt(input), format: 'json', stream: false, options: { temperature: 0.2 } }),
          signal: AbortSignal.timeout(45000)
        });
        if (!response.ok) throw new Error(`Local model returned ${response.status}.`);
        const payload = await response.json();
        const plan = validateAIPlan(payload.response, input.evidence.map(e => e.id));
        json(res, 200, { plan, model });
      } catch (error) {
        const badInput = error instanceof SyntaxError || /Input is too large|Enter a product|Provide up to eight/.test(error.message);
        json(res, badInput ? 400 : 503, { error: badInput ? error.message : 'AI unavailable. Start Ollama and pull the configured model, then try again.', detail: badInput ? undefined : error.message });
      }
      return;
    }
    if (req.method !== 'GET' || !files.has(pathname)) { res.writeHead(404); res.end('Not found'); return; }
    const [filename, type] = files.get(pathname);
    try {
      res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
      res.end(await readFile(path.join(root, filename)));
    } catch { res.writeHead(500); res.end('Could not load app'); }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  makeServer().listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
    process.stdout.write(`Hypothesis Studio ready at http://127.0.0.1:${process.env.PORT || 4173}\n`);
  });
}
