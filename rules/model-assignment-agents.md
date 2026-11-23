# Model assignment for subagents (Agent tool) — NEVER Fable

When launching any subagent, pass `model` explicitly: omitting it inherits the main loop's.

| Who | Model · effort |
|---|---|
| management: `itdfw`, `CTO`, `QA`, `Comercial` | Opus 5.5 · high |
| the other leads and reviewers (`core`, `designer`, `documentador`) and the PMOs | Opus 5.5 · medium (core may go up to high per session) |
| project, module and service sessions, and every subagent that operates (implement, scout, search, synthesize, edit) | `"sonnet"` · high |
| trivial/mechanical (lookup, count, format) | `"haiku"` (short window: never long tasks) |
| **Fable** | **never**: Opus 5.5 beats it in code and in reasoning and costs 2.5 times less |

Management runs on high because it is the final filter; if high is not enough, only then is Fable evaluated for a specific query (Anthropic's guidance). The trial with management on Fable (15 to 17-nov-2026) closed with no visible difference.

Opus on low is not used: Sonnet high beats it by a little more (benchmarks of 8-nov-2026, memory `reference_modelos-5-5`). What a Sonnet delivers is reviewed by an Opus.

## Effort is inherited too
A subagent without `effort:` in its frontmatter inherits the session's. To implement: `subagent_type: "implementer"` (sonnet, `effort: medium` by default); generic: `base` (rule `usar-agente-base`). Whoever launches it decides, and passes `effort` in the Agent call:

| The assignment | Effort |
|---|---|
| a bounded change with a closed brief: a function, a component, a case, a fix whose cause is known | `medium` (the default, nothing to pass) |
| a bug with no known cause, a design, a change that crosses several pieces, a race or concurrency | `high`, passed in the call |

Why: measured 23-nov-2026 on the same closed brief, both passed 8/8 hidden cases; `high` spent 19 % more and took twice as long, adding defenses nobody asked for.
