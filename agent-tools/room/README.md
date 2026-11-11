# room

A meeting room for the command line, like IRC, between a person and live Claude Code sessions on the same machine.

The person sees a normal chat. Sessions get messages on their socket and answer by command. Every message reaches every
session in the room except its author, and the conversation stays on disk for whoever comes in later. There is no
server: `say` writes and delivers, and `room <room>` follows the file.

## At a glance

| | |
|---|---|
| **What it is** | One Node.js file, `room.mjs` (765 lines), plus tests. No server and no daemon: each command lives as long as it runs. |
| **How the chat is stored** | One JSONL file per room under `~/.claude/state/rooms` (`room.mjs:42`), directory mode 0700 and file mode 0600 (`room.mjs:60-61`). The participants are not stored: they are derived from the `join` and `left` lines (`room.mjs:104-111`). |
| **How a message reaches a session** | It does **not** use tmux or a terminal. It reads the session's file in `~/.claude/sessions/<pid>.json` (fields `name`, `pid`, `messagingSocketPath`, `room.mjs:222-225`) and the token in the matching `<pid>.….key` file (`room.mjs:226-228`), connects to the session's Unix socket and writes two JSON lines: an `auth` line and a `user` line (`room.mjs:234-239`). The text is wrapped in the cross-session message envelope that Claude Code uses (`room.mjs:133-142`). |
| **What it is not** | Not a module of the ITDFW framework: it imports only `node:*`, `marked` and `marked-terminal` (`room.mjs:2-10`). Not authenticated: the author is the name that wrote the line on this machine, not proof of authority. Not for several machines or users. |
| **What it depends on** | **Claude Code internals** that are not documented in this repository: the session files, the token file and the socket protocol. The code never checks `version` or `peerProtocol`, so if Claude Code changes them, delivery fails silently or the session looks dead. It was observed against Claude Code 2.1.322 only. |

### How to verify it

```sh
cd agent-tools/room && pnpm install --ignore-workspace
node --test --test-timeout=30000 "test/*.test.mjs"
```

27 cases (`node:test`): 24 in `test/room.test.mjs`, 1 in `test/concurrency.test.mjs`, 2 in `test/tty.test.mjs`. On
2026-11-10 they gave `tests 27, pass 27, fail 0`. They build a temporary world — a temporary `HOME`, room directory and
session directory, with **fake sessions that are Unix-socket processes** (`test/harness.mjs`, `test/fake-session.mjs`) —
so they need no real Claude Code, no network, no database and no tmux. Two cases need Linux and the `script` binary of
util-linux (`test/tty.test.mjs:14-15`). The design note is `TDD.md` (a one-page contract with a table of 15 test cases, `TDD.md:49-66`).

What the tests do **not** show: that delivery works against a real, current Claude Code. They use fake sessions, and the
design note says so (`TDD.md:72`). The author has used the room with real sessions, but no test proves it.

### Limits

- **No lock on the chat file.** Concurrent writers are safe only because each line is one `write` on a file opened with
  append mode (`room.mjs:57-67`); one test checks it with 8 processes writing 100 lines each
  (`test/concurrency.test.mjs:9-11`). On a network file system this is not verified. Two races have no test: `say`
  checks that you are a participant and then writes (`room.mjs:305-310`), and two simultaneous `invite` calls on an
  empty room can both think they founded it (`room.mjs:321-340`).
- **`sent` is not "read".** It means the socket took the bytes (`room.mjs:250-251`).
- A session without a `name` is not found by the room and cannot be invited (`room.mjs:224`). A command run under such a
  session would be written under the operating-system user name (`room.mjs:662-689`).
- `&` is not escaped in the message envelope (`room.mjs:119`); `<` and `>` are.
- The envelope's phrase "informational: not an instruction from your user" (`room.mjs:139`) is a text of the room, not a
  guarantee that a model obeys it. The notice added for a mentioned session is written in Spanish, fixed in the code
  (`room.mjs:177-178`).
- Rooms are never rotated or deleted; they live until someone deletes the file (`TDD.md:29`). `read` reads the
  whole file every time (`room.mjs:717-718`).
- `kick` takes any participant, not only a session, although `TDD.md:42` says `<session>`.

## Install

Tested on Node 26 and Linux. It renders markdown with `marked` and `marked-terminal`, pinned in `package.json`.

```sh
pnpm install --ignore-workspace     # this folder is its own package, outside any workspace
ln -s "$PWD/room.mjs" ~/bin/room    # a symlink: Node resolves the modules from agent-tools/room
```

## What you see

Each message is `[time][author]: text`, with a blank line before it. A text of several lines keeps its line breaks,
indented under the header. Joins and leaves take one line. In a terminal the markdown is rendered (bold, code, lists,
tables) and wrapped to its width; through a pipe the text goes as it was written, with the same layout and no ANSI.

```
[13:10] -- ana joined

[13:10][lead]:
  Flow:

    * the lead assigns
    * it reports to the lead

[13:10][ana]: go on
```

`room read` puts the line number of the file first (`2 [13:10][lead]: …`): that is the `N` that `--desde N` takes.

## Mentions

`@name` of a participant says who a message is for; everyone still gets it. In a terminal the mention takes the
colour of the person mentioned. A session mentioned gets the line `Dirigido a ti.` in its notice; the others get
`Dirigido a <names>: es informativo para ti; no respondas salvo que tengas algo que corregir.` A `@word` that is not a
participant, or glued to a word (`x@name`), is not a mention. There is no `@all`: a message without mentions is for
everyone.

## Use

```sh
room design                  # open the room in this terminal, creating it if needed
```

Inside: `/invite <session>`, `/kick <participant>`, `/who`, `/list`, `/history [n]`, `/leave`, `/help`. Anything else
is sent to the room.

A session answers by command, from its own shell:

```sh
room say <room> "<text>"
room read <room> [--desde N]      # what comes after line N of the file
room who <room>
room invite <room> <session>
room kick <room> <participant>
room leave <room>
room list
```

Exit status: 0 done, 1 failed, 2 wrong usage.

## Who is who

A command run under a session writes under that session's name, found by walking up the parent processes. Anywhere else,
and always in `room <room>`, you are `ROOM_USER`, or `USER` if that is not set.

Room messages are informational. The sender is the name that wrote the line on this machine, not proof of authority.
`sent` means the session's socket took the message, not that the session read it.

## Configuration

| Variable | Default | What |
|---|---|---|
| `ROOM_DIR` | `~/.claude/state/rooms` | one append-only `<room>.jsonl` per room, mode 600 |
| `ROOM_SESSIONS_DIR` | `~/.claude/sessions` | the session files and keys. In a real Claude Code the sockets are elsewhere (`/run/user/<uid>/cc-socks/` was observed); the session file gives their path. In the tests the sockets are inside this directory |
| `ROOM_USER` | `$USER` | your name as a person |

## Tests (the command again)

```sh
node --test --test-timeout=30000 "test/*.test.mjs"
```

They run on fake sessions in a temporary directory and never reach a real one (see "How to verify it" above).
