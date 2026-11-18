---
name: broadcast
description: A message from the user to every live Claude Code session on the machine, including the one that receives it. Only the user invokes it, with /broadcast <text>.
argument-hint: <text for every session>
disable-model-invocation: true
allowed-tools: Bash(claude-broadcast.sh:*)
---

The user wrote a message for ALL the sessions: $ARGUMENTS

1. If the text is empty, tell them the usage in one line (`/broadcast <text>`) and do nothing else.
2. Deliver it to the other sessions with Bash, passing the text in single quotes, properly escaped (or with `printf %q`):
   `claude-broadcast.sh '<the text as it is>' "broadcast:${CLAUDE_BROADCAST_FROM:-user}"`
   (the sender carries a prefix because it is not a session: nobody answers it with SendMessage. If the person's name
   is set in the sessions plugin's config file rather than in your shell, use that name after the colon)
3. The message is also for you: act on it as if it had been written to you directly.
4. Your answer: one line with the delivery (how many sessions received it and which ones failed, if any) and, below it,
   what falls to you according to the message. Do not list the ones that succeeded.
