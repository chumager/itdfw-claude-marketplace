#!/usr/bin/env bash
# SessionStart hook: when the session resumed from a compaction, the skills
# loaded before the compact no longer count (fresh invocation is required
# post-compact), so the marker file is emptied.
set -u

MARK_DIR="$HOME/.claude/state"
mkdir -p "$MARK_DIR"

input="$(cat)"

source="$(printf '%s' "$input" | jq -r '.source // empty')"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"

if [ "$source" = "compact" ] && [ -n "$session_id" ]; then
  mark_file="$MARK_DIR/skills-loaded-$session_id"
  : > "$mark_file"
fi

exit 0
