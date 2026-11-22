#!/usr/bin/env bash
# cajarito-teclear.sh: types lines into the chat of one background session, as if the person typed them, and only while
# that session is at rest. The one road for the keys the harness flows send: cajaritos-recargar.sh (/reload-plugins,
# /reload-skills) and permission-denied-ask.sh (the person's approval, chosen in the popup). Nobody else calls it.
# `claude attach` in a tmux window, then a detached wait (setsid, so the script returns at once) until the session's own
# status in <claude-home>/sessions/*.json is `idle` or `shell`; each line is typed literally (`send-keys -l`, so a word
# like "Enter" stays text) with its newlines turned into spaces (a newline would send half of it), the status is read
# again before its Enter, and if it changed the line is wiped (C-u) and nothing else is typed. A busy session may be
# showing a permission prompt, and an Enter typed into it would answer that prompt. A session not at rest within
# --espera minutes gets no keys at all. The window is closed at the end either way.
#
# Usage:   cajarito-teclear.sh [--espera MIN] <id|name> <line> [<line>…]
#          --espera  minutes to wait for the session to be at rest (default 15)
# Reads:   `claude agents --json` (name, id, sessionId); <claude-home>/sessions/*.json (status)
# Writes:  one tmux window (labelled `rl-<id>`, driven by its unique id @N); one line per typed line in
#          <state-dir>/teclear.log (time, session, the line) when it is typed
# Output:  "<name>: queued", or why not
# Exit:    0 queued · 1 no tmux server, or no live session with that id or name · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
HOME_CC="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
STATE_DIR="${CLAUDE_STATE_DIR:-$HOME_CC/state}"
ESPERA=15
usage() { echo "usage: cajarito-teclear.sh [--espera MIN] <id|name> <line> [<line>…]"; }
case "${1:-}" in -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
if [ "${1:-}" = "--espera" ]; then ESPERA="${2:-}"; shift 2 || { usage >&2; exit 2; }; fi
[[ "$ESPERA" =~ ^[0-9]+$ ]] && [ $# -ge 2 ] || { usage >&2; exit 2; }
quien="$1"; shift
TMUX_SES=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | head -1)
[ -n "$TMUX_SES" ] || { echo "no tmux server: cannot attach"; exit 1; }
fila=$(claude agents --json 2>/dev/null | jq -r --arg q "$quien" \
  '[.[] | select(.status != null and (.id == $q or .name == $q))][0] // empty | [.name, .id, .sessionId] | @tsv')
[ -n "$fila" ] || { echo "$quien: no live session with that id or name"; exit 1; }
IFS=$'\t' read -r nombre id sid <<< "$fila"
wid=$(tmux new-window -d -P -F '#{window_id}' -t "$TMUX_SES" -n "rl-$id" "claude attach $id" 2>/dev/null)
case "$wid" in @*) ;; *) echo "$nombre: tmux gave no window id, skipping"; exit 1 ;; esac
echo "$nombre: queued"
mkdir -p "$STATE_DIR"
setsid bash -c '
  wid=$1; sid=$2; cc=$3; vueltas=$4; log=$5; nombre=$6; shift 6
  estado() { jq -r --arg s "$sid" "select(.sessionId == \$s) | .status" "$cc"/sessions/*.json 2>/dev/null | head -1; }
  quieta() { case "$(estado)" in idle|shell) return 0 ;; esac; return 1; }
  sleep 6
  ok=0; for _ in $(seq 1 "$vueltas"); do quieta && { ok=1; break; }; sleep 5; done
  if [ "$ok" = 1 ]; then
    for linea in "$@"; do
      linea=${linea//$'"'"'\n'"'"'/ }
      tmux send-keys -t "$wid" -l "$linea"; sleep 1
      quieta || { tmux send-keys -t "$wid" C-u; break; }
      tmux send-keys -t "$wid" Enter
      printf "%s\t%s\t%s\n" "$(date "+%F %T")" "$nombre" "$linea" >> "$log"; sleep 3
    done
  fi
  sleep 5; tmux kill-window -t "$wid" 2>/dev/null' _ "$wid" "$sid" "$HOME_CC" "$(( ESPERA * 12 ))" "$STATE_DIR/teclear.log" "$nombre" "$@" \
  >/dev/null 2>&1 < /dev/null &
exit 0
