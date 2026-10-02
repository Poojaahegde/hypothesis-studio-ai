import { sampleSizePerArm, analyzeExperiment, recommendDecision } from './model.mjs';

const $ = id => document.getElementById(id);
const percent = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const signedPoints = n => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)} pp`;
const integer = id => Number($(id).value);
let lastPlan = null;
let lastDecision = null;

function evidenceNotes() {
  return $('evidence').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8).map((text, i) => ({ id: `E${i + 1}`, text }));
}

function list(id, values) {
  const element = $(id);
  element.replaceChildren(...values.map(value => {
    const li = document.createElement('li');
    li.textContent = value;
    return li;
  }));
}

function showPlan(plan, mode, model = '', source = { problem: $('problem').value, evidence: evidenceNotes() }) {
  lastPlan = { ...plan, mode, model, source };
  $('plan-output').hidden = false;
  $('plan-mode').textContent = mode === 'AI-generated' ? 'LOCAL AI DRAFT · REVIEW BEFORE USE' : 'ILLUSTRATIVE EXAMPLE · NOT GENERATED FROM CURRENT INPUT';
  $('plan-model').textContent = model || 'Example only';
  $('out-hypothesis').textContent = plan.hypothesis;
  $('out-target').textContent = `Target users: ${plan.target_users}`;
  $('out-metric').textContent = plan.primary_metric;
  $('out-rationale').textContent = plan.decision_rationale;
  list('out-guardrails', plan.guardrails);
  list('out-instrumentation', plan.instrumentation);
  list('out-risks', plan.risks);
  const notes = source.evidence;
  list('out-evidence', plan.evidence_ids.map(id => {
    const match = notes.find(e => e.id === id);
    return match ? `${id}: ${match.text}` : `${id}: source note changed since this draft`;
  }));
}

function update() {
  try {
    const baseline = Number($('baseline').value) / 100;
    const mde = Number($('mde').value) / 100;
    const required = sampleSizePerArm(baseline, mde);
    $('required').textContent = required.toLocaleString();
    const n0 = integer('control-visitors');
    const x0 = integer('control-conversions');
    const n1 = integer('variant-visitors');
    const x1 = integer('variant-conversions');
    const result = analyzeExperiment(n0, x0, n1, x1);
    const guardrail = Number($('guardrail').value);
    const guardrailLimit = Number($('guardrail-limit').value);
    if (![guardrail, guardrailLimit].every(x => Number.isFinite(x) && x >= 0 && x <= 100)) throw new Error('Guardrail rates must be between 0% and 100%.');
    const decision = recommendDecision({ result, controlVisitors: n0, variantVisitors: n1, requiredPerArm: required, guardrailExceeded: guardrail > guardrailLimit });
    lastDecision = { baseline, mde, required, n0, x0, n1, x1, result, decision, guardrail, guardrailLimit };
    $('rate-display').textContent = `${percent(result.controlRate)} → ${percent(result.variantRate)}`;
    $('rate-sub').textContent = 'Control → variant';
    $('lift-display').textContent = result.relativeLift === null ? 'N/A' : `${result.relativeLift >= 0 ? '+' : ''}${percent(result.relativeLift)}`;
    $('difference-sub').textContent = `${signedPoints(result.difference)} absolute difference`;
    $('p-display').textContent = result.pValue < 0.001 ? '< 0.001' : result.pValue.toFixed(3);
    $('ci-sub').textContent = `95% CI: ${signedPoints(result.confidenceInterval[0])} to ${signedPoints(result.confidenceInterval[1])}`;
    $('decision-title').textContent = decision.label;
    $('decision-reason').textContent = decision.reason;
    $('stat-warning').textContent = result.lowCount ? 'Low event counts: use an exact test or consult an analyst.' : 'Exploratory readout. Check assignment, peeking, segments, and data quality.';
    $('calculation-error').textContent = '';
  } catch (error) {
    lastDecision = null;
    $('required').textContent = '—';
    $('decision-title').textContent = 'Fix inputs';
    $('decision-reason').textContent = '';
    $('calculation-error').textContent = error.message;
  }
}

for (const input of document.querySelectorAll('input')) input.addEventListener('input', update);
for (const id of ['problem', 'evidence']) $(id).addEventListener('input', () => {
  if (lastPlan) $('ai-status').textContent = 'Problem or evidence changed. Generate a new plan before using the draft.';
});
$('generate').addEventListener('click', async () => {
  const button = $('generate');
  button.disabled = true;
  $('ai-status').textContent = 'Asking the local model to draft an evidence-linked plan…';
  try {
    const source = { problem: $('problem').value, evidence: evidenceNotes() };
    const response = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(source) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI request failed.');
    showPlan(data.plan, 'AI-generated', data.model, source);
    $('ai-status').textContent = 'Draft ready. Check the cited notes, metric, and guardrails before using it.';
  } catch (error) { $('ai-status').textContent = error.message; }
  finally { button.disabled = false; }
});

$('example').addEventListener('click', () => {
  showPlan({
    hypothesis: 'A contextual invitation after the first saved project will increase teammate-invite completion by making the next step clearer.',
    target_users: 'New workspace owners who have saved their first project',
    primary_metric: 'Share of eligible owners who invite at least one teammate within seven days of first project save.',
    guardrails: ['Support-contact rate related to invitations', 'Invite cancellation or undo rate', 'Seven-day return rate for owners'],
    instrumentation: ['first_project_saved', 'invite_prompt_seen', 'invite_started', 'invite_sent', 'invite_cancelled'],
    risks: ['Prompt timing may interrupt project setup.', 'An invite may send email before the owner expects it.'],
    evidence_ids: evidenceNotes().slice(0, 3).map(e => e.id),
    decision_rationale: 'The synthetic notes suggest a meaningful activation gap, but the sample does not prove the intervention will work. Run a randomized test and review the guardrails.'
  }, 'Example');
  $('ai-status').textContent = 'This is an illustrative plan, not an AI response or a production finding.';
});

$('export').addEventListener('click', () => {
  if (!lastDecision) return;
  const d = lastDecision;
  const source = lastPlan?.source ?? { problem: $('problem').value, evidence: evidenceNotes() };
  const notes = source.evidence.map(e => `- ${e.id}: ${e.text}`).join('\n');
  const plan = lastPlan ? `## ${lastPlan.mode} plan\n\nHypothesis: ${lastPlan.hypothesis}\n\nTarget users: ${lastPlan.target_users}\n\nPrimary metric: ${lastPlan.primary_metric}\n\nGuardrails:\n${lastPlan.guardrails.map(x => `- ${x}`).join('\n')}\n\nInstrumentation:\n${lastPlan.instrumentation.map(x => `- ${x}`).join('\n')}\n\nCited notes: ${lastPlan.evidence_ids.join(', ') || 'None'}\n\n` : '';
  const brief = `# Product experiment decision brief\n\nPortfolio prototype. Prefilled data is synthetic unless replaced by the user.\n\n## Problem\n${source.problem}\n\n## Evidence notes\n${notes}\n\n${plan}## Planned sample\nBaseline: ${percent(d.baseline)}. Minimum detectable absolute lift: ${signedPoints(d.mde)}. Required per arm: ${d.required.toLocaleString()} (80% power, two-sided 5% significance).\n\n## Readout\nControl: ${d.x0}/${d.n0} (${percent(d.result.controlRate)}). Variant: ${d.x1}/${d.n1} (${percent(d.result.variantRate)}). Relative lift: ${d.result.relativeLift === null ? 'N/A' : percent(d.result.relativeLift)}. Difference: ${signedPoints(d.result.difference)}. Two-sided p-value: ${d.result.pValue.toFixed(4)}. Approximate 95% CI for absolute difference: ${signedPoints(d.result.confidenceInterval[0])} to ${signedPoints(d.result.confidenceInterval[1])}.\n\nGuardrail: ${d.guardrail}% vs maximum ${d.guardrailLimit}%.\n\n## Decision for human review\n${d.decision.label}: ${d.decision.reason}\n\nCheck instrumentation, randomization, peeking, segment effects, and practical significance before acting.\n`;
  const url = URL.createObjectURL(new Blob([brief], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hypothesis-studio-decision-brief.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
update();
