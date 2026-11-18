#!/usr/bin/env bash
# prompt-context.sh: UserPromptSubmit hook. Whatever it prints on stdout goes into the model's context for that prompt.
# It gives the session four facts it cannot know by itself, on EVERY prompt:
#   1. the real date and time of the system, with a hint that it beats the date frozen in the system prompt (a
#      session lives for days; the date in its environment is the one of the day it started)
#   2. [PRESENCIA]  whether the person is in front of the laptop (no tmux client attached = not), and what to do about it
#   3. [CONTEXTO]   how much of the context window this session has used, and what to do from 75 % and from 90 %
#   4. [MODELO]     the model and the effort of this session, as its last status line reported them
# The tags keep the names they had before this script was published: other texts refer to them.
#
# Usage:   prompt-context.sh            (the hook payload comes on stdin)
# Reads:   stdin (the hook JSON; only session_id is used);
#          <state-dir>/ctx-<session id>.json  written by the status line: {"used": <percent>, "model": "...", "effort": "..."}
#          owner-present.sh of the itdfw-sessions plugin, found through _sessions.sh
# Writes:  stdout only
# Env:     CLAUDE_STATE_DIR   state dir (default: <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude)
#          CLAUDE_BROADCAST_FROM, ITDFW_SESSIONS_BIN   see _sessions.sh
# Exit:    0 always (a session with no ctx file, for instance before its first status line, just gets fewer lines)
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_sessions.sh"
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac

date
echo "[HINT FECHA/HORA] ↑ This line is the REAL date/time of the system (local timezone), emitted on EVERY prompt. It is the truth. If the ENV / system prompt declares another date (it is frozen when the session starts, and sessions live long), THAT one is stale — IGNORE it and use this one. Do not get disoriented by the ENV one."

# a prompt typed from the phone (Remote Control) arrives with no tmux client: then the replies that matter go by push too
if "$(sessions_script owner-present.sh)" >/dev/null; then
  echo "[PRESENCIA] $OWNER is at the laptop."
else
  echo "[PRESENCIA] $OWNER is NOT at the laptop (typing from the phone or gone): what they must know or decide also goes out as a PushNotification; a question that blocks your work goes through ask-owner.sh."
fi

stdin=$(cat 2>/dev/null)
sid=$(printf '%s' "$stdin" | jq -r '.session_id // empty' 2>/dev/null || true)
ctx="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}/ctx-$sid.json"

# the status line keeps the percent per session; a session without its file (no status line yet) simply prints nothing
used=$(jq -r '.used // empty' "$ctx" 2>/dev/null || true)
if [ -n "$used" ]; then
  if [ "$used" -ge 90 ] 2>/dev/null; then
    echo "[CONTEXTO] ${used}% — about to compact: leave written down the state of whatever is half done (TDD, run log, queue) and commit what is proven; delegate with a fresh subagent (fork is blocked)."
  elif [ "$used" -ge 75 ] 2>/dev/null; then
    echo "[CONTEXTO] ${used}% — a fork is blocked: delegate with a fresh subagent (self-contained brief) and close units of work before opening others."
  else
    echo "[CONTEXTO] ${used}%"
  fi
fi

# model and effort of THIS session, according to the last status line (the session cannot see them by itself)
mdl=$(jq -r '[.model // empty, .effort // empty] | map(select(. != "")) | join(" · ")' "$ctx" 2>/dev/null || true)
[ -n "$mdl" ] && echo "[MODELO] $mdl"
exit 0
