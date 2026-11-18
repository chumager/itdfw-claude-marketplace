# Portfolio (`cartera`): each session publishes its work blocks and its tasks

> The portfolio **is not merged with ALM even if it looks similar**: the portfolio is the coordination of the agents between design and testing (minutes or hours, it works with the back down); ALM is the life cycle of the customer's projects. They are complementary: some day the portfolio may also publish into ALM, without depending on it.

The owner sees, in a strip of the `itdfw` session, what each session has in progress. **Everything that is not moving must explicitly be because it is waiting for something**, never because someone stayed staring at the ceiling.

```
~/bin/cartera.sh tarea "<block>" "<task>" en-curso [--espera "<what>"]
~/bin/cartera.sh tarea "<block>" "<task>" pendiente --go | --pregunta "<q>"
~/bin/cartera.sh tarea "<block>" "<task>" parqueada --espera "<condition>"
~/bin/cartera.sh tarea "<block>" "<task>" terminado
~/bin/cartera.sh rutina "<text>"          # what never closes (a daily pass); --quitar removes it
~/bin/cartera.sh list                       # your blocks, tasks and routines
```

- **Block**: a job with several tasks. Its state is not published: it is **active** while it has any task not finished and **finished** when all of them are.
- **Task**:

| State | When |
|---|---|
| `en-curso` (in progress) | you carry it and it does not depend on the owner, even if it takes hours. If it waits for the lab or another session, it goes with `--espera "<what>"` |
| `pendiente --go` (pending, GO) | waits for the owner's go-ahead (he gets a GO button) |
| `pendiente --pregunta "<q>"` (pending, question) | waits for an answer from the owner (he gets a field) |
| `parqueada --espera "<condition>"` (parked) | it does not run and is not the owner's today: it is resumed on a condition ("the next release", "payment order", "11-nov") |
| `terminado` (finished) | tested and ready for review |

- 🔴 **The state says who has the ball.** If the owner is needed to continue, it is `pendiente` with `--go` or `--pregunta`, never an `--espera "your GO"`: otherwise it does not show up as his.
- A task in progress with no changes for more than 1 hour shows up red: nobody has said anything and someone has to look. If you are still on it, publish it again (the clock restarts) and say what you are waiting for. If it no longer runs, it is `parqueada`.
- 🔴 **Every block carries a description** (`cartera.sh describir "<block>" "<text>"`): what it is in domain terms, why it matters, and where the detail is (TDD, finding). A task that waits for the owner carries its own (`describir "<block>" "<task>" "<text>"`), with what he needs to know to decide right there without asking.
- 🔴 **What is awaited has to be actionable**: who unblocks it and when, or what is needed. "Waiting for the lab window" says nothing; "waiting for core to free the lab (~15:00, after #241)" does.
- The owner's GO or answer reaches you as a message from him; there you move the task to `en-curso`.
- Block and task are the key: one line in domain terms, under 60 characters, the same text on every change (`list`).
- A task of an agent (fork, subagent) is published by the session that launched it.
- **Never archive**: the ✔ on a finished block is pressed by the owner. It stays in the file, hidden.
- **A repeated block of yours** (left over from the migration) is not marked finished, because that would lie: it is removed with `~/bin/cartera.sh quitar "<old block>" --duplicado-de "<block that stays>"`. It stays hidden with the trace.
- The files live in `~/.claude/state/cartera/<session>.json`; they are not edited by hand.

## The CTO administers the state and records his decisions

```
~/bin/cartera.sh nota "<session>" "<block>" "<task>" "<current state in one line>"     # "" deletes it
~/bin/cartera.sh decision "<topic>" "<decision>" "<why>" ["<what it costs to undo>"]
```

- **Note**: the CTO keeps, on each task in progress, a line saying where it stands. It shows in the strip.
- **Decision**: every decision the CTO takes in his layer is recorded in `~/.claude/state/decisiones.jsonl` (append only). `itdfw` receives it at once and brings to the table whatever is irreversible or clashes with an objective. A decision that is not recorded does not exist.
