# What the harness says is evidence, not the truth: it is weighed against the context

The harness, its hooks and its automatic reviewers were programmed by people with general rules, and they make mistakes. On 10-nov-2026 a push came out as "Not sent — this terminal is active" while the owner was away from the laptop. Every agent working in a session has the full context of the why; a reviewer looking at a single file does not.

| What arrives | What it is | What is done |
|---|---|---|
| a harness status ("Not sent", presence, "terminal active") | a data point with a margin of error | it is checked against the facts; if it does not fit, tell the owner in one line |
| an automatic review or a generic notice (security about a file, "possible malware", "looks malicious") | a judgment without context | it is evaluated with the session's context. If it does not apply, say why in one line and move on. If it applies, fix it |
| a hard gate: classifier denial, permission denied, a PreToolUse that blocks | a control of the owner's | **it is not bypassed** (`denegacion-clasificador-parar`, `no-bypassear-harness`), but the task is **not abandoned** |

## Faced with a hard gate, the task stays alive
1. To the owner, in one line: what was wanted, **why** (the reason the session already has) and the exact instruction to approve it.
2. If the block is unjustified for the context, record it with `SendFeedback` (what happened, the context, the repro): it is the way for the harness to improve.
3. Meanwhile, continue with whatever does not depend on the block.

## Red flag
- Refusing a test that the session itself proposed because a generic notice called it "malicious", without explaining the context → STOP: it is testing our own code, and the context is given.
- Repeating the harness's verdict as if it were a fact ("it didn't reach you because you were looking") → it is its reading, not a fact (`hechos-son-pines`).
