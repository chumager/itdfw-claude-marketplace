# When the daily close ends, the agents that are over 50 % are compacted, each with its thread written down

| Who | What they do |
|---|---|
| `cierre diario` (daily close) | when its close ends, tells the `CTO`: "cierre listo, compacta" (close done, compact) |
| `CTO` | `~/bin/hilo-pedir.sh --excepto CTO`: asks for the thread ONLY from those over 50 % (the others are not woken up) |
| each session asked | finishes its work, writes its thread to `~/.claude/state/hilo/<name>.md` and runs `~/bin/hilo-listo.sh` |
| `CTO` | watches `~/.claude/state/compactables/`: for each mark, `~/bin/cajaritos-compactar.sh --solo <name> --umbral 0` and deletes the mark. At the end, the result goes to the owner |
| `CTO` over 50 % | writes his thread, runs `hilo-listo.sh` and asks `itdfw` to compact him (`--solo CTO`): a session does not compact itself |

- 🔴 **During the day, an idle session over 50 % is compacted by itself**: the user timer `cajaritos-compactar.timer` runs `cajaritos-compactar.sh --umbral 50 --quieto 15 --aunque-ocupada` every 10 min (no turn in 15 min and no active tasks = at rest, even if the daemon still says `busy`). A big context re-read on every turn is where the weekly quota goes (21-nov: >80 % of the cost was cache reads). Each session's auto-compaction keeps going on its own.
- 🔴 **Every compaction returns the thread**, manual or automatic: the `PreCompact` hook (`hilo-capturar.sh`) saves the last 100 messages (each cut to 4,000 characters) and the `PostCompact` hook (`hilo-devolver.sh`) sends the session its summary of the day and those messages, as a message from the sender `hilo`. On receiving it, it is read in full and work resumes from there.
- The compaction script skips whatever is not idle or has tasks from the last 10 min, and leaves the session alive.
  🔴 **A skipped session is not forgotten**: the `CTO` keeps watching the ones that were still working at close and
  compacts each one as soon as it goes idle with its thread written, even hours later. The close is not done while one
  over 50 % is left uncompacted.
- 🔴 **Waiting for it to go idle is a subscription, not a retry loop**: `SendMessage({to: "<name>", notify_when_idle:
  true})` with no message, and the compaction runs when the notice arrives. The script decides by the daemon's status,
  which can read `busy` while the session's harness reports idle: if the script skips it on the notice, run it again
  with `--quieto 15 --aunque-ocupada`, which trusts the last turn instead of the daemon. Measured 21-nov: a
  subscription to a session that is already idle fires at once, and two sessions read `busy` 30 min after their last
  turn.
- Each session's % is in `~/.claude/state/ctx-<sessionId>.json`. Detail: `memory/reference_revivir-cajarito.md`.
