# itdfw-sessions: talk to Claude Code sessions from outside, and between them

Nineteen small scripts, three hooks modules (`vuelta`, `sala-limpia`, `cartera`) and two skills (`/broadcast`, `office`) for people who run several Claude Code sessions at once (some of them background sessions that
nobody watches) and want a cron, a script or another session to talk to them. They have nothing to do with the ITDFW
framework: the plugin lives in this marketplace because we use them to run our own sessions.

> **They depend on Claude Code's internal files and socket protocol**, which are not documented: the session files in
> `<claude-home>/sessions/`, the key files next to them, and the line-JSON protocol on each session's unix socket (read
> from the binary of Claude Code 2.1.283 on 2026-09-26). A Claude Code update can break the ones that deliver messages.
> The test suite runs against fake sessions, so it proves the scripts do what they say, not that the current Claude Code
> still accepts what they send. Last checked by hand against a real Claude Code 2.1.322 on 2026-11-12: a message
> delivered by name, a dead background session woken with `claude --bg --resume`, and six idle sessions compacted
> through `claude attach`. They are in daily use on the machine where they were written.

A *cajarito* (the name in two of the scripts) is one Claude Code session that owns a piece of the work; the word is
Chilean slang for an apprentice. "Wake a cajarito" means bring a dead background session back.

## Install

```sh
claude plugin marketplace add /path/to/this/repository      # or the repository URL
claude plugin install itdfw-sessions@itdfw
```

While the plugin is enabled, Claude Code puts its `bin/` on the `PATH` of the Bash tool, so a session calls the scripts
by name (`claude-session-msg.sh ...`). For a cron or a shell outside Claude Code, put `bin/` on your `PATH` or call the
script by its full path.

