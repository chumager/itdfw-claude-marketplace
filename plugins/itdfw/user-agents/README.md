# user-agents

`implementer.md` is a user-level agent, not a plugin agent: it must be called `implementer`, with no plugin prefix, so that a brief can ask for it by that name.
Link it into your agents folder: `ln -s "$PWD/implementer.md" ~/.claude/agents/implementer.md` (or under `$CLAUDE_CONFIG_DIR/agents/`).
It works with the skills of this plugin (`tdd-narrativo`, `itdfw-*`); its front matter (`model`, `effort`) is what pins the cost.
