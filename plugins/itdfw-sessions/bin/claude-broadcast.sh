#!/usr/bin/env bash
# claude-broadcast.sh: send a text to ALL the live Claude Code sessions of this machine, except the one that runs it
# (that one receives it as the /broadcast command itself). Same protocol as claude-session-msg.sh: session file
# <claude-home>/sessions/<pid>.json, key file <pid>.*.key, JSON lines over the unix socket.
#
# Usage:   claude-broadcast.sh "<text>" [from-name]     (from-name defaults to $CLAUDE_BROADCAST_FROM, then "user")
# Reads:   <claude-home>/sessions/<pid>.json (name, spare, pid, messagingSocketPath), <pid>.*.key (peerToken),
#          /proc/<pid>/stat (to find the ancestors of this process: the session that launched it is one of them)
# Writes:  nothing on disk. One auth line and one user message per session socket (needs jq and socat).
# Output:  one line per session: "ok <name>" or "failed <name>".
# Env:     CLAUDE_CONFIG_DIR       Claude Code config dir (default: $HOME/.claude)
#          CLAUDE_BROADCAST_FROM   default sender name, shown as from-name in the receiving sessions
# Exit:    0 it reached every session · 1 it failed for at least one · 2 bad usage
usage() { echo "usage: claude-broadcast.sh \"<text>\" [from-name]"; }
case "${1:-}" in -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
text="$1"; from="${2:-${CLAUDE_BROADCAST_FROM:-user}}"
[ -n "$text" ] || { usage >&2; exit 2; }
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions"

# the session that launches it is an ancestor of this process
ancestors=" "
p=$$
while [ -n "$p" ] && [ "$p" != "1" ] && [ "$p" != "0" ]; do
  ancestors+="$p "
  p=$(awk '{print $4}' "/proc/$p/stat" 2>/dev/null)
done

body=$(jq -Rn --arg t "$text" --arg f "$from" '"<cross-session-message from=\"cron:\($f)\" from-name=\"\($f)\" from-mode=\"prompting\">\n\($t)\n</cross-session-message>"')
rc=0
for meta in "$dir"/*.json; do
  [ -f "$meta" ] || continue
  [ "$(jq -r '.spare // false' "$meta")" = "true" ] && continue
  pid=$(jq -r '.pid' "$meta"); name=$(jq -r '.name // ""' "$meta"); sock=$(jq -r '.messagingSocketPath // ""' "$meta")
  case "$ancestors" in *" $pid "*) continue ;; esac
  [ -S "$sock" ] && kill -0 "$pid" 2>/dev/null || continue
  key=$(ls "$dir/$pid".*.key 2>/dev/null | head -1)
  tok=$([ -n "$key" ] && jq -r '.peerToken // empty' "$key")
  if [ -n "$tok" ] && {
       printf '{"type":"auth","token":"%s"}\n' "$tok"
       printf '{"type":"user","message":{"role":"user","content":%s}}\n' "$body"
     } | socat -t 2 - "UNIX-CONNECT:$sock" >/dev/null 2>&1; then
    echo "ok $name"
  else
    echo "failed $name"; rc=1
  fi
done
exit $rc
