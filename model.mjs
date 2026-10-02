export const ALPHA = 0.05;
export const POWER = 0.8;

export function sampleSizePerArm(baseline, absoluteMde) {
  if (!(baseline > 0 && baseline < 1)) throw new Error('Baseline must be between 0% and 100%.');
  if (!(absoluteMde > 0 && baseline + absoluteMde < 1)) throw new Error('MDE must be positive and keep the target rate below 100%.');
  const target = baseline + absoluteMde;
  const average = (baseline + target) / 2;
  const zAlpha = 1.959963984540054;
  const zPower = 0.8416212335729143;
  const numerator = zAlpha * Math.sqrt(2 * average * (1 - average)) +
    zPower * Math.sqrt(baseline * (1 - baseline) + target * (1 - target));
  return Math.ceil((numerator / absoluteMde) ** 2);
}

// Abramowitz and Stegun 7.1.26; enough precision for a planning dashboard.
function erf(x) {
  const sign = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return sign * y;
}

export function analyzeExperiment(controlVisitors, controlConversions, variantVisitors, variantConversions) {
  for (const n of [controlVisitors, controlConversions, variantVisitors, variantConversions]) {
    if (!Number.isInteger(n) || n < 0) throw new Error('Visitors and conversions must be nonnegative whole numbers.');
  }
  if (controlVisitors === 0 || variantVisitors === 0) throw new Error('Both groups need visitors.');
  if (controlConversions > controlVisitors || variantConversions > variantVisitors) throw new Error('Conversions cannot exceed visitors.');
  const controlRate = controlConversions / controlVisitors;
  const variantRate = variantConversions / variantVisitors;
  const difference = variantRate - controlRate;
  const relativeLift = controlRate === 0 ? null : difference / controlRate;
  const pooledRate = (controlConversions + variantConversions) / (controlVisitors + variantVisitors);
  const pooledSE = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / controlVisitors + 1 / variantVisitors));
  const z = pooledSE === 0 ? 0 : difference / pooledSE;
  const pValue = pooledSE === 0 ? 1 : Math.max(0, Math.min(1, 1 - erf(Math.abs(z) / Math.SQRT2)));
  const unpooledSE = Math.sqrt(controlRate * (1 - controlRate) / controlVisitors + variantRate * (1 - variantRate) / variantVisitors);
  const confidenceInterval = [difference - 1.959963984540054 * unpooledSE, difference + 1.959963984540054 * unpooledSE];
  const lowCount = [controlConversions, variantConversions, controlVisitors - controlConversions, variantVisitors - variantConversions].some(n => n < 5);
  return { controlRate, variantRate, difference, relativeLift, pValue, confidenceInterval, lowCount };
}

export function recommendDecision({ result, controlVisitors, variantVisitors, requiredPerArm, guardrailExceeded }) {
  if (guardrailExceeded) return { label: 'Hold rollout', reason: 'The guardrail exceeds its limit. Investigate before any launch decision.' };
  if (result.lowCount) return { label: 'Insufficient data', reason: 'At least one success or failure count is below five; this normal approximation is unreliable.' };
  if (controlVisitors < requiredPerArm || variantVisitors < requiredPerArm) return { label: 'Collect more data', reason: 'One or both groups are below the planned sample size.' };
  if (result.pValue >= ALPHA) return { label: 'Inconclusive', reason: 'The observed difference does not clear the two-sided 5% threshold.' };
  if (result.difference <= 0) return { label: 'Do not roll out', reason: 'The variant performed worse than control on the primary metric.' };
  return { label: 'Review for rollout', reason: 'The primary metric cleared the threshold; check data quality, guardrails, and segments before launch.' };
}

export function validateAIPlan(raw, validEvidenceIds) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || typeof value !== 'object') throw new Error('AI did not return an object.');
  const keys = ['hypothesis', 'target_users', 'primary_metric', 'decision_rationale'];
  for (const key of keys) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`AI response is missing ${key}.`);
  }
  for (const key of ['guardrails', 'instrumentation', 'risks', 'evidence_ids']) {
    if (!Array.isArray(value[key]) || !value[key].every(x => typeof x === 'string')) throw new Error(`AI response has invalid ${key}.`);
  }
  const valid = new Set(validEvidenceIds);
  if (!value.evidence_ids.every(id => valid.has(id))) throw new Error('AI cited evidence that was not supplied.');
  return value;
}
