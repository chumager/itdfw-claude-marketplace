#!/usr/bin/env bash
# Detached from the PermissionDenied hook: asks the person about the denial (ask-owner.sh) and sends the result to the
# denied session over its socket (claude-session-msg.sh). It always ends: the popup closes after 5 minutes.
# If the denied agent is a subagent, the message reaches its parent session (subagents have no socket).
#   usage: permission-denied-ask.sh "<session>" "<who>" "<reason>" "<command>"
# Reads:   the answer of ask-owner.sh and claude-session-msg.sh, both from the itdfw-sessions plugin
# Writes:  one message to the session; when no live session has that name, one line in ~/.cache/claude-denials/undelivered.log
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_sessions.sh"
session="$1"; who="$2"; reason="$3"; what="$4"
ANS=$("$(sessions_script ask-owner.sh)" "⛔ $who: denied $reason
$what
To approve it: /permissions → Recently denied → r" \
  "I approve it in /permissions" "Do not do it")
case $? in
  0) case "$ANS" in
       "I approve it in /permissions")
         msg="$OWNER is going to approve the denied action in /permissions ($reason): $what. Try again in 5 min (CronCreate one-shot); if it is denied again, ask them again with ask-owner.sh." ;;
       "Do not do it")
         msg="$OWNER does NOT approve the denied action ($reason): $what. Carry on without it or find another way that does not need it." ;;
       *) msg="About the denied action ($reason): $what — $OWNER answered: $ANS" ;;
     esac ;;
  *) msg="An action of yours was denied ($reason): $what — and $OWNER did not answer the notice ($ANS). Send them a PushNotification with what to approve (/permissions → Recently denied → r) and a CronCreate one-shot in 5 min to ask again; meanwhile, carry on with whatever does not depend on it." ;;
esac
"$(sessions_script claude-session-msg.sh)" "$session" "hook:permissions" "$msg" ||
  printf '%s\n' "$(date '+%F %T') no session '$session' to deliver to: $msg" >> "$HOME/.cache/claude-denials/undelivered.log"
