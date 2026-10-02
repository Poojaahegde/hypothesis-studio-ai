# Case study: Hypothesis Studio AI

## Product problem

Product teams often describe a promising feature idea before they define the test that would change their decision. A useful experiment brief needs a target user, a primary behavior, a minimum meaningful effect, a sample-size estimate, guardrails, instrumentation, and a decision rule. These pieces are often scattered between notes and spreadsheets.

## User and job

The primary user is a PM preparing a conversion experiment with an analyst and engineer. The job is to make the bet inspectable before it ships and to keep the eventual readout tied to the original plan.

## MVP

1. Enter the product problem and up to eight evidence notes.
2. Estimate sample size using a baseline rate and a minimum detectable absolute lift.
3. Generate an AI-assisted hypothesis and measurement plan using a local Ollama model, with evidence IDs restricted to supplied notes.
4. Enter control and variant counts; inspect lift, p-value, confidence interval, guardrail status, and a cautious next step.
5. Export the plan and readout as a Markdown decision brief.

The example plan and default counts are synthetic. No production impact is claimed.

## Key product choices

- **AI writes, code calculates.** The model drafts the hypothesis and measurement plan; deterministic code calculates sample size and readout. This keeps numerical conclusions reproducible.
- **Show evidence IDs.** The server rejects nonexistent citations and the UI displays the underlying note text beside each cited ID. This reduces a common failure mode in AI-written briefs.
- **Guardrail before rollout.** A breached guardrail takes precedence over a positive primary metric in the displayed recommendation.
- **Cautious language.** The best outcome is “Review for rollout,” because statistical significance alone does not justify launch.
- **Local-first.** The prototype avoids external API keys and sends notes only to the configured local Ollama endpoint by default.

## What I would measure in a pilot

- Time from initial experiment idea to a reviewed brief.
- Share of briefs with a defined primary metric, MDE, guardrail, and instrumentation before launch.
- Analyst edit rate of AI-generated plans, including changes to metrics and guardrails.
- Rate of unsupported evidence claims found during human review.

These are proposed pilot metrics, not observed results.

## Next iteration

Add saved experiment versions, immutable pre-registration before the test starts, segment-balance diagnostics, sequential-testing support, and an analyst review queue. The current prototype does not provide these capabilities.
