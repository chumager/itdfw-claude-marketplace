#!/usr/bin/env bash
# hilo-listo.sh: run by a session when it has written its summary and can be compacted. It leaves a mark that the
# session in charge of compacting watches; after the compaction, hilo-devolver.sh hands the summary back.
#
# Usage:   hilo-listo.sh            the session that runs it (found by claude-session-name.sh)
#          hilo-listo.sh --ruta     prints where this session writes its summary, and leaves no mark
# Reads:   <state-dir>/hilo/<name>.md: the summary must exist and be from the last 24 h
# Writes:  <state-dir>/compactables/<name> (the mark: date and time)
# Env:     CLAUDE_STATE_DIR   default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude
# Exit:    0 marked (or path printed) · 1 not under a named session, or no recent summary · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in
  -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
  ""|--ruta) ;;
  *) echo "usage: hilo-listo.sh [--ruta]" >&2; exit 2 ;;
esac
state="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
name=$("$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/claude-session-name.sh") || { echo "not under a named session" >&2; exit 1; }
resumen="$state/hilo/$name.md"
[ "${1:-}" = "--ruta" ] && { mkdir -p "$state/hilo"; echo "$resumen"; exit 0; }
[ -n "$(find "$resumen" -mmin -1440 2>/dev/null)" ] || { echo "no summary from the last 24 h at $resumen" >&2; exit 1; }
mkdir -p "$state/compactables" && date '+%F %T' > "$state/compactables/$name" && echo "ready to compact: $name"
