#!/usr/bin/env bash
# master-cron.sh: the dispatcher of the service crons. It runs every executable claude-cron-*.sh of a directory, one
# after the other, printing a "=== <script name> ===" header before each one and a blank line after it. A session that
# lost its crons (a compaction, a restart) runs this once and reads, in one place, what each cron script asks of it.
# Each cron script declares its owner session with cron-owner-guard.sh (this folder): in a session that is not the
# owner it prints "this cron belongs to session X ... delete it with CronDelete" instead of its work, so running the
# dispatcher in any session is safe: it only recreates what that session owns and tells it to drop the rest.
#
# Usage:   master-cron.sh
# Reads:   <cron dir>/claude-cron-*.sh (only the ones with the executable bit; the others are skipped without a word)
# Writes:  stdout: what each script prints. The scripts run with `bash <script>`, in the current directory
# Env:     CLAUDE_CRON_DIR   the directory that holds the claude-cron-*.sh scripts (default: $HOME/bin)
# Exit:    0 always: a cron script that fails does not stop the next one, and its own exit code is not reported
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac

for script in "${CLAUDE_CRON_DIR:-$HOME/bin}"/claude-cron-*.sh; do
  [ -x "$script" ] || continue
  echo "=== $(basename "$script") ==="
  bash "$script"
  echo
done
exit 0
