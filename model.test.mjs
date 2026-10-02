import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleSizePerArm, analyzeExperiment, recommendDecision, validateAIPlan } from './model.mjs';

test('sample size is reproducible and rises as MDE shrinks', () => {
  const large = sampleSizePerArm(.25, .03);
  const small = sampleSizePerArm(.25, .02);
  assert.ok(large > 1000);
  assert.ok(small > large);
  assert.throws(() => sampleSizePerArm(.99, .05));
});

test('same conversion rates are inconclusive', () => {
  const r = analyzeExperiment(4000, 1000, 4000, 1000);
  assert.equal(r.difference, 0);
  assert.equal(r.pValue, 1);
  assert.equal(recommendDecision({ result: r, controlVisitors: 4000, variantVisitors: 4000, requiredPerArm: 2000, guardrailExceeded: false }).label, 'Inconclusive');
});

test('guardrail breach blocks an otherwise promising result', () => {
  const r = analyzeExperiment(10000, 2500, 10000, 3000);
  assert.ok(r.pValue < .05);
  assert.equal(recommendDecision({ result: r, controlVisitors: 10000, variantVisitors: 10000, requiredPerArm: 3000, guardrailExceeded: true }).label, 'Hold rollout');
});

test('low counts and impossible conversions are handled', () => {
  assert.equal(analyzeExperiment(10, 1, 10, 3).lowCount, true);
  assert.throws(() => analyzeExperiment(10, 11, 10, 3));
});

test('model cannot introduce nonexistent evidence IDs', () => {
  const plan = { hypothesis: 'H', target_users: 'U', primary_metric: 'M', decision_rationale: 'R', guardrails: [], instrumentation: [], risks: [], evidence_ids: ['E9'] };
  assert.throws(() => validateAIPlan(plan, ['E1']));
  plan.evidence_ids = ['E1'];
  assert.equal(validateAIPlan(plan, ['E1']).hypothesis, 'H');
});
