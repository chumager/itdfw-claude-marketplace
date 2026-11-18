#!/bin/sh
# StopFailure: a turn ended with an API error after exhausting its retries (CLAUDE_CODE_RETRY_WATCHDOG=1 raises them to
# ~300 for dropped connections). Claude Code ignores this hook's output: it only leaves a record of which session fell
# over and with what `error`, to know whether the watchdog is enough and what value an ECONNRESET carries (the docs do
# not say).
# Reads:   the hook JSON on stdin (session_id, cwd, error, error_details, last_assistant_message)
# Writes:  one JSON line appended to <claude-home>/stopfailure.log. It includes the last assistant message, which may
#          hold private content: treat the file as private
# Exit:    the exit code of jq (0 when the line was written)
jq -c --arg at "$(date -Is)" '{at: $at, session_id, cwd, error, error_details, last_assistant_message}' \
  >> "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/stopfailure.log"
