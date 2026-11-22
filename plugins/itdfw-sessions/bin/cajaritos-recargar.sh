#!/usr/bin/env bash
# cajaritos-recargar.sh: types /reload-plugins and /reload-skills into every live background session, so a new or
# changed hook, plugin or skill applies everywhere. A busy session queues them and runs them when its turn ends.
# For each session: `claude attach` in a tmux window, the two commands, and the window is closed once the session is
# idle again (its own status in <claude-home>/sessions/*.json is `idle` or `shell`), at most 15 min later. That wait runs
# detached (setsid), so the script returns at once.
#
# Usage:   cajaritos-recargar.sh [--excepto <name>]... [--solo <name>]...
# Reads:   `claude agents --json` (name, id, sessionId, status); <claude-home>/sessions/*.json (status of each session)
# Writes:  nothing on disk; one tmux window per session (labelled `rl-<id>`, driven by its unique id @N)
# Output:  one line per session: "<name>: queued" or why it was skipped
# Exit:    0 · 1 no tmux server · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
HOME_CC="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
EXCEPTO=(); SOLO=()
while [ $# -gt 0 ]; do
  case "$1" in
    --excepto) EXCEPTO+=("$2"); shift 2 ;;
    --solo) SOLO+=("$2"); shift 2 ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "usage: cajaritos-recargar.sh [--excepto <name>]... [--solo <name>]..." >&2; exit 2 ;;
  esac
done
TMUX_SES=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | head -1)
[ -n "$TMUX_SES" ] || { echo "no tmux server: cannot attach"; exit 1; }
en() { local x="$1"; shift; for y in "$@"; do [ "$x" = "$y" ] && return 0; done; return 1; }

claude agents --json 2>/dev/null | jq -r '.[] | select(.status != null) | [.name, .id, .sessionId] | @tsv' |
while IFS=$'\t' read -r nombre id sid; do
  [ ${#SOLO[@]} -gt 0 ] && ! en "$nombre" "${SOLO[@]}" && continue
  [ ${#EXCEPTO[@]} -gt 0 ] && en "$nombre" "${EXCEPTO[@]}" && continue
  wid=$(tmux new-window -d -P -F '#{window_id}' -t "$TMUX_SES" -n "rl-$id" "claude attach $id" 2>/dev/null)
  case "$wid" in @*) ;; *) echo "$nombre: tmux gave no window id, skipping"; continue ;; esac
  echo "$nombre: queued"
  setsid bash -c '
    wid=$1; sid=$2; estado() { jq -r --arg s "$sid" "select(.sessionId == \$s) | .status" "$3"/sessions/*.json 2>/dev/null | head -1; }
    sleep 6
    tmux send-keys -t "$wid" "/reload-plugins"; sleep 1; tmux send-keys -t "$wid" Enter; sleep 3
    tmux send-keys -t "$wid" "/reload-skills"; sleep 1; tmux send-keys -t "$wid" Enter
    for _ in $(seq 1 180); do sleep 5; case "$(estado)" in idle|shell) break ;; esac; done
    sleep 5; tmux kill-window -t "$wid" 2>/dev/null' _ "$wid" "$sid" "$HOME_CC" >/dev/null 2>&1 < /dev/null &
done
exit 0
