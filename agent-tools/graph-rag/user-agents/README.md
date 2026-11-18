# user-agents

`graphify-runner.md` is a user-level agent, not a plugin agent: it must be called `graphify-runner`, with no plugin prefix, because the hooks of `itdfw-hooks` let it delegate by that name.
Link it into your agents folder: `ln -s "$PWD/graphify-runner.md" ~/.claude/agents/graphify-runner.md` (or under `$CLAUDE_CONFIG_DIR/agents/`).
It needs the `graphify` skill and the MCP server of this package (`reindex`, `status`).
