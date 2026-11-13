#!/usr/bin/env bash
# daily-close-cron.sh: EXAMPLE of a system cron that gives a live Claude Code session a once-a-day job, with a
# day mark that makes it idempotent. Copy it and change the message; the pattern is what matters.
#
# The pattern:
#   - the system cron fires a script; the script sends a message to the OWNER session (claude-session-msg.sh);
#   - the job is one per day, so the day mark decides whether to send:
#       <mark-dir>/<YYYY-MM-DD>.running   the job started (the session creates it)
#       <mark-dir>/<YYYY-MM-DD>.done      the job finished (the session renames .running to .done)
#   - a .running older than 3 h is taken as dead (the job crashed) and a retry is allowed;
#   - if the owner session is not alive, a fallback session gets the message with a note;
#   - there is no acknowledgement: the cron is not a session and receives no replies. The marks are the only signal.
#
# Usage:   daily-close-cron.sh [<owner session> [<fallback session>]]
#            defaults: owner "daily-close", no fallback (or CLOSE_OWNER / CLOSE_FALLBACK)
#          crontab:  0 21 * * * daily-close-cron.sh daily-close coordinator
# Reads:   the day marks in the mark dir
# Writes:  nothing but the message (the SESSION writes the marks)
# Env:     CLOSE_MARK_DIR   mark dir (default: $HOME/.cache/claude-daily-close)
#          CLOSE_OWNER, CLOSE_FALLBACK   the sessions, when they are not arguments
# Exit:    0 delivered, or nothing to do today · 1 no session alive to receive it
# (optional local config file: the same one the scripts of bin/ load; see README. A copy of this example has no
#  ../bin/_env.sh next to it and simply skips it)
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../bin/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
owner="${1:-${CLOSE_OWNER:-daily-close}}"; fallback="${2:-${CLOSE_FALLBACK:-}}"
day=$(date +%F)
dir="${CLOSE_MARK_DIR:-$HOME/.cache/claude-daily-close}"; mkdir -p "$dir"
[ -e "$dir/$day.done" ] && exit 0
if [ -e "$dir/$day.running" ] && [ -z "$(find "$dir/$day.running" -mmin +180)" ]; then exit 0; fi

msg="Daily close of $day (system cron). First of all: if $dir/$day.done exists, or $dir/$day.running exists and is
less than 3 hours old, today's close already ran or is running: answer 'today's close already ran' and do nothing
else. If not: create $dir/$day.running, run your closing routine, and when you finish rename the .running to
$day.done. Last of all, leave one line in your final message saying the close is done."

send="$(command -v claude-session-msg.sh || echo "$(dirname "$(readlink -f "$0")")/../bin/claude-session-msg.sh")"
"$send" "$owner" daily-close "$msg" && exit 0
if [ -n "$fallback" ]; then
  "$send" "$fallback" daily-close "The session '$owner' is not alive. $msg" && exit 0
fi
echo "daily-close-cron: no live session to receive it ($owner${fallback:+, $fallback}) ($day)" >&2
exit 1
