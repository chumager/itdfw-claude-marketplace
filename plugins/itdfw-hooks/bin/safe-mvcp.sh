#!/bin/bash
# PreToolUse hook for Bash: blocks mv/cp without an anti-clobber flag (-n or -i).
# Replicates the `mv -i` / `cp -i` alias that many Linux rc files define, which is NOT loaded in
# the non-interactive shells of Claude's Bash tool.
# Real case: an mv overwrote a framework plugin and broke the login check.

COMMAND=$(jq -r '.tool_input.command // ""' 2>/dev/null)

# Detect whether the command contains `mv` or `cp` as a real command
# (at the start, after a ; && || | separator, or after sudo).
if ! echo "$COMMAND" | grep -qE '(^|[;&|]\s*|\bsudo\s+)(mv|cp)\s'; then
  exit 0  # Not mv/cp, allow.
fi

# Check for an anti-clobber flag: -n / -i / --no-clobber / --interactive.
# The regex allows combinations such as -nv, -vn, -i, etc.
if echo "$COMMAND" | grep -qE '(^|\s)-[a-zA-Z]*[ni]([a-zA-Z]*)?(\s|$)|--no-clobber|--interactive'; then
  exit 0  # Has the flag, allow.
fi

# Block: mv/cp without an anti-clobber flag.
jq -n --arg cmd "$COMMAND" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("mv/cp without an anti-clobber flag is blocked. Add -n (no-clobber, fails if the destination exists) or -i (interactive). Command: " + $cmd)
  }
}'
exit 0
