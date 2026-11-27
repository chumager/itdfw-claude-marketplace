# Each PMO's heavy, mechanical work goes to its "medio pollo": a foreground session in Code Mode, one per PMO

A PMO stays as it is (background, Remote Control, Claude in Chrome). Its worker, `medio pollo de <PMO>`, is a separate
session in Code Mode, Sonnet high, where tools are chained in code and only the result comes back to the context. Code
Mode turns off Remote Control and Chrome and only runs in the foreground, which is why it never goes on the PMO itself.

```
~/bin/medio-pollo.sh up <PMO>      # ensures it is running; idempotent, never two
~/bin/medio-pollo.sh clear <PMO>   # /clear when it is at rest, after each closed task
~/bin/medio-pollo.sh down <PMO>    # closes it
~/bin/medio-pollo.sh list
```

| Who | What they do |
|---|---|
| the PMO | runs `up` before handing work over; sends it the work by `SendMessage` and learns it finished with `notify_when_idle`. The first message after `up` or `clear` gives its role: "you are the worker of <PMO>; you do what it sends, you do not commit, you report to it". It reviews and commits the result, and runs `clear` when the task closes |
| the medio pollo | does the task, may launch subagents or workflows of its own, commits nothing and answers its PMO |

- It lives in its own window, named after its PMO, of the tmux session `½ pollo`. Only the script touches tmux for this.
- One thing at a time. Work in parallel is still subagents or a workflow from the PMO.
- Never `/model` or `/effort` inside it: they also save the default for every new session. The script launches it with
  flags.
