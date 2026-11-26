#!/usr/bin/env bash
# git commit-msg hook: a "Claude-Session: <claude.ai URL>" trailer becomes "Claude-Session: <session name>", so the
# log says which session committed without opening anything. The name comes from the session record whose sessionId is
# the committing process's $CLAUDE_CODE_SESSION_ID. Outside a Claude session, or with no named record, the message is
# left as it is.
#   install: ln -s <this file> <repo>/.git/hooks/commit-msg
# Reads:   $1 (the message file), <claude-home>/sessions/*.json
# Writes:  $1, only the Claude-Session line
msg="$1"
[ -n "${CLAUDE_CODE_SESSION_ID:-}" ] || exit 0
grep -qE '^Claude-Session: https?://' "$msg" || exit 0
name=$(jq -r --arg s "$CLAUDE_CODE_SESSION_ID" 'select(.sessionId == $s) | .name // empty' \
  "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/sessions/*.json 2>/dev/null | head -1)
[ -n "$name" ] || exit 0
tmp=$(mktemp)
NAME="$name" awk '/^Claude-Session: https?:\/\// { print "Claude-Session: " ENVIRON["NAME"]; next } { print }' "$msg" > "$tmp" &&
  cat "$tmp" > "$msg"
rm -f "$tmp"
exit 0
