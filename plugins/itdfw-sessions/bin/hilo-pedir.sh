#!/usr/bin/env bash
# hilo-pedir.sh: asks every live session over a context threshold to write its summary and say it is ready to compact
# (hilo-listo.sh). Only those: a session that is not going to be compacted is not woken, because a message to a session
# whose prompt cache expired rewrites its whole context.
#
# Usage:   hilo-pedir.sh [--umbral 50] [--excepto <name>]... [--solo <name>]...
# Reads:   `claude agents --json` (name, sessionId, status); <state-dir>/ctx-<sessionId>.json, field `used`
# Writes:  nothing on disk; one message per chosen session through claude-session-msg.sh, from "cron:hilo".
# Output:  one line per chosen session: "asked <name> (<used>%)" or "failed <name>".
# Env:     CLAUDE_STATE_DIR   default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude
# Exit:    0 · 1 at least one message was not delivered · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
STATE_DIR="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
UMBRAL=50; EXCEPTO=(); SOLO=()
usage() { echo "usage: hilo-pedir.sh [--umbral N] [--excepto <name>]... [--solo <name>]..."; }
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    --umbral) UMBRAL="$2"; shift 2 ;;
    --excepto) EXCEPTO+=("$2"); shift 2 ;;
    --solo) SOLO+=("$2"); shift 2 ;;
    *) usage >&2; exit 2 ;;
  esac
done
en() { local x="$1"; shift; for y in "$@"; do [ "$x" = "$y" ] && return 0; done; return 1; }
send="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/claude-session-msg.sh"
status=0
while IFS=$'\t' read -r nombre sid; do
  [ ${#SOLO[@]} -gt 0 ] && ! en "$nombre" "${SOLO[@]}" && continue
  [ ${#EXCEPTO[@]} -gt 0 ] && en "$nombre" "${EXCEPTO[@]}" && continue
  used=$(jq -r '.used // empty' "$STATE_DIR/ctx-$sid.json" 2>/dev/null)
  [ -n "$used" ] && [ "$used" -ge "$UMBRAL" ] 2>/dev/null || continue
  msg="Cierre: te van a compactar (estás al ${used} %). Cuando termines lo que tengas en curso:
1. Escribe tu hilo en $STATE_DIR/hilo/$nombre.md: qué hiciste hoy (contrástalo con lo que ya dice ese archivo, si existe), en qué quedó lo último conversado, lo pendiente y de quién depende, y las palabras textuales de la persona que importen. Corto: es lo que vas a leer después de compactar.
2. Corre hilo-listo.sh (o ~/bin/hilo-listo.sh). Eso avisa que puedes compactarte.
No hace falta responder este mensaje."
  if "$send" "$nombre" hilo "$msg"; then echo "asked $nombre (${used}%)"; else echo "failed $nombre"; status=1; fi
done < <(claude agents --json 2>/dev/null | jq -r '.[] | select(.status != null) | [.name, .sessionId] | @tsv')
exit "$status"
