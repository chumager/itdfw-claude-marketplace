#!/usr/bin/env bash
# PostToolUse hook for the Skill tool: records that a skill was loaded in this session.
# Reads the hook JSON payload from stdin, appends "<skill>\t<ISO date>" to the
# session's marker file. Always exits 0 (never blocks).
set -u

MARK_DIR="$HOME/.claude/state"
mkdir -p "$MARK_DIR"

input="$(cat)"

skill="$(printf '%s' "$input" | jq -r '.tool_input.skill // empty')"
# a plugin skill may come as "<plugin>:<skill>": the gates match the bare name
skill="${skill##*:}"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
# Subagents share the parent's session_id but carry their own agent_id: key the
# marker by both, so a skill loaded by a subagent never unlocks the main agent (or another subagent).
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // empty')"
session_id="${session_id}${agent_id:+-$agent_id}"

# Nothing to record without both fields.
if [ -z "$skill" ] || [ -z "$session_id" ]; then
  exit 0
fi

mark_file="$MARK_DIR/skills-loaded-$session_id"
iso_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

printf '%s\t%s\n' "$skill" "$iso_date" >> "$mark_file"

exit 0
