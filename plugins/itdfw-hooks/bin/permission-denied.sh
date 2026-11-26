#!/usr/bin/env bash
# PermissionDenied hook: the auto mode classifier denied a tool call. The denial only reaches the denied agent (a session
# or a subagent) and the person does not find out unless that agent says so; this hook tells them on its own.
#   1. records the denial in ~/.cache/claude-denials/denials.jsonl (session, agent, tool, input, reason)
#   2. launches permission-denied-ask.sh detached: a popup to the person, and the result (or "not here: push") to the session
# It decides nothing (no retry) and waits for nothing. Denials by a `deny` rule or by a PreToolUse hook do not come
# through here (the event is the classifier's only).
# Reads:   the hook JSON on stdin; the session files in <claude-home>/sessions/ (to name the session)
# Writes:  ~/.cache/claude-denials/denials.jsonl (append)
# Always exits 0.
input=$(cat)
dir="$HOME/.cache/claude-denials"
mkdir -p "$dir"
printf '%s' "$input" | jq -c '{ts: (now | strflocaltime("%Y-%m-%d %H:%M:%S")), session_id, agent_id, agent_type, cwd,
  tool_name, tool_input, reason}' >> "$dir/denials.jsonl" 2>/dev/null

sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
session=$(jq -r --arg s "$sid" 'select(.sessionId == $s) | .name // empty' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/sessions/*.json 2>/dev/null | head -1)
who=$(printf '%s' "$input" | jq -r '(.agent_type // "session") + " of " + $s' --arg s "${session:-unnamed}")
what=$(printf '%s' "$input" | jq -r '.tool_input.command // (.tool_input | tostring)' | head -c 160)
full=$(printf '%s' "$input" | jq -r '.tool_input.command // (.tool_input | tostring)' | LC_ALL=C tr '\000-\037\177' ' ' | sed 's/ *$//')
reason=$(printf '%s' "$input" | jq -r '.reason // "no reason given"')
setsid nohup "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/permission-denied-ask.sh" "$session" "$who" "$reason" "$what" "$full" >/dev/null 2>&1 < /dev/null &
exit 0
