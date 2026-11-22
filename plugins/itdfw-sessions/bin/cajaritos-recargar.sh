#!/usr/bin/env bash
# cajaritos-recargar.sh: types /reload-plugins and /reload-skills into every live background session, so a new or
# changed hook, plugin or skill applies everywhere.
# For each session: `claude attach` in a tmux window, then a detached wait (setsid, so the script returns at once) until
# the session's own status in <claude-home>/sessions/*.json is `idle` or `shell`, and only then the two commands; the
# status is read again right before each Enter. A busy session may be showing a permission prompt, and an Enter typed
# into it would answer that prompt: keys go only into a session at rest. A session not at rest within 15 min gets no
# keys at all, and its window is closed.
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
    wid=$1; sid=$2; cc=$3; estado() { jq -r --arg s "$sid" "select(.sessionId == \$s) | .status" "$cc"/sessions/*.json 2>/dev/null | head -1; }
    quieta() { case "$(estado)" in idle|shell) return 0 ;; esac; return 1; }
    sleep 6
    ok=0; for _ in $(seq 1 180); do quieta && { ok=1; break; }; sleep 5; done
    if [ "$ok" = 1 ]; then
      for cmd in /reload-plugins /reload-skills; do
        tmux send-keys -t "$wid" "$cmd"; sleep 1
        quieta || { tmux send-keys -t "$wid" C-u; break; }
        tmux send-keys -t "$wid" Enter; sleep 3
      done
    fi
    sleep 5; tmux kill-window -t "$wid" 2>/dev/null' _ "$wid" "$sid" "$HOME_CC" >/dev/null 2>&1 < /dev/null &
done
exit 0
