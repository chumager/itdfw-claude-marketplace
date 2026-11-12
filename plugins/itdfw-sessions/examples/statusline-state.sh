#!/usr/bin/env bash
# statusline-state.sh: EXAMPLE of a Claude Code status line command that leaves, for the scripts of this plugin, the
# two state files they read. Claude Code does not write them; it only hands the status line a JSON on stdin.
#   <state-dir>/ctx-<sessionId>.json   {"used": <context %>, "size": ..., "model": ..., "effort": ...}
#                                      read by cajaritos-compactar.sh (field `used`)
#   <state-dir>/usage-week             "<weekly percent> <resets_at epoch>"
#                                      read by claude-usage-watch.sh (optional: it has a text fallback)
# Add these lines to your own status line command; this file also prints a minimal line so it runs as one.
#
# Usage:   configured as the statusLine command in settings.json; Claude Code pipes the JSON in
# Reads:   the status line JSON on stdin (session_id, context_window.used_percentage, rate_limits.seven_day, ...)
# Writes:  the two files above
# Env:     CLAUDE_STATE_DIR   state dir (default: <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or
#                             $HOME/.claude)
# Exit:    0 always
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../bin/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
STATE_DIR="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
mkdir -p "$STATE_DIR"
input=$(cat)

sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -n "$sid" ] && printf '%s' "$input" | jq -c '{used: .context_window.used_percentage, size: .context_window.context_window_size, model: .model.display_name, effort: (.effort.level // null)}' \
  > "$STATE_DIR/ctx-$sid.json" 2>/dev/null

week_pct=$(printf '%s' "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null)
week_reset=$(printf '%s' "$input" | jq -r '.rate_limits.seven_day.resets_at // empty' 2>/dev/null)
[ -n "$week_pct" ] && printf '%s %s\n' "$week_pct" "$week_reset" > "$STATE_DIR/usage-week" 2>/dev/null

printf 'ctx %s%%\n' "$(printf '%s' "$input" | jq -r '.context_window.used_percentage // "?"' 2>/dev/null)"
exit 0
