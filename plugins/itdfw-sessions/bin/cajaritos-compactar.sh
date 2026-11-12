#!/usr/bin/env bash
# cajaritos-compactar.sh: compact the background sessions that went past a context threshold. For each one:
# `claude attach` in a tmux window, /compact, wait for the % to drop, close the window (the session stays alive).
# It skips the ones that are not idle or that have recent tasks.
#
# Usage:   cajaritos-compactar.sh [--umbral 50] [--excepto <name>]... [--solo <name>]...
#          --umbral N     compact the sessions whose context is at N % or more (default 50)
#          --excepto NAME skip that session (repeatable)
#          --solo NAME    only that session (repeatable)
# Reads:   `claude agents --json` (name, id, sessionId, status)
#          <state-dir>/ctx-<sessionId>.json, field `used` = context % of the session. Claude Code does not write it:
#          a status line does (see examples/statusline-state.sh in this plugin)
#          /tmp/claude-<uid>/*/<sessionId>/tasks (files touched in the last 10 minutes = active tasks)
# Writes:  nothing on disk; opens and closes a tmux window `cmp-<id>` per compacted session (needs a tmux server).
# Output:  one line per candidate: "<name>: <before>% -> <after>% (<status>)", or why it was skipped.
# Env:     CLAUDE_STATE_DIR   where the ctx-<sessionId>.json files live (default: <claude-home>/state, with
#                             <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude)
# Exit:    0 done · 1 no tmux server (it cannot attach) · 2 bad usage
set -uo pipefail
STATE_DIR="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
UMBRAL=50; EXCEPTO=(); SOLO=()
usage() { echo "usage: cajaritos-compactar.sh [--umbral N] [--excepto <name>]... [--solo <name>]..."; }
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    --umbral) UMBRAL="$2"; shift 2 ;;
    --excepto) EXCEPTO+=("$2"); shift 2 ;;
    --solo) SOLO+=("$2"); shift 2 ;;
    *) usage >&2; exit 2 ;;
  esac
done
TMUX_SES=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | head -1)
[ -n "$TMUX_SES" ] || { echo "no tmux server: cannot attach"; exit 1; }
en() { local x="$1"; shift; for y in "$@"; do [ "$x" = "$y" ] && return 0; done; return 1; }

claude agents --json 2>/dev/null | jq -r '.[] | select(.status != null) | [.name, .id, .sessionId, .status] | @tsv' |
while IFS=$'\t' read -r nombre id sid estado; do
  [ ${#SOLO[@]} -gt 0 ] && ! en "$nombre" "${SOLO[@]}" && continue
  [ ${#EXCEPTO[@]} -gt 0 ] && en "$nombre" "${EXCEPTO[@]}" && continue
  f="$STATE_DIR/ctx-$sid.json"
  antes=$(jq -r '.used // empty' "$f" 2>/dev/null)
  [ -n "$antes" ] && [ "$antes" -ge "$UMBRAL" ] 2>/dev/null || continue
  if [ "$estado" != "idle" ]; then echo "$nombre: ${antes}% but it is $estado, skipping"; continue; fi
  tareas=$(find /tmp/claude-"$(id -u)"/*/"$sid"/tasks -type f -mmin -10 2>/dev/null | wc -l)
  if [ "$tareas" -gt 0 ]; then echo "$nombre: ${antes}% but it has active tasks, skipping"; continue; fi
  w="cmp-$id"
  tmux new-window -d -t "$TMUX_SES" -n "$w" "claude attach $id"
  sleep 6
  tmux send-keys -t "$TMUX_SES:$w" '/compact'; sleep 1; tmux send-keys -t "$TMUX_SES:$w" Enter
  for _ in $(seq 1 60); do sleep 5; u=$(jq -r '.used // 100' "$f" 2>/dev/null); [ "$u" -lt 20 ] 2>/dev/null && break; done
  tmux kill-window -t "$TMUX_SES:$w" 2>/dev/null
  sleep 2
  echo "$nombre: ${antes}% -> $(jq -r '.used' "$f")% ($(claude agents --json | jq -r --arg s "$sid" '.[]|select(.sessionId==$s)|.status'))"
done
