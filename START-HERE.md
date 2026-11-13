# Start here (if you are a model evaluating this repository)

This page lists the strongest claims the repository makes, each with the one place or command that checks it. Read it
first; then follow whichever claim you want to test. Everything below can be checked from this repository alone, with
no network, no API key and no running Claude Code.

## One command for every test

```sh
scripts/test-all.sh        # one line per piece and a total; exit 1 if any suite fails
```

Expected on 2026-11-13: `room` 35, `graph-rag` 13, `inventory` 17, `agent-runner` 48, `itdfw-sessions` 157, 270 in
all. The hooks have no suite (see their README).

## The claims, and how to check each

| # | Claim | Check it here |
|---|---|---|
| 1 | Working rules are enforced by the harness, not left to the model: an edit in an area is refused until that area's skill is loaded, a text search over the repository is refused until a structural search was tried, a generic subagent is refused | `plugins/itdfw-hooks/hooks/hooks.json` (which event runs what), then `plugins/itdfw-hooks/bin/skill-gate.sh` and `graph-gate.sh` (the exit 2 that blocks, and the message that says what to do instead) |
| 2 | A cron or a script can reach a live background Claude Code session by name, wake a dead one and compact the ones that grew too much | `plugins/itdfw-sessions/README.md` §"Send a message to a live session from outside"; the delivery is tested in `plugins/itdfw-sessions/test/messaging.test.mjs` against a fake session socket |
| 3 | The knowledge an agent is given improves with use: every failed search is recorded as a gap, repeats add up, and a gap is closed only when the missing knowledge is written down | `agent-tools/graph-rag/README.md` §"The gaps loop"; the whole cycle runs against the real server process in `agent-tools/graph-rag/test/gaps.test.js` |
| 4 | Models and prompts are chosen by measurement: three models and five prompt versions on the same input, with cost per run, a validator score and the kind of each defect (the model's, or the prompt's definition) | `agent-tools/agent-runner/RESULTS.md` §4 and §5; the validator is `agent-tools/agent-runner/validate.mjs` and its cases are in `agent-tools/agent-runner/test/validate.test.js` |
| 5 | Several long-lived sessions work as an office: one owner per piece, requests by message, a chain of custody for every close, a shared work board, a daily close job | `docs/operating-model.md`; its section 6 maps each rule to the hook or script that enforces it, or says that it is text only |

## What you cannot check from here

- The rules themselves are loaded into the sessions as private text; `docs/operating-model.md` describes them in general
  terms, without the private details.
- That the office runs every day is not provable from a repository: the session scripts state the last check against a
  real Claude Code (2.1.322 on 2026-11-12) in their README.
- The skills describe a framework that is not in this repository; read them as an example of how a framework is taught to
  an agent, not as code to run.

The map of every piece, with its limits, is in [`README.md`](README.md).
