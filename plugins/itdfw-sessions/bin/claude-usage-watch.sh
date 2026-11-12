#!/usr/bin/env bash
# claude-usage-watch.sh: read the Claude Code /usage without an open session and leave it as one line plus a log.
#   claude-usage-watch.sh            -> "10:35  semana: 23% (reset Mon 09:00)  fable: 4%"
#   claude-usage-watch.sh --loop 300 -> every 5 min, stacking lines in <state-dir>/usage.log
# Each reading opens a mini headless session (`claude -p "/usage"`, --safe-mode, no MCP servers; /usage is local, 0
# tokens, measured 2026-09-16): it is not free, do not run it every 30 s.
# The line keeps its labels "semana:" and "fable:" on purpose: usage.log is append-only and older lines use them.
# "semana:" is the weekly quota; "fable:" is the per-model line of the /usage text (the model named in it, if the
# account has one; "?" when it is absent).
#
# Usage:   claude-usage-watch.sh [--loop <seconds>]
# Reads:   <state-dir>/usage-week   "<percent> <resets_at epoch>", left by a status line from the JSON Claude Code gives
#                                   it (rate_limits.seven_day). Optional: the /usage text is the fallback
#          the output of `claude --safe-mode --model haiku -p "/usage" --output-format json`
# Writes:  <state-dir>/usage.log     one "<date> <line>" per reading
#          <state-dir>/usage-fable   the per-model percent alone, for a status line to `cat` without opening a session
# Env:     CLAUDE_STATE_DIR   state dir (default: <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or
#                             $HOME/.claude)
# Exit:    0 normally; 1 when `claude -p` gave no answer (one reading); --loop never returns
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -u
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"   # cron brings a minimal PATH and claude lives in ~/.local/bin
STATE_DIR="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
LOG="$STATE_DIR/usage.log"
mkdir -p "$STATE_DIR"

read_usage() {
  local raw
  # DISPLAY= and --safe-mode: no MCP (Serena starts a Chrome per session); /usage is local, 0 tokens (measured 2026-09-16)
  raw="$(cd "$HOME" && DISPLAY= claude --safe-mode --model haiku -p "/usage" --output-format json 2>/dev/null | jq -r '.result // empty')"
  [ -z "$raw" ] && { echo "$(date +%H:%M)  no answer from claude -p"; return 1; }
  local sw rw
  # the 5-hour limit no longer exists (Anthropic, 2026-11): only the week. A status line can leave it in usage-week
  # from the JSON Claude Code hands it (rate_limits.seven_day); the /usage text is only the fallback
  if read -r wpct wreset < "$STATE_DIR/usage-week" 2>/dev/null && [ -n "$wpct" ]; then
    sw="$(printf '%.0f%%' "$wpct")"
    rw="$(date -d "@$wreset" '+%a %H:%M' 2>/dev/null)"
  else
    sw="$(printf '%s' "$raw" | grep -io 'current week (all models):[^%]*%' | grep -o '[0-9]\+%' | head -1)"
    rw="$(printf '%s' "$raw" | grep -i 'current week (all models)' | grep -io 'resets [^·\n]*' | head -1 | sed 's/resets //')"
  fi
  # the per-model line (fable here) only exists in the /usage text: the status line JSON does not carry it
  local sf
  sf="$(printf '%s' "$raw" | grep -io 'current week (fable):[^%]*%' | grep -o '[0-9]\+%' | head -1)"
  local line="$(date +%H:%M)  semana: ${sw:-?} (reset ${rw:-?})  fable: ${sf:-?}"
  echo "$line"
  printf '%s %s\n' "$(date +%F)" "$line" >> "$LOG"
  printf '%s' "${sf:-}" > "$STATE_DIR/usage-fable"   # a status line reads it with a cat, without opening a session
}

if [ "${1:-}" = "--loop" ]; then
  every="${2:-300}"
  while true; do read_usage; sleep "$every"; done
else
  read_usage
fi
