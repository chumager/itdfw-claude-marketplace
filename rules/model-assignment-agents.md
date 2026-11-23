# Model assignment for subagents (Agent tool) — NEVER Fable

When launching any subagent, pass `model` explicitly: omitting it inherits the main loop's.

| Who | Model · effort |
|---|---|
| management: `itdfw`, `CTO`, `QA`, `Comercial` | Opus 5.5 · medium |
| the other leads and reviewers (`core`, `designer`, `documentador`) | Opus 5.5 · medium (core may go up to high per session) |
| the PMOs (plugin or project sessions that own what they program: `Degustacion`, `Restaurant`, `ALM`…) | `"sonnet"` · high: close to Opus medium for less (owner, 23-nov-2026) |
| module and service sessions, and every subagent that operates (implement, scout, search, synthesize, edit) | `"sonnet"` · medium (`high` per call, table below) |
| trivial/mechanical (lookup, count, format) | `"haiku"` (short window: never long tasks) |
| **Fable** | **never**: Opus 5.5 beats it in code and in reasoning and costs 2.5 times less |

Every session runs on medium (owner, 23-nov-2026): management catches many balls anyway (messages between sessions, escalated requirements), so high did not shrink its context and only added turns; Opus 5.1 on medium never fell short, and 5.5 is better. Measured that week: output (thinking + text) was 4 % of the Opus cost, cache reads 75 %. If medium is not enough for one specific query, it is raised for that query, not for the session.

Opus on low is not used: Sonnet high beats it by a little more (benchmarks of 8-nov-2026, memory `reference_modelos-5-5`). What a Sonnet delivers is reviewed by an Opus.

## Effort is inherited too
A subagent without `effort:` in its frontmatter inherits the session's. To implement: `subagent_type: "implementer"` (sonnet, `effort: medium` by default); generic: `base` (rule `usar-agente-base`). Whoever launches it decides, and passes `effort` in the Agent call:

| The assignment | Effort |
|---|---|
| a bounded change with a closed brief: a function, a component, a case, a fix whose cause is known | `medium` (the default, nothing to pass) |
| a bug with no known cause, a design, a change that crosses several pieces, a race or concurrency | `high`, passed in the call |

Why: measured 23-nov-2026 on the same closed brief, both passed 8/8 hidden cases; `high` spent 19 % more and took twice as long, adding defenses nobody asked for.
