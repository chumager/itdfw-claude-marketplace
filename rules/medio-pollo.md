# Each PMO's heavy, mechanical work goes to its "medio pollo": a foreground session in Code Mode that the CTO manages

A PMO stays as it is (background, Remote Control, Claude in Chrome). Its worker, `medio pollo de <PMO>`, is a separate
session in Code Mode (`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1`), where tools are chained in code and only the result comes
back to the context. Code Mode turns off Remote Control and Chrome and only runs in the foreground, which is why it never
goes on the PMO itself.

| Who | What they do |
|---|---|
| a PMO without its medio pollo | asks the `CTO` for one by `SendMessage`. It never opens tmux panes or windows itself |
| the `CTO` | the only one who creates, renames, clears and closes them: one window per medio pollo in the tmux session `½ pollo`, named after its PMO. Launches it with `env CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1 claude -n "medio pollo de <PMO>" --model sonnet --effort high` (flags, never `/model` or `/effort`: those also save the default for every new session), answers the "turn on Code Mode" question with `send-keys` (Down, Enter), and hands it over |
| the PMO | sends it the work by `SendMessage` and learns it finished with `notify_when_idle`. The first message gives its role: "you are the worker of <PMO>; you do what it sends, you do not commit, you report to it". It reviews and commits the result |
| the medio pollo | does the task, may launch subagents or workflows of its own, commits nothing and answers its PMO |
| when a task closes | its PMO asks the `CTO` for a `/clear`, typed into its pane with `send-keys` while it is at rest |

- A medio pollo does one thing at a time. Work in parallel is still subagents or a workflow from the PMO.
- It can only be resumed with the variable on: whoever wakes it uses the same command it was launched with.
- No session other than the `CTO` touches tmux (panes, windows or sessions) for this.
