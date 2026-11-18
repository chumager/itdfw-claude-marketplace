# user-agents

`base.md` is a user-level agent, not a plugin agent: it must be called `base`, with no plugin prefix, because `bin/agent-type-gate.sh` demands that name.
Link it into your agents folder: `ln -s "$PWD/base.md" ~/.claude/agents/base.md` (or under `$CLAUDE_CONFIG_DIR/agents/`).
The front matter (`model`, `effort`) is the point: change it there and every subagent that uses `base` follows.
