#!/usr/bin/env bash
# Tells the session that the person is not at the laptop (no tmux client attached), so that THE SESSION decides whether
# what it is about to say deserves a PushNotification or the chat message is enough. It blocks nothing.
#   PostToolUse (every tool): no client attached and this session was not yet told this turn -> additionalContext.
#   Stop: removes the mark, so the first tool of the next turn tells it again if the person is still away.
# The detector is owner-present.sh of the itdfw-sessions plugin (no tmux client = not in front of the laptop).
# Reads:   the hook JSON on stdin (hook_event_name, session_id); owner-present.sh; ~/.cache/claude-away/<session id>
# Writes:  the mark ~/.cache/claude-away/<session id>; on stdout, the additionalContext JSON
# Always exits 0.
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_sessions.sh"
input=$(cat)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty')
sid=$(printf '%s' "$input" | jq -r '.session_id // "unknown"')
dir="$HOME/.cache/claude-away"
mark="$dir/$sid"

if [ "$event" = "Stop" ]; then
  rm -f "$mark"
  exit 0
fi

"$(sessions_script owner-present.sh)" >/dev/null && { rm -f "$mark"; exit 0; }
# already told in this turn
[ -e "$mark" ] && exit 0
mkdir -p "$dir" && : > "$mark"
jq -cn --arg o "$OWNER" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: ($o + " is not at the laptop (no tmux client). If what you are going to say in this turn is something they must know or decide, also send it with PushNotification (one line, the actionable part first); otherwise the chat is enough.")}}'
