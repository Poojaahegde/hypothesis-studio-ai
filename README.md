# Hypothesis Studio AI

A local-first product experiment workspace. It helps a PM frame a problem, size a two-arm conversion experiment, ask a local AI model for an evidence-linked plan, inspect the result, and export a decision brief. The numerical readout is deterministic; the AI drafts only the plan. Human review is required for any launch decision.

The [product case study](CASE_STUDY.md) covers the problem, MVP scope, tradeoffs, proposed pilot metrics, and next iteration.

## Why this project

Teams can move quickly from a plausible feature idea to a confident-sounding launch story without defining the target behavior, sample size, guardrails, or evidence. Hypothesis Studio puts those decisions in one inspectable workflow. Its sample data is synthetic and clearly labeled.

## Run it

Requires Node.js 20 or newer. No npm install is needed.

```bash
npm start
```

Open http://127.0.0.1:4173. The calculator, illustrative plan, and export work without a model.

To generate a new AI plan, install [Ollama](https://ollama.com/download) and pull the default model:

```bash
ollama pull gemma3:4b
npm start
```

Set `OLLAMA_MODEL` to another installed model or `OLLAMA_URL` to a different local Ollama endpoint. The Node server binds to `127.0.0.1` and sends the product problem and evidence notes only to that configured endpoint. Avoid customer or confidential data in a public demo.

## What it does

- Calculates approximate per-arm sample size for a two-sided, equal-allocation proportion test at 80% power and 5% significance.
- Produces an exploratory two-proportion z-test, relative lift, and approximate 95% confidence interval from user-entered counts.
- Flags small cell counts, undersized samples, and guardrail breaches before suggesting a next step.
- Requests structured JSON from a local LLM and rejects citations to evidence IDs that were not supplied.
- Keeps the example plan visibly separate from a model-generated plan and exports a Markdown brief with assumptions and caveats.

## Scope and limitations

This is a portfolio prototype, not a production experiment platform. The normal-approximation interval can be poor for rare events or small groups; the app flags cell counts below five. It does not correct for repeated peeking, multiple comparisons, unequal randomization, seasonality, selection bias, or segment imbalance. A statistically significant result is not an automatic rollout decision. The prefilled example and its results are synthetic; they are not a company outcome.

Local AI generation requires a running Ollama model. The app remains useful without it. The AI plan is a draft and should be checked for factual accuracy, metric quality, feasibility, and whether its evidence citations actually support its claims.

## Architecture

Vanilla HTML/CSS/JavaScript frontend; dependency-free Node HTTP server; pure calculation functions in `model.mjs`; Ollama `/api/generate` adapter in `server.mjs`. Tests use Node's built-in test runner and a mocked local model response.

## Test

```bash
npm test
```

## Product decisions

1. **Separate generated language from arithmetic.** A model can draft an experiment plan, but deterministic code calculates sample size and readout.
2. **Keep evidence traceable.** Notes receive stable IDs, and the server rejects invented IDs in the model response.
3. **Preserve human control.** The app proposes “Review for rollout,” never an automatic launch.
4. **Make limitations visible.** Synthetic data, low counts, and unmet sample size appear in the UI and exported brief.
