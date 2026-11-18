# A cron or a script talks to a live session with `claude-session-msg.sh`, not with `claude -p`

For unattended work that needs a session's tools (subagents, Artifact, PushNotification, its context), the cron sends a message to the owning session instead of launching a loose `claude -p`.

```
~/bin/claude-session-msg.sh "<session>" <sender> "<text>"   # exit 0 delivered · 1 no live session with that name
~/bin/claude-session-msg.sh "<session>" <sender> < file     # with no text it reads from stdin (no cap; an argument dies above ~128 KB)
```

| Step | What is done |
|---|---|
| deliver | finds the record by exact name in `~/.claude/sessions/` and delivers through its socket as `from="<sender>"`, as is |
| the sender | a session puts its name, and whoever receives can answer it with `SendMessage`. What is not a session says what it is, in the form `<type>:<name>` (table below). Never the name of whoever receives |
| exit 1 | the message is lost, it is not queued: `~/bin/cajarito-despertar.sh "<session>"`, wait a few seconds and retry ONCE; if it fails again, error to stderr and nothing more |
| knowing it finished | there is no acknowledgment: the cron is not a session and does not receive replies. The session creates `<dir>/<date>.running` at start and renames it to `.done` at the end (a `.running` older than 3 h is taken as dead). The message text asks for it explicitly |
| notifying the owner | the session does it when it finishes (push or portfolio), not the cron |

## 🔴 The sender convention: `<type>:<name>` is external and is not answered

| Sender | What it is | Is it answered? |
|---|---|---|
| a name without a colon (`CTO`, `core`, `cierre diario`) | a session | **yes, always**: the result goes back to it with `SendMessage`, in addition to what is told to the owner |
| `cron:<x>`, `hook:<x>`, `script:<x>` | a process | no: there is nobody to read the reply |
| `room:<room>` | a line from a room | not by `SendMessage`: whatever applies is said in the room (`sala-se-escucha`) |
| `broadcast:jcmunoz`, `cartera:jcmunoz` | the owner's words delivered by a tool | no: they are acted upon; the owner is spoken to in the chat |

- A session name does not carry a colon: a session named `x:y` would be treated as external.
- Whoever builds a tool that writes to sessions chooses its `<type>` and adds it to this table.
- The `vuelta` mod (in testing) enforces it: a message from a session opens a reply debt, and a turn that closes without paying it gets the reminder; external ones open nothing.

- Model to copy: `~/bin/claude-cierre-cron.sh` (day mark, backup session if the owner is not there).
- The subagents the session raises run with that session's account.
- Siblings: `despertar-cajarito`, `compactar-al-cierre`.
