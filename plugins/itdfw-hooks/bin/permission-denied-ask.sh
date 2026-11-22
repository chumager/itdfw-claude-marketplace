#!/usr/bin/env bash
# Detached from the PermissionDenied hook: asks the person about the denial (ask-owner.sh) and passes on the answer.
# It always ends: the popup closes after 5 minutes. If the denied agent is a subagent, it all goes to its parent session
# (subagents have no socket and no chat of their own; the approval frees the parent, which runs the action itself).
#   "I approve it: type it in"  the approval is typed into the session's own chat, as the person's words, through
#                               cajarito-teclear.sh (only while the session is at rest, waiting up to 30 min): a fixed
#                               text that carries the denied command verbatim, the same
#                               text the popup showed (one that cannot be shown whole is not offered). A message over the socket would not do:
#                               a session must never take a peer's message as the person's approval. If it cannot be
#                               typed (no tmux, no such session), the session gets the /permissions route instead
#   "I approve it in /permissions", "Do not do it", or free text: a message over the socket (claude-session-msg.sh)
#   usage: permission-denied-ask.sh "<session>" "<who>" "<reason>" "<command>" ["<full command>"]
# Reads:   the answer of ask-owner.sh; cajarito-teclear.sh and claude-session-msg.sh, all from the itdfw-sessions plugin
# Writes:  the typed approval (logged by cajarito-teclear.sh) or one message to the session; when no live session has
#          that name, one line in ~/.cache/claude-denials/undelivered.log
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_sessions.sh"
session="$1"; who="$2"; reason="$3"; what="$4"; full="${5:-$4}"
# What the popup shows is exactly what gets typed: one value, wrapped at 70 columns for the eye only (fold adds line
# breaks to the view, never to the typed text), so every character fits in the popup (80 % of the terminal). It is
# offered for typing only when every character can be seen: at most 500 characters (8 lines), and no invisible or
# direction-changing Unicode (format, private-use, unassigned or control characters). Otherwise only the /permissions
# route, so the person never approves text they did not see.
opts=(); shown="$what"
# fail closed: only an explicit "clean" from the check offers typing; no perl or any error is "not offered"
veredicto=$(printf '%s' "$full" | perl -CS -e 'local $/; my $s = <STDIN> // ""; print(($s =~ /[\p{Cf}\p{Co}\p{Cn}\p{Cc}]/) ? "dirty" : "clean")' 2>/dev/null)
if [ ${#full} -le 500 ] && [ "$veredicto" = clean ]; then
  shown=$(printf '%s' "$full" | fold -w 70); opts=("I approve it: type it in")
fi
ANS=$("$(sessions_script ask-owner.sh)" "⛔ $who: denied $reason
$shown
To approve it: /permissions → Recently denied → r" \
  "${opts[@]}" "I approve it in /permissions" "Do not do it")
case $? in
  0) case "$ANS" in
       "I approve it: type it in")
         # typed only when it was offered: the same words written as free text, for a command too long to show, are not it
         if [ ${#opts[@]} -gt 0 ]; then
           "$(sessions_script cajarito-teclear.sh)" --espera 30 "$session" \
             "I approve the action the classifier denied you ($reason): $full. Retry it exactly as it was." >/dev/null 2>&1 && exit 0
           msg="$OWNER approved the denied action ($reason): $what, but it could not be typed into your chat. Ask them to approve it in /permissions (Recently denied → r), and carry on with whatever does not depend on it."
         else
           msg="About the denied action ($reason): $what — $OWNER answered: $ANS"
         fi ;;
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