**A running session keeps what it loaded until it reloads.** With the marketplace added from a local folder,
`/reload-plugins` re-reads the plugin from that folder (Claude Code answers "`itdfw-sessions@itdfw` re-read from its
folder: …"), so a change committed here reaches a live session with `/reload-plugins` alone. Measured on 2026-11-17 in
two sessions.

Not measured: where a session that starts from zero loads it from. Claude Code also keeps a copy in
`<claude-home>/plugins/cache/<marketplace>/itdfw-sessions/<commit>`; to keep that copy current as well:

```sh
claude plugin marketplace update itdfw
claude plugin update itdfw-sessions@itdfw
```

The `vuelta` off switch lives in the state directory, not in the plugin, and survives a reload or an update.

Requirements: `bash`, `jq`, `socat` (delivery), `tmux` (`cajaritos-compactar.sh`, `session-fg.sh`) and the `claude`
command (`cajarito-despertar.sh`, `cajaritos-compactar.sh`, `claude-usage-watch.sh`).

## Paths and names

Nothing is hard-wired to a machine or a person. Every path comes from the environment, with a generic default:

| Variable | Default | Used by |
|---|---|---|
| `CLAUDE_CONFIG_DIR` | `$HOME/.claude` | all of them (where `sessions/` and `state/` live) |
| `CLAUDE_STATE_DIR` | `<claude-home>/state` | `cajaritos-compactar.sh`, `claude-usage-watch.sh`, `cartera.sh`, the examples |
| `CAJARITO_REPO` | the current directory | `cajarito-despertar.sh`: the directory a session is resumed from (`claude --bg` requires a trusted one) |
| `SESSION_FG_WINDOW` | the current tmux window | `session-fg.sh` |
| `CLAUDE_BROADCAST_FROM` | `user` | `claude-broadcast.sh`: the sender name the sessions see |
| `CARTERA_SESION`, `CARTERA_DIR` | deduced; `<state-dir>/cartera` | `cartera.sh` |

Session names are always arguments. Every script answers `--help` with its header: what it does, what it reads and
writes, its environment and its exit codes.

### A local config file, so you do not repeat them in every crontab

Instead of exporting those variables in each crontab line and shell profile, put them once in a file. Every script of
the plugin (the examples too) loads it first thing, if it exists:

```sh
# ${XDG_CONFIG_HOME:-$HOME/.config}/claude-sessions/env      (another path: CLAUDE_SESSIONS_ENV)
CAJARITO_REPO=/home/me/code/main-repo
SESSION_FG_WINDOW=work:3
CLAUDE_BROADCAST_FROM=me
```

| Rule | |
|---|---|
| Format | `KEY=value`, one per line; only lines that match `^[A-Z_][A-Z0-9_]*=` count. Comments (`#`), blank lines, lowercase keys and `export KEY=...` are ignored |
| Value | everything after the first `=`, literally; one pair of surrounding quotes is stripped |
| Never executed | the file is **read**, not `source`d: `X=$(touch /tmp/x)` sets `X` to that text and runs nothing, so a file that a tool or another user can edit cannot run code through your scripts |
| The environment wins | a variable that is already set (even empty) is not overwritten by the file, so `CAJARITO_REPO=/other cajarito-despertar.sh x` still works |
| Absent | no file, no change: the scripts behave exactly as before |
| Permissions | nothing is checked; `chmod 600` it if it holds anything you would not want read |

The loader is `bin/_env.sh` (a library, not a command). Each script finds it next to its real path (`readlink -f`), so a
script symlinked from `~/bin` loads the file too. A single script copied away without `_env.sh` simply skips the file.

## The scripts

| Script | What it does | Exit codes |
|---|---|---|
| `claude-session-msg.sh "<name>" <from> ["<text>"]` | Delivers a text to ONE live session, found by its exact name, as a cross-session message. Both names are required; without a text it reads stdin, like any filter (the way for texts over ~128 KB, the kernel's limit for one argument; a 200 KB text was delivered intact to a real session on 2026-11-13) | 0 delivered · 1 no live session with that name took it · 2 usage |
| `cajarito-despertar.sh <name>` | Wakes a dead background session with `claude --bg --resume <sessionId>` | 0 alive · 1 did not wake · 2 no such session or ambiguous |
| `claude-broadcast.sh "<text>" [from]` | Sends a text to ALL live sessions except the one that runs it; prints `ok <name>` / `failed <name>` per session | 0 reached all · 1 at least one failed · 2 usage |
| `claude-keepalive.sh` | From a system cron, queues a `ping` in every live session so the prompt cache (1 h TTL) stays warm | always 0 |
| `claude-session-name.sh` | Prints the name of the session this command runs under (walks up the parent processes) | 0 printed · 1 not under a named session |
| `cron-owner-guard.sh <owner> <label>` | Sourced by a cron script: only the owner session may run it; any other gets the order to do nothing and drop its cron | return 0 owner · 1 another session |
| `cajaritos-compactar.sh [--umbral N] [--quieto MIN [--aunque-ocupada]] [--excepto name]... [--solo name]... [--modelo M]` | Compacts the idle background sessions over a context threshold (attach in a tmux window, `/compact`, wait, close the window). `--quieto` leaves alone a session with a turn in the last MIN minutes; `--aunque-ocupada` also takes one the daemon reports busy, for a session whose own harness was seen idle. With `--modelo`, a session whose compaction worked is switched to that model before the window closes; one whose % did not drop keeps its model, because a switch rewrites the whole context at the new price | 0 done · 1 no tmux server · 2 usage |
| `cajaritos-reposo.sh [--umbral N] [--quieto MIN] [--frio MIN] [--listo MIN] [--seco]` | For a 10-minute user timer, on each session's own status (`sessions/*.json`): a session at rest 30-55 min over 50 % is asked for its thread (`hilo-pedir.sh --solo`, once per hour); one that left its mark and has been at rest 2 min is compacted (`cajaritos-compactar.sh --solo … --aunque-ocupada`) and its mark deleted; a mark from an earlier ritual is dropped. A session already cold is not woken | 0 · 2 usage |
| `cajarito-teclear.sh [--espera MIN] <id\|name> <line>...` | The one road for typed keys: types each line into one session's chat (attach in a tmux window, `send-keys -l`, newlines turned into spaces) only while that session is `idle` or `shell`, re-reading the status before each Enter and wiping the line if it changed; logs each typed line in `teclear.log` and closes the window. Used by `cajaritos-recargar.sh` and by the denial popup's "type it in" approval | 0 queued · 1 no tmux, or no such session · 2 usage |
| `cajaritos-recargar.sh [--excepto name]... [--solo name]...` | Types `/reload-plugins` and `/reload-skills` into every live session through `cajarito-teclear.sh` (only while each is at rest, at most 15 min later) | 0 · 1 no tmux server · 2 usage |
| `cajaritos-shell-tope.sh [--tope SEG] [--seco]` | Ends every Claude Code tool shell running longer than the cap (default 660 s): TERM to its process group, KILL ten seconds later, one line in `shell-tope.log`. It acts on the process and never rewrites a command, so the Bash permission rules keep seeing the real one. Meant for a per-minute user timer | 0 · 2 usage |
| `session-fg.sh <name> [window]` | Is the session on screen? `ACTIVE <pane>` / `VISIBLE <pane>` / `BG`, looking for its last text in the panes of a tmux window | 0 / 1 / 3 respectively · 2 not found |
| `claude-usage-watch.sh [--loop s]` | Reads the Claude Code `/usage` without an open session; one line, plus a log | 0 · 1 no answer from `claude -p` |
| `cartera.sh` | A work board: each session publishes its blocks and tasks in a JSON file that a panel can merge. `cartera.sh panel` prints, as JSON, what the `cartera` hooks module needs (folders, the session that draws the board, the person's name) | 0 · 1 unknown session or block · 2 usage |
| `master-cron.sh` | The dispatcher of the service crons: runs every executable `claude-cron-*.sh` of `CLAUDE_CRON_DIR` (default `~/bin`), each with a header. Each cron script decides with `cron-owner-guard.sh` whether the session running it is its owner | 0 |
| `claude-usage-by-session.py [since]` | Splits the usage since an instant by session and model, from the transcripts: share, turns, output, cache reads and writes. It is how a day's quota is explained | 0 |
| `owner-present.sh` | Is the person at the keyboard? Looks for an attached `tmux` client and prints its tty | 0 present · 1 away |
| `ask-owner.sh "<title>" "<option>"…` | Asks the person on their screen: a modal `tmux` popup with `fzf`, the options plus "Say what to do…" for free text. Run in the background: it blocks the person, never the session. Questions from several sessions queue on a `flock` | 0 the answer on stdout · 2 `no está` (away) · 3 `sin respuesta` (closed after the timeout) · 4 `cola llena` · 64 usage |
| `hilo-capturar.sh` | `PreCompact` hook: saves the last 100 messages of the conversation (person, other sessions, assistant text; each cut at 4,000 characters) to `<state>/hilo/<name>.ultimos.md`. Prints nothing | always 0 |
| `hilo-devolver.sh` | `PostCompact` hook: sends the compacted session its own summary (if from the last 24 h) and those messages, as one message from `hook:hilo` | always 0 |
| `hilo-pedir.sh [--umbral N] [--excepto name]... [--solo name]...` | Asks only the sessions over the threshold to write their summary and run `hilo-listo.sh`; the rest are not woken | 0 · 1 a message was not delivered · 2 usage |
| `hilo-listo.sh [--ruta]` | Run by a session with its summary written: leaves the mark `<state>/compactables/<name>` for whoever compacts | 0 · 1 no recent summary or no named session · 2 usage |

`examples/` holds two files that are meant to be copied and changed, not run as they are:

| File | What it shows |
|---|---|
| `examples/daily-close-cron.sh` | A cron that gives a live session a once-a-day job with a day mark (`<day>.running` / `<day>.done`), a 3 h dead-job timeout and a fallback session |
| `examples/statusline-state.sh` | The lines a status line command needs to leave the two state files that `cajaritos-compactar.sh` (`ctx-<sessionId>.json`, field `used`) and `claude-usage-watch.sh` (`usage-week`) read. Claude Code does not write them |

### Things that look odd and are on purpose

- **`cartera.sh` is in Spanish where a program reads it.** Subcommands (`tarea`, `describir`, `archivar`...), states
  (`en-curso`, `pendiente`, `parqueada`, `terminado`), flags (`--espera`, `--go`, `--pregunta`) and the keys of the JSON
  files are the contract a panel and the sessions already depend on. Only the text printed for a human is English.
- **`claude-usage-watch.sh` keeps the labels `semana:` and `fable:`** in its line, because `usage.log` is append-only
  and older lines use them. `fable:` is the per-model line of the `/usage` text; it shows `?` when the account has none.
- **`claude-usage-watch.sh` takes the weekly percent from the `/usage` text, not from `usage-week`.** Every session's
  status line rewrites that file with the last value it received, so an idle session leaves an old number there
  (measured: file 66 %, server 69 %). The file only gives the reset time, which does not go stale, and the percent
  when the text has none.
- `cron-owner-guard.sh` is not run, it is sourced: `. cron-owner-guard.sh <owner> <label> || exit 0`.

## Send a message to a live session from outside

A cron or a script that needs the tools of a session (subagents, artifacts, notifications, its context) sends a message
to the owner session instead of launching a loose `claude -p`.

```sh
claude-session-msg.sh "<session>" <label> "<text>"     # exit 0 delivered · 1 no live session with that name
claude-session-msg.sh "<session>" <label> < file       # the same, with the text from stdin (any size)
```

| Step | What happens |
|---|---|
| deliver | it looks for the session file by exact name in `<claude-home>/sessions/` and delivers over its socket as `from="<label>"`, the name exactly as given |
| exit 1 | the message is lost, not queued: run `cajarito-despertar.sh "<session>"`, wait a few seconds and retry ONCE; if it fails again, an error on stderr and nothing else |
| knowing it finished | there is no acknowledgement: the cron is not a session and receives no replies. The session creates `<dir>/<date>.running` when it starts and renames it to `.done` when it ends (a `.running` older than 3 h is taken as dead). The text of the message asks for it explicitly |
| telling the person | the session does it when it finishes (a push or a board entry), not the cron |

- The model to copy is `examples/daily-close-cron.sh`: a day mark, and a fallback session if the owner is not alive.
- The sender names itself: a session with its own name; anything else says what it is, `cron:<name>`, `hook:<name>`
  or `script:<name>`. When that name is a live session, the
  receiver can answer it with `SendMessage`; when it is not (a cron), there is nobody to answer. Do not send under the
  receiver's own name: a session that received a ping from itself once tried to answer itself.
- The subagents the session starts run with that session's account.
- Related: waking a dead session (next section) and `claude-keepalive.sh` (the same protocol, to every session).

### A dead session is woken with one command

If you need something from another session and it is dead (`SendMessage` answers "No agent named '<x>' is reachable",
or it is not in `ListAgents`), wake it yourself, then send the message:

```sh
cajarito-despertar.sh "<name>"; echo "exit=$?"     # 0 alive · 1 did not wake · 2 no such session or ambiguous
```

- Inside, it is `claude --bg --resume <sessionId>`: it brings the session back in the daemon with the same id, name,
  agent and model, idle, with no interface and no process to close.
- **A bare `claude --resume` does not work**: it opens the interface in the foreground and dies with its terminal.
- Waking is not assigning work: the session wakes up with nothing to do. Send it the message separately, with what you
  need.
- On exit 1 or 2, tell the person in one line, with the name and the output of the script.
- Putting a session to sleep is a different thing; this does not do it.

In `claude agents`, `✻`/`✽` means alive and `∙` finished; "Pinned" is a mark of the conversation, not of the state.

## An answer goes back to the session that asked (`vuelta`)

When one session asks another for something, the receiver tends to report the result to the person in its own chat and
never tell the session that asked. If the person is away, the asker waits forever. `vuelta` is a hooks module
(`hooks/vuelta.ts`, loaded by `hooks/hooks.json`) with a small ledger (`bin/vuelta.sh`) that keeps that loop closed:

| Moment | What happens |
|---|---|
| a message from a session arrives | a debt opens (the receiver owes the sender) and one line is added to the message: who opened it and that the result goes back to them |
| the receiver sends that session a message | the debt closes, and the message carries a short-lived mark so that, on arrival, it reads as a reply and opens no opposite debt |
| a turn ends with a debt still open | one reminder is submitted as a new prompt; after `VUELTA_MAX` reminders (default 1) the debt is closed as failed and logged |

- A sender written `<kind>:<name>` (`cron:briefing`, `hook:hilo`, `broadcast:<user>`) is not a session: it opens no debt.
- `vuelta.sh list` shows every open debt; `<state-dir>/vuelta/log.jsonl` keeps what was opened, answered and failed.
- To turn it off in every session at once, without reloading anything, create the file `<state-dir>/vuelta/off`: while
  it exists the ledger opens, closes and reminds nothing. Remove the file to turn it back on.
- **Install it in every session or in none.** A session without the module leaves no mark on its answers, so each of
  its messages opens a new debt on a session that has it. Measured on 2026-11-16 with the module in some sessions only:
  23 debts in eight minutes, pairs reopening every 20 to 40 seconds.

Known edges, kept on purpose (the worst case is what happened before the module existed: a message that nobody answers):

- **Every message from a session asks for an answer**, also a plain report. There is no "no answer needed".
- **A first answer closes the debt.** "I will look at it" counts as the answer; if the result never follows, nothing
  reminds the receiver. And a result sent after the mark expired (`VUELTA_TOKEN_TTL`, 120 s) opens a debt on the
  session that had asked.
- **Each reminder is a whole turn** of the reminded session, at the size of its context. That is why the default is one.
- An answer given in a room (`room say`) is not seen as an answer.

## A clean chat while a session sits in a room (`sala-limpia`)

A session invited to a room (`agent-tools/room`) gets every line said there as a message, and most need nothing from
it. Its chat fills with lines the person already read in the room and with short "nothing to add" answers.
`sala-limpia` (`hooks/sala-limpia.tsx`) only changes what is drawn:

| Row | Drawn? |
|---|---|
| a message from another session whose text starts with `[room <name>]` | no |
| an answer of the session that is exactly `[sala]` | no |
| anything else, and everything once expanded (ctrl+o) | yes |

- **Nothing else changes**: the stored messages, what the model reads and the turn each room line costs stay as they
  were. It saves reading for the person, not quota.
- **`[sala]` is a contract with `room`**: every line the room delivers ends with "If you have nothing to add, your
  whole answer is exactly: [sala]" (`SILENT_REPLY` in `agent-tools/room/room.mjs`, `SILENT` here). Change both together.
- A plugin loads one hooks module, so `hooks/index.tsx` hands the same `on` to `vuelta` and to `sala-limpia`; each mod
  stays in its own file. `vuelta` still obeys its off switch.
- Not covered by the suite: it runs only inside Claude Code. Checked by hand on 2026-11-17 in one session: a room line
  and the `[sala]` answer left no row in the chat. Sessions take it with `/reload-plugins`.

## The work board on screen (`cartera`)

`hooks/cartera.tsx` draws the board that `cartera.sh` keeps: one band with what every session has in motion, what
waits for the person, and a GO button on the tasks that wait for their approval. Pressing GO sends the owner session a
message in the person's name.

- **Off by default, in every session.** `/cartera` (or `/cartera on|off`) turns it on or off in the session where it is
  typed, and the choice stays in that session's state. Off, it cancels its timer and reads or runs nothing.
- Folders and the person's name come from `cartera.sh panel`, so the module carries no paths or names.
- `claude plugin test .` in this folder runs `tests/cartera.test.tsx` (4 cases), among them that turning it off really
  stops it and that GO reaches the owner in the person's name.

## `/broadcast`

`skills/broadcast/SKILL.md` lets the person say `/broadcast <text>` in any session to send it to all the others through
`claude-broadcast.sh`, as `broadcast:<name>` (an external sender: nobody answers it).

## How to verify

```sh
cd plugins/itdfw-sessions && node --test "test/*.test.mjs"   # 255 cases
claude plugin test .                                          # the cartera hooks module, 4 cases
```

The suite needs no real session and touches no real `~/.claude`: each test makes a throwaway `HOME` with fake session
files, a fake unix socket (`node:net`) that records what a session would receive, and stubs in the `PATH` for `claude`,
`tmux` and `sleep`.

| File | What it proves |
|---|---|
| `test/messaging.test.mjs` | `claude-session-msg.sh`, `claude-broadcast.sh`, `claude-keepalive.sh`, `claude-session-name.sh`, `cron-owner-guard.sh` and `examples/daily-close-cron.sh`: who receives what, the auth and message lines, the skips (spare, dead, no socket, no key), the ancestor skip in the broadcast, the exit codes |
| `test/wake-compact.test.mjs` | `cajarito-despertar.sh` and `cajaritos-compactar.sh` against a stub `claude` and a stub `tmux`: the decisions (already alive, ambiguous names, which session is compacted and which is skipped and why, `--solo`, `--excepto`, `--umbral`, `--modelo` only after a compaction that worked) |
| `test/screen-usage.test.mjs` | `session-fg.sh` (ACTIVE / VISIBLE / BG from a fake transcript and fake panes), `claude-usage-watch.sh` (against a stub `claude -p`: the `/usage` percent beats a stale `usage-week`, which is only the fallback) and `examples/statusline-state.sh` |
| `test/cartera.test.mjs` | `cartera.sh`: every subcommand, the state files, the old-format migration |
| `test/hilo.test.mjs` | the four `hilo-*` scripts: what the capture keeps and drops, the last-N and per-message cut, the hand-back message and its 24 h summary rule, the ready mark, who is asked and who is not woken |
| `test/vuelta.test.mjs` | the ledger (`vuelta.sh`): a request opens a debt, the answer closes it and arrives as a reply, no endless ping-pong between two sessions, two askers tracked apart, a recipient given by name, by `[ref]` or by socket address, the reminder count and the give-up, `list`, bad usage. The hooks module itself (the added line, the external senders, the reminder prompt) runs only inside Claude Code and is not exercised here |
| `test/owner.test.mjs` | `owner-present.sh` (one client, several, none, `tmux` failing) and `ask-owner.sh` against fake `tmux`, `fzf` and a real `flock`: the chosen option, free text, an empty Enter back to the menu, away before and while queued, the popup closed and closed by the timeout, the full queue, the lock path and the usage error |
| `test/cron-usage.test.mjs` | `master-cron.sh` (runs each cron in order, skips what is not executable, together with `cron-owner-guard.sh`) and `claude-usage-by-session.py` (shares and columns from fake transcripts, the instant, an empty home, records with no tokens) |
| `test/help.test.mjs` | every script answers `--help` with its header, exit 0 |
| `test/env-file.test.mjs` | the local config file: absent, present, `XDG_CONFIG_HOME` / `CLAUDE_SESSIONS_ENV`, the environment wins, a line that tries to run something is not executed, only `KEY=value` lines count, through a symlink, and that every script loads it on start |

**Not covered**, because it needs the real harness: that a real Claude Code still accepts the messages; what a real
`claude --bg --resume` and `claude attach` do; the real `/compact` and how long it takes; the real tmux rendering for
`session-fg.sh`; `claude-usage-watch.sh --loop` (it never returns); and the real text of `/usage`, which the script
parses with regular expressions on English wording.

## Limits

- Claude Code internals, as said at the top.
- `cajaritos-compactar.sh` waits up to 5 minutes per session for the percentage to drop below 20 % and then closes the
  window anyway; it reports the real before and after, so a compaction that did nothing shows as `70% -> 70%`.
- `cajarito-despertar.sh` with no argument exits 1 (the shell's `${1:?}`), not 2.
