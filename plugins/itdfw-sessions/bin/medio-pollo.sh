#!/usr/bin/env bash
# medio-pollo.sh: each PMO's worker in Code Mode, one per PMO, in its own window of the tmux session "½ pollo".
# The PMO calls it itself; nothing else manages these windows. A medio pollo runs in the foreground; it is alive when
# its window exists and the session record named after it points to a live process.
#
# Usage:   medio-pollo.sh up <PMO> [--fresh]  ensure it is running (idempotent): creates the tmux session or the window if
#                                missing and launches claude; if it fell, it RESUMES its last session (its context
#                                survives), unless --fresh
#   medio-pollo.sh clear <PMO>   types /clear when it is at rest
#   medio-pollo.sh down <PMO>    closes its window
#   medio-pollo.sh list          the medio pollos and whether claude runs in each
#
# Launch (as the pane's own process): CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1 claude -n "medio pollo de <PMO>" --model sonnet --effort high, from the
# monorepo; the "turn on Code Mode" question is answered with Down + Enter.
# Reads:   tmux; <claude-home>/sessions/*.json (pid, status, sessionId)
# Writes:  <state-dir>/medio-pollo/<PMO>.sid, the last sessionId, refreshed on every up and clear
# Exit:    0 done · 1 failed (no tmux server, claude did not come up, not at rest) · 2 bad usage
set -uo pipefail
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
TS="½ pollo"
ROOT="${MEDIO_POLLO_CWD:-$HOME/Dropbox/Develop/node.js/itdfw-monorepo}"
verb="${1:-}"; pmo="${2:-}"; fresh="${3:-}"
STATE="${CLAUDE_STATE_DIR:-$HOME/.claude/state}/medio-pollo"; mkdir -p "$STATE"
usage() { echo "usage: medio-pollo.sh up|clear|down <PMO> | list (--help)" >&2; exit 2; }
tmux info >/dev/null 2>&1 || { echo "no tmux server"; exit 1; }
win() { printf '=%s:%s' "$TS" "$1"; }
has_win() { tmux list-windows -t "=$TS" -F '#{window_name}' 2>/dev/null | grep -Fxq "$1"; }
# alive = its window exists and the session record named after it points to a live process (tmux reports the pane's
# shell, not claude, as its current command)
running() {
  has_win "$1" || return 1
  local pid; pid=$(jq -rs --arg n "medio pollo de $1" '[.[] | select(.name == $n)][0].pid // empty' \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/sessions/*.json 2>/dev/null)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}
status_of() {
  jq -rs --arg n "medio pollo de $1" '[.[] | select(.name == $n)][0].status // empty' \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/sessions/*.json 2>/dev/null
}

sid_of() {
  jq -rs --arg n "medio pollo de $1" '[.[] | select(.name == $n)][0].sessionId // empty' \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/sessions/*.json 2>/dev/null
}
save_sid() { local s; s=$(sid_of "$1"); [ -n "$s" ] && printf '%s\n' "$s" > "$STATE/$1.sid"; }
# a fallen medio pollo is resumed with its last session, unless --fresh or there is none saved
cmd() {
  local resume=""
  local sid; sid=$(cat "$STATE/$1.sid" 2>/dev/null)
  # a session with no message yet (just launched or cleared) has no transcript and cannot be resumed: start fresh
  if [ "$fresh" != "--fresh" ] && [ -n "$sid" ] &&
     compgen -G "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/*/$sid.jsonl" >/dev/null; then resume="--resume $sid"; fi
  printf "env CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1 claude -n 'medio pollo de %s' --model sonnet --effort high %s" "$1" "$resume"
}

# claude is the pane's own process (no shell in between): when claude ends, its window closes, and the next `up`
# recreates it. The Code Mode question is answered with Down + Enter.
launch() {
  local t; t=$(win "$1")
  # the question may not come (a resumed session): wait for either the question or the session record
  for _ in $(seq 1 40); do
    if tmux capture-pane -p -t "$t" 2>/dev/null | grep -q "turn on Code Mode"; then
      tmux send-keys -t "$t" Down; sleep 0.5
      tmux capture-pane -p -t "$t" 2>/dev/null | grep -q "❯ Yes, turn on Code Mode" && tmux send-keys -t "$t" Enter
      break
    fi
    running "$1" && break; sleep 1
  done
  for _ in $(seq 1 40); do running "$1" && { save_sid "$1"; echo "medio pollo de $1: up"; return 0; }; sleep 1; done
  echo "medio pollo de $1: claude did not come up (look at window '$1' of '$TS')"; return 1
}

case "$verb" in
  up)
    [ -n "$pmo" ] || usage
    running "$pmo" && { save_sid "$pmo"; echo "medio pollo de $pmo: already up"; exit 0; }
    if ! tmux has-session -t "=$TS" 2>/dev/null; then tmux new-session -d -s "$TS" -n "$pmo" -c "$ROOT" "$(cmd "$pmo")"
    elif has_win "$pmo"; then tmux respawn-pane -k -t "$(win "$pmo")" -c "$ROOT" "$(cmd "$pmo")"
    else tmux new-window -d -t "=$TS:" -n "$pmo" -c "$ROOT" "$(cmd "$pmo")"; fi
    launch "$pmo" ;;
  clear)
    [ -n "$pmo" ] || usage
    running "$pmo" || { echo "medio pollo de $pmo: not running"; exit 1; }
    case "$(status_of "$pmo")" in
      idle|shell) tmux send-keys -t "$(win "$pmo")" -l '/clear'; tmux send-keys -t "$(win "$pmo")" Enter
                  sleep 2; save_sid "$pmo"; echo "medio pollo de $pmo: cleared" ;;
      *) echo "medio pollo de $pmo: busy, not cleared"; exit 1 ;;
    esac ;;
  down)
    [ -n "$pmo" ] || usage
    has_win "$pmo" && tmux kill-window -t "$(win "$pmo")"; echo "medio pollo de $pmo: down" ;;
  list)
    for w in $(tmux list-windows -t "=$TS" -F '#{window_name}' 2>/dev/null); do
      running "$w" && echo "$w up" || echo "$w down"; done ;;
  *) usage ;;
esac
