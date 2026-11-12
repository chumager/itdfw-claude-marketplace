#!/usr/bin/env bash
# claude-session-name.sh: print the name of the Claude Code session this command runs under. It walks up the parent
# processes until one has its session file (<claude-home>/sessions/<pid>.json) and prints its `name`.
#
# Usage:   claude-session-name.sh
# Reads:   <claude-home>/sessions/<pid>.json (field `name`), `ps` for the parent chain
# Writes:  the name on stdout; nothing on disk.
# Env:     CLAUDE_CONFIG_DIR   Claude Code config dir (default: $HOME/.claude)
# Exit:    0 name printed · 1 not under a named session (prints nothing)
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions"
pid=$$
while [ -n "$pid" ] && [ "$pid" -gt 1 ]; do
  f="$dir/$pid.json"
  if [ -f "$f" ]; then
    name=$(jq -r '.name // empty' "$f" 2>/dev/null)
    [ -n "$name" ] && { printf '%s\n' "$name"; exit 0; }
  fi
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done
exit 1
