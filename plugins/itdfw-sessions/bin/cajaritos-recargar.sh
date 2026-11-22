#!/usr/bin/env bash
# cajaritos-recargar.sh: types /reload-plugins and /reload-skills into every live background session, so a new or
# changed hook, plugin or skill applies everywhere.
# Each session gets them through cajarito-teclear.sh, the one road for typed keys: only while the session is at rest
# (a busy one may be showing a permission prompt, and an Enter typed into it would answer that prompt), the status read
# again before each Enter, and nothing typed if it is not at rest within 15 min.
#
# Usage:   cajaritos-recargar.sh [--excepto <name>]... [--solo <name>]...
# Reads:   `claude agents --json` (name, id, sessionId, status); <claude-home>/sessions/*.json (status of each session)
# Writes:  what cajarito-teclear.sh writes, once per session
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
HERE="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
TMUX_SES=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | head -1)
[ -n "$TMUX_SES" ] || { echo "no tmux server: cannot attach"; exit 1; }
en() { local x="$1"; shift; for y in "$@"; do [ "$x" = "$y" ] && return 0; done; return 1; }

claude agents --json 2>/dev/null | jq -r '.[] | select(.status != null) | [.name, .id, .sessionId] | @tsv' |
while IFS=$'\t' read -r nombre id sid; do
  [ ${#SOLO[@]} -gt 0 ] && ! en "$nombre" "${SOLO[@]}" && continue
  [ ${#EXCEPTO[@]} -gt 0 ] && en "$nombre" "${EXCEPTO[@]}" && continue
  "$HERE/cajarito-teclear.sh" "$id" /reload-plugins /reload-skills
done
exit 0
