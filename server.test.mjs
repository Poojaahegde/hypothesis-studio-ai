import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from './server.mjs';

test('local AI adapter sends grounded prompt and validates structured reply', async () => {
  let request;
  const fakeFetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return { ok: true, async json() { return { response: JSON.stringify({ hypothesis: 'Test guided invites', target_users: 'New owners', primary_metric: '7-day invites', decision_rationale: 'Interview note E1 suggests confusion.', guardrails: ['Support contacts'], instrumentation: ['invite_sent'], risks: ['Email surprise'], evidence_ids: ['E1'] }) }; } };
  };
  const server = makeServer({ fetchImpl: fakeFetch });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ problem: 'Owners do not invite teammates', evidence: [{ id: 'E1', text: 'Interview notes mention confusion' }] }) });
    assert.equal(response.status, 200);
    assert.match(request.prompt, /E1/);
    assert.equal((await response.json()).plan.evidence_ids[0], 'E1');
  } finally { server.close(); }
});

test('rejects invented citations from local model', async () => {
  const fakeFetch = async () => ({ ok: true, async json() { return { response: JSON.stringify({ hypothesis: 'H', target_users: 'U', primary_metric: 'M', decision_rationale: 'R', guardrails: [], instrumentation: [], risks: [], evidence_ids: ['E9'] }) }; } });
  const server = makeServer({ fetchImpl: fakeFetch });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ problem: 'Test a product problem', evidence: [{ id: 'E1', text: 'Note' }] }) });
    assert.equal(response.status, 503);
  } finally { server.close(); }
});
