#!/usr/bin/env bash
# claude-session-msg.sh: deliver a text to ONE live Claude Code session, by name, as a cross-session message.
#
# Same mechanism as claude-keepalive.sh: session file <claude-home>/sessions/<pid>.json, key file <pid>.*.key,
# line-JSON protocol over the session's unix socket. The message arrives with from="cron:<from-name>" (not
# "uds:"), so the receiving session is not a peer and nobody tries to answer it with SendMessage.
#
# Usage:   claude-session-msg.sh "<exact session name>" "<text>" [from-name]     (from-name defaults to "cron")
# Reads:   <claude-home>/sessions/<pid>.json  (name, spare, pid, messagingSocketPath)
#          <claude-home>/sessions/<pid>.*.key (peerToken)
# Writes:  nothing on disk. One auth line and one user message go to the session socket (needs jq and socat).
# Env:     CLAUDE_CONFIG_DIR   Claude Code config dir (default: $HOME/.claude)
# Exit:    0 delivered · 1 no live session with that name accepted it · 2 bad usage
usage() { echo "usage: claude-session-msg.sh \"<session name>\" \"<text>\" [from-name]"; }
case "${1:-}" in -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
name="$1"; text="$2"; from="${3:-cron}"
[ -n "$name" ] && [ -n "$text" ] || { usage >&2; exit 2; }
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions"
for meta in "$dir"/*.json; do
  [ -f "$meta" ] || continue
  [ "$(jq -r '.name // ""' "$meta" 2>/dev/null)" = "$name" ] || continue
  [ "$(jq -r '.spare // false' "$meta")" = "true" ] && continue
  pid=$(jq -r '.pid' "$meta"); sock=$(jq -r '.messagingSocketPath // ""' "$meta")
  [ -S "$sock" ] && kill -0 "$pid" 2>/dev/null || continue
  key=$(ls "$dir/$pid".*.key 2>/dev/null | head -1); [ -n "$key" ] || continue
  tok=$(jq -r '.peerToken // empty' "$key"); [ -n "$tok" ] || continue
  body=$(jq -Rn --arg t "$text" --arg f "$from" '"<cross-session-message from=\"cron:\($f)\" from-name=\"\($f)\" from-mode=\"prompting\">\n\($t)\n</cross-session-message>"')
  {
    printf '{"type":"auth","token":"%s"}\n' "$tok"
    printf '{"type":"user","message":{"role":"user","content":%s}}\n' "$body"
  } | socat -t 2 - "UNIX-CONNECT:$sock" >/dev/null 2>&1 && exit 0
done
exit 1
