#!/usr/bin/env bash
# PreToolUse(Bash): every command sent with run_in_background runs under a 10-minute cap.
# A foreground Bash call is already cut by the harness at 10 minutes; a background one has no cap, and a loop such as
# `until grep -q DONE log; do sleep 3; done` waits forever when the line never comes, keeping its session "busy".
#
# The WHOLE command line is wrapped, not prefixed: `timeout 600 ls; forever.sh` would cap only `ls`. Inside
# `bash -c '<line>'` every part (`;`, `&&`, `|`) dies with that bash. `-k 10` sends KILL ten seconds after TERM.
# Exit 124 means the cap cut it.
#
# No permissionDecision is returned: the rewritten call still goes through the normal permission evaluation (a hook
# that rewrote and also allowed would skip the permission check).
# A process the line detaches on purpose (`back-solo.sh start`, with its own --ttl) is not its child and survives.

CAP=600
input=$(cat)
[ "$(jq -r '.tool_input.run_in_background // false' <<<"$input")" = true ] || exit 0
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
[ -n "$cmd" ] || exit 0
prefix="timeout -k 10 $CAP bash -c "
[[ "$cmd" == "$prefix"* ]] && exit 0

wrapped="$prefix$(printf '%q' "$cmd")"
jq -n --argjson ti "$(jq -c '.tool_input' <<<"$input")" --arg c "$wrapped" --arg cap "$CAP" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: ($ti + {command: $c}),
    additionalContext: ("This background command runs under a " + $cap + " s cap (timeout); exit 124 means the cap cut it. Wait for a signal, not a loop.")
  }
}'
exit 0
