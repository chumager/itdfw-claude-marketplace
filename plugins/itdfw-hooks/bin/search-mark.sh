#!/usr/bin/env bash
# PostToolUse hook for the structured search tools (graph find, Serena, RAG): records that this
# session already asked a search tool before falling back to rg/grep. Always exits 0.
set -u

MARK_DIR="$HOME/.claude/state"
mkdir -p "$MARK_DIR"

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // empty')"
session_id="${session_id}${agent_id:+-$agent_id}"

[ -z "$tool" ] || [ -z "$session_id" ] && exit 0

printf '%s\t%s\n' "$tool" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$MARK_DIR/search-used-$session_id"
exit 0
