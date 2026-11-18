# A dead agent is woken up with a command; the owner is not asked

If you need something from another session and it is dead (`SendMessage` answers "No agent named '<x>' is reachable", or it does not show in `ListAgents`), you wake it yourself and then send the message:

```
~/bin/cajarito-despertar.sh "<name>"; echo "exit=$?"   # 0 alive · 1 did not wake · 2 does not exist or ambiguous
```

- Internally it is `claude --bg --resume <sessionId>`: it raises it in the daemon with the same id, name, agent and model, idle, with no interface and no process to close.
- 🔴 **A bare `claude --resume` does not work**: it opens the interface in the foreground and dies with its terminal.
- Waking is not assigning: the session wakes up with no work. You send the message separately, with what you need.
- **exit 1 or 2**: tell the owner in one line with the name and the script's output.
- Putting a session to sleep is another matter: it is not done with this.

- 🔴 **From a session, who is alive and whether it is busy is looked at with `ListAgents`**, not with `claude agents` through Bash. The command raises an entire harness, which is slow; the tool is already in your process. The command remains for scripts, which need the `sessionId` or the JSON and do not have the tool.
- In `claude agents`: `✻`/`✽` = alive, `∙` = finished; "Pinned" is a mark of the conversation, not of the state.
Detail: `memory/reference_revivir-cajarito.md`.
