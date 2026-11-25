# Update graphify at the end of the day

At close, `graphify-out/` is updated with `graphify-runner` (sonnet, never Fable), in the background, without asking.

## Who and when
- The 21:00 cron (`~/bin/claude-cierre-cron.sh`) writes to `cierre diario`; if it is not alive, to the `CTO`.
- **One close per day**: `~/.cache/claude-cierre/<date>.running` at start, `.done` at the end. If a `.done` exists or a `.running` less than 3 h old, the answer is "ya corrió" (already ran).
- `cierre diario` asks the live sessions for their status; for the ones still working it subscribes with `notify_when_idle` instead of waiting a fixed time. The day's inputs are provided by the `CTO` (projects), `core` (core) and `itdfw` (the owner's topics). Its final summary goes to the `CTO`, who reports.
- A TDD in draft or without pending items is reported to its owning session or, if it has none, to the `CTO`.
- Quota: `~/bin/claude-usage-watch.sh` is read at start and at end and the difference is reported.

## The sequence
```
mcp__itdfw-graph__gaps → document what was missing (README, skill, architecture/) → closeGap
  ↓
mountpoint -q claude-docs/skills-globales   (if not: sudo -n mount <path>; if it fails, STOP and notify)
  ↓
/graphify --update   (never the bare one)
  ↓
rejected for shrink? → table below
  ↓
mcp__itdfw-graph__reindex → status   (not optional: a stale index answers badly)
```
- Entry rule: whoever went to the code because the skill or the graph did not have it does `reportGap` on the spot.

## Subagent brief
- 🔴 **Extractors on `haiku`, effort `high`**; the brief never asks for another model. A brief with sonnet extractors (140 subagents, 203 changed files) took 7 points of the weekly quota in 30 min.
- "The previous graph did not answer about X, Y, Z" and "extract ALL the nodes, never curate the most significant ones".
- Community labels: 15-20 words that say what it is for.
- Temporary files in `graphify-out/` with `python3 -c 'from pathlib import Path; … .unlink(missing_ok=True)'` (the only exception to `no-bypassear-harness`).
- If it goes past ~30 min, something is waiting on a prompt.

## If it rejects for shrinkage
| Cause | How it is recognized | What to do |
|---|---|---|
| legitimate: deletions, moves, renames | the deficit matches the day's changes | force (`--force`) |
| bug or poor cache | massive deficit with no explanation | never force; report |

## Updating graphify
`uv tool upgrade graphifyy` overwrites the local patches: afterwards, `~/bin/check-tool-patches.sh` (retire or `--apply`).

Search: rule `graphify-busqueda`.
