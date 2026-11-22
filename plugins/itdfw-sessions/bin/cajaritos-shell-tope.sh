#!/usr/bin/env bash
# cajaritos-shell-tope.sh: ends every Claude Code tool shell that has been running longer than the cap (default 11 min).
# A foreground Bash call is cut by the harness at 10 min; one sent with run_in_background has no cap, and a wait loop
# whose signal never comes (`until grep -q DONE log; do sleep 3; done`) keeps its session busy for hours, so it is never
# compacted (22-nov: seven such loops in two sessions, one 16 h old).
#
# It acts from outside, on the process, and never rewrites a command: a hook that turned the line into
# `timeout … bash -c '<line>'` hid the real command from the Bash permission rules, which do not look inside `bash -c`.
#
# Usage:   cajaritos-shell-tope.sh [--tope SEG] [--seco]
#          --tope SEG  seconds a tool shell may run (default 660: the 10-minute ceiling plus a minute of grace)
#          --seco      print what it would end, and end nothing
# Reads:   `ps -eo pid,pgid,etimes,args`. A tool shell is a process whose command line starts with
#          `/bin/bash -c source <claude-home>/shell-snapshots/`, as Claude Code launches each Bash call. Each call is
#          the leader of its own process group, so the whole group (the shell and what it started) is ended.
# Writes:  <state-dir>/shell-tope.log, one line per group ended: time, pgid, seconds, the first 200 characters.
# Signals: TERM to the group, and KILL ten seconds later to what is still alive (through `env kill`, the binary,
#          which takes a negative pgid).
# Env:     CLAUDE_STATE_DIR (default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude)
# Exit:    0 · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
HOME_CC="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
STATE_DIR="${CLAUDE_STATE_DIR:-$HOME_CC/state}"
TOPE=660; SECO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tope) TOPE="$2"; shift 2 ;;
    --seco) SECO=1; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "usage: cajaritos-shell-tope.sh [--tope SEG] [--seco]" >&2; exit 2 ;;
  esac
done
[[ "$TOPE" =~ ^[0-9]+$ ]] || { echo "usage: --tope takes seconds" >&2; exit 2; }
prefix="/bin/bash -c source $HOME_CC/shell-snapshots/"
mkdir -p "$STATE_DIR"
groups=()
while read -r pid pgid secs args; do
  [ "$pid" = "$pgid" ] || continue
  [[ "$args" == "$prefix"* ]] || continue
  [ "$secs" -gt "$TOPE" ] 2>/dev/null || continue
  line="$(date '+%F %T') pgid=$pgid ${secs}s ${args:0:200}"
  if [ "$SECO" = 1 ]; then echo "would end: $line"; continue; fi
  env kill -TERM -- "-$pgid" 2>/dev/null && { echo "$line" >> "$STATE_DIR/shell-tope.log"; echo "ended: $line"; groups+=("$pgid"); }
done < <(ps -eo pid=,pgid=,etimes=,args=)
if [ ${#groups[@]} -gt 0 ]; then
  sleep 10
  for g in "${groups[@]}"; do env kill -KILL -- "-$g" 2>/dev/null; done
fi
exit 0
