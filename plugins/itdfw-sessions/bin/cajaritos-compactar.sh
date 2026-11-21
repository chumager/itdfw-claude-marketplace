#!/usr/bin/env bash
# cajaritos-compactar.sh: compact the background sessions that went past a context threshold. For each one:
# `claude attach` in a tmux window, /compact, wait for the % to drop, close the window (the session stays alive).
# It skips the ones that are not idle or that have recent tasks.
#
# Usage:   cajaritos-compactar.sh [--umbral 50] [--excepto <name>]... [--solo <name>]...
#          --umbral N     compact the sessions whose context is at N % or more (default 50)
#          --excepto NAME skip that session (repeatable)
#          --solo NAME    only that session (repeatable)
#          --modelo M     after a compaction that worked, switch the session to model M (`/model M`). A switch
#                         rewrites the whole context at the new model's price, so it only happens on a compacted
#                         session; one whose % did not drop keeps its model
# Reads:   `claude agents --json` (name, id, sessionId, status)
#          <state-dir>/ctx-<sessionId>.json, field `used` = context % of the session. Claude Code does not write it:
#          a status line does (see examples/statusline-state.sh in this plugin)
#          /tmp/claude-<uid>/*/<sessionId>/tasks (files touched in the last 10 minutes = active tasks)
# Writes:  nothing on disk; opens and closes a tmux window per compacted session (needs a tmux server). The window is
#          labelled `cmp-<id>` but driven by its unique tmux id (@N), so a leftover window with that name cannot
#          make the target ambiguous.
# Output:  one line per candidate: "<name>: <before>% -> <after>% (<status>)", or why it was skipped (not idle, active
#          tasks, or tmux returned no window id: nothing is sent and the next session goes on). When the context did not
#          drop under 20 % within 5 min the line says "NOT compacted", so a watcher cannot take "87% -> 87%" as done.
# Env:     CLAUDE_STATE_DIR   where the ctx-<sessionId>.json files live (default: <claude-home>/state, with
#                             <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude)
# Exit:    0 done · 1 no tmux server (it cannot attach) · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
STATE_DIR="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
UMBRAL=50; EXCEPTO=(); SOLO=(); MODELO=""
usage() { echo "usage: cajaritos-compactar.sh [--umbral N] [--excepto <name>]... [--solo <name>]... [--modelo M]"; }
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    --umbral) UMBRAL="$2"; shift 2 ;;
    --excepto) EXCEPTO+=("$2"); shift 2 ;;
    --solo) SOLO+=("$2"); shift 2 ;;
    --modelo) MODELO="$2"; shift 2 ;;
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
  # The name is only a label: a leftover window with the same name makes `session:name` ambiguous, so every later call
  # targets the unique window id (@N) that new-window prints.
  w="cmp-$id"
  wid=$(tmux new-window -d -P -F '#{window_id}' -t "$TMUX_SES" -n "$w" "claude attach $id" 2>/dev/null)
  case "$wid" in @*) ;; *) echo "$nombre: ${antes}% but tmux gave no window id, skipping"; continue ;; esac
  sleep 6
  tmux send-keys -t "$wid" '/compact'; sleep 1; tmux send-keys -t "$wid" Enter
  compactada=0
  for _ in $(seq 1 60); do sleep 5; u=$(jq -r '.used // 100' "$f" 2>/dev/null); [ "$u" -lt 20 ] 2>/dev/null && { compactada=1; break; }; done
  cambio=""
  if [ -n "$MODELO" ] && [ "$compactada" = 1 ]; then
    tmux send-keys -t "$wid" "/model $MODELO"; sleep 1; tmux send-keys -t "$wid" Enter; sleep 3
    cambio=", model $MODELO"
  fi
  tmux kill-window -t "$wid" 2>/dev/null
  sleep 2
  [ "$compactada" = 1 ] || cambio="$cambio, NOT compacted"
  echo "$nombre: ${antes}% -> $(jq -r '.used' "$f")% ($(claude agents --json | jq -r --arg s "$sid" '.[]|select(.sessionId==$s)|.status')$cambio)"
done
