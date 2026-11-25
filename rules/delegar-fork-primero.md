# Delegate: a fresh Sonnet first, a fork only if the conversation is the input (main session only)

🔴 **If you are a subagent or a fork, this rule does not apply to you: YOU execute the task, without launching forks or subagents.**

| Case | How |
|---|---|
| by default: implement, scout, investigate, edit | a new Sonnet high subagent (`implementer` or `base`) with a self-contained brief |
| the task depends on what was discussed and does not fit in a brief | `fork` (inherits the thread and the parent's model), only under 75 % of context |
| review with Opus's eyes | `base` with `model: "opus"` and `[fresh-eyes]` in the `description` |

Why: a fresh Sonnet pays its base context once (rules, memory, CLAUDE.md) and reads it from cache at Sonnet price; the fork inherits Opus and the whole thread, including whatever contaminates it. `~/bin/claude-hooks/agent-type-gate.sh` enforces it (fork blocked above 75 %).
