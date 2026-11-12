#!/usr/bin/env bash
# cron-owner-guard.sh: owner guard for cron scripts. Every cron has ONE owner session. If another session runs it (for
# example a compaction replays the cron setup, or a stale cron was left hanging in it), the script exits with no work
# instructions and with the order to drop that cron. A duplicate fixes itself on the next firing.
#
# Usage (sourced):   . cron-owner-guard.sh <owner session> <label> || exit 0
#   (a cron script sources it first thing; when it returns 1 the script must stop)
# Reads:   the name of the running session, from <claude-home>/sessions/<pid>.json, where <pid> comes from CLAUDE_PID
#          (Claude Code sets it). A caller that already resolved the name another way passes it in CRON_SESSION_NAME.
# Writes:  on a mismatch, two lines on stdout telling the session to do nothing and to delete its cron (CronDelete).
# Env:     CLAUDE_PID, CLAUDE_CONFIG_DIR (default: $HOME/.claude), CRON_SESSION_NAME (overrides the lookup)
# Exit/return:   0 this is the owner session · 1 this is another session
# Run directly with --help to read this text.
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; return 0 2>/dev/null || exit 0 ;; esac
cron_owner="$1"; cron_label="$2"
cron_me=${CRON_SESSION_NAME:-$(jq -r '.name // ""' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions/${CLAUDE_PID:-none}.json" 2>/dev/null)}
if [ "$cron_me" != "$cron_owner" ]; then
  echo "$cron_label: this cron belongs to session '$cron_owner' and you are '${cron_me:-no name}'. Do nothing for this"
  echo "cron (no workflow, no CronCreate). If you have a cron that calls this script, delete it with CronDelete."
  return 1 2>/dev/null || exit 1
fi
return 0 2>/dev/null || exit 0
