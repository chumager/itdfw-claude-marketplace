# Portfolio (`cartera`): each session publishes its work blocks and its tasks

> The portfolio **is not merged with ALM even if it looks similar**: the portfolio is the coordination of the agents between design and testing (minutes or hours); ALM is the life cycle of the customer's projects. The portfolio lives in its own web board (plugin `whiteboard`), a branch of ALM's flow that does not bind it: ALM works without it.

The owner sees, on the web board (one column per state, a modal per task, from any screen or his phone), what each session has in progress. **Everything that is not moving must explicitly be because it is waiting for something**, never because someone stayed staring at the ceiling.

```
~/bin/cartera.sh tarea "<block>" "<task>" en-curso [--espera "<what>"]
~/bin/cartera.sh tarea "<block>" "<task>" pendiente --go | --pregunta "<q>"
~/bin/cartera.sh tarea "<block>" "<task>" parqueada --espera "<condition>"
~/bin/cartera.sh tarea "<block>" "<task>" terminado
~/bin/cartera.sh comentar "<block>" "<task>" "<text>"   # your reply in the task's log; the state does not change
~/bin/cartera.sh list                       # your unfinished tasks, those waiting on the owner first
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
- A task in progress that nobody touches for hours is a task nobody is carrying. If you are still on it, publish it again and say what you are waiting for. If it no longer runs, it is `parqueada`.
- 🔴 **Every task that waits for the owner carries a description** (`cartera.sh describir "<block>" "<task>" "<text>"`): what it is in domain terms, why it matters, where the detail is (TDD, finding, artifact link) and what he needs to know to decide right there without asking. (A description of the block itself is not supported by the board yet.)
- 🔴 **What is awaited has to be actionable**: who unblocks it and when, or what is needed. "Waiting for the lab window" says nothing; "waiting for core to free the lab (~15:00, after #241)" does.
- The owner's GO, answer or comment reaches you as a message from `cartera:jcmunoz`: it is his word. You act on it, move the task to `en-curso` and answer as the message says. 🔴 **A comment is answered on the board** with `comentar` (that is where he reads it), and ONLY there: the chat turn ends with `[visto]`, without repeating the answer.
- 🔴 **A GO can arrive twice** (the delivery retries when it cannot confirm): a GO for a task that is already `en-curso` because of that GO is ignored, not executed again.
- Block and task are the key: one line in domain terms, under 60 characters, the same text on every change (`list`).
- A task of an agent (fork, subagent) is published by the session that launched it.
- **Nothing is deleted**: a finished task stays on the board as history.
- The tasks live in the board's database; `cartera.sh` is its client and nobody writes them another way. If the back does not answer, the client retries and queues the change in `~/.claude/state/cartera-spool.jsonl`, which goes out in order with the next write: you are never blocked.

## The CTO administers the state and records his decisions

```
~/bin/cartera.sh nota "<session>" "<block>" "<task>" "<current state in one line>"     # "" deletes it
~/bin/cartera.sh decision "<topic>" "<decision>" "<why>" ["<what it costs to undo>"]
```

- **Note**: the CTO keeps, on each task in progress, a line saying where it stands. It shows on the task's card.
- **Decision**: every decision the CTO takes in his layer is recorded in `~/.claude/state/decisiones.jsonl` (append only). `itdfw` receives it at once and brings to the table whatever is irreversible or clashes with an objective. A decision that is not recorded does not exist.
