# `general-purpose` NEVER — `base` is used

A generic subagent goes with `subagent_type: "base"`, never `"general-purpose"` (nor omitted, which falls there by default).

`base` (`~/.claude/agents/base.md`) fixes `model: sonnet` and `effort: high` through its frontmatter; an ad-hoc agent inherits the session's model and effort. The `model` can be overridden per call (`model: "opus"` for a review with Opus's eyes, rule `model-assignment-agents`), and so can the effort (`effort: "lower"`/`"higher"`).
