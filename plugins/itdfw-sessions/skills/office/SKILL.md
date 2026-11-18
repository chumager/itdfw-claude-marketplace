---
name: office
description: Use when setting up or running an office of long-lived Claude Code sessions that build one product together - deciding which sessions exist and what each owns, who approves a TDD, which model and effort each runs on, how a request travels and comes back, where pending decisions for the person live, how the day closes and the sessions are compacted. Also when a session asks what its role is, whom to ask for something, or whether something needs the person.
---

# Running an office of sessions

One person (the **architect**) and a set of named, long-lived Claude Code sessions. The architect defines contracts and
decides what is irreversible; the sessions do the rest and filter what reaches the architect. The full reasoning is in
`docs/operating-model.md`; the rules every session loads are in `rules/` (the office) and `rules/preferences/` (the
architect's taste). This skill is the contract to set one up and keep it running.

## 1. The roles

| Session | Owns | Filters for the architect |
|---|---|---|
| technical lead (`CTO`) | contracts (TDD, slice 1), review of every finished development, conceptual separation between plugins, stack security, releases with the architect's GO | **everything technical** |
| commercial (`Comercial`) | what ships first and by when, commercial analysis, tenders | **everything business** |
| advisor (`itdfw`) | flows, new ideas, the day's topics, briefing | the rest |
| core owner (`core`) | the shared base: back-end framework and libraries | — |
| UI owner (`designer`) | the painting component library; the UI/UX section of each TDD | — |
| QA | every screen test; reads only the TDD, never the code | — |
| documenter (`documentador`) | skills and TDDs agree with the code | — |
| PMO (one per plugin or project) | its module, its TDD, its headless tests | — |

- Always alive: technical lead, core, UI owner, QA, documenter, advisor. PMOs are started and stopped by priority.
- One owner per piece. A session that needs a change in someone else's piece asks for it in domain terms; it does not
  make it. Rules: `organigrama`, `core-por-mensaje-a-core`, `promocion-al-core`.
- Personal topics of the architect (health, career) go straight to the architect, never through the chain.

## 2. Models

| Who | Model · effort |
|---|---|
| technical lead, commercial, advisor, QA | Opus · high |
| core, UI owner, documenter, PMOs | Opus · medium |
| subagents that implement, search, synthesise | Sonnet · high (`base`, `implementer`) |
| trivial lookups | Haiku |

Every subagent call names its type and model, because an agent without its own definition would inherit the session's
model and effort. `agent-type-gate.sh` (itdfw-hooks) **refuses** a call with no type, a generic type or Fable. Rule: `model-assignment-agents`.

## 3. A TDD until it is built

PMO writes → technical lead (contract, slice 1, architecture) → UI owner (UI/UX, if there is a front) → documenter
(correctness) → QA (approves the test set) → approval → implemented.

| The TDD | Approves |
|---|---|
| a concept with no known pattern, invented by the architect | the architect, who takes part in its design |
| a new site, or what a client sees first | the architect |
| a public core contract, or anything irreversible | the architect |
| the rest (known concepts, already talked through, findable) | the technical lead, presenting a short summary to the architect |

Without QA there is no approval. A new client-facing site starts before the TDD, with the commercial analysis and the
competition study (skill `producto-antes-del-tdd`). Rules: `rebanada-1-stopper`, `listo-se-lee-del-tdd`,
`ambiguedad-se-deja-configurable`.

## 4. How things travel

| Need | Channel |
|---|---|
| ask another session | `SendMessage` (or `claude-session-msg.sh` from a script); it answers the session that asked |
| a session is dead | `cajarito-despertar.sh <name>`, then the message |
| a decision of the architect | the work board as `pendiente --go` / `--pregunta`, plus `ask-owner.sh` (popup) and a push when they are away |
| finished development | to the technical lead to be reviewed, with the TDD rows, the commit, the class of change and the N/N |
| an assignment closes | it goes back up the same chain it came down (`el-cierre-vuelve-por-la-cadena`) |
| several sessions and the architect at once | a room (`agent-tools/room`); whoever has nothing to add answers exactly `[sala]` |
| everyone | `/broadcast <text>` |

Messages from a process (`cron:`, `hook:`, `room:`) are not answered. Rules: `sesiones-se-responden-directo`,
`mensaje-a-sesion-desde-fuera`, `sala-se-escucha`, `mensajes-entre-sesiones-no-se-reenvian`.

## 5. The work board

Each session publishes its blocks and tasks with `cartera.sh`; `/cartera` turns on the band with GO buttons in the
session where it is typed. The state says who has the ball: what needs the architect is `pendiente`, never "waiting for the GO". The
technical lead keeps a one-line note on each task in progress and records its decisions. Rule: `cartera`.

## 6. The day and the week

| When | What |
|---|---|
| 21:00 | the daily close (an `examples/daily-close-cron.sh`-style cron): state of every session, graph update, skills review, then "close done, compact" to the technical lead |
| after the close | `hilo-pedir.sh` asks the sessions over 50 % for their thread; each writes it and runs `hilo-listo.sh`; the technical lead compacts them with `cajaritos-compactar.sh --solo <name> --umbral 0` and asks the advisor to compact it |
| any compaction | the thread comes back by itself (`hilo-capturar.sh` / `hilo-devolver.sh`) |
| the weekly quota | at 95 % everyone stops and documents; before that nobody brakes alone. Measure with `claude-usage-watch.sh` and the per-session breakdown |
| every day | the technical lead's pass for the same concept born in two plugins (`separacion-conceptual`) |

Rules: `compactar-al-cierre`, `cuota-embudo`, `graphify-update-on-close`.

## 7. Setting one up

1. Install `itdfw-sessions` and `itdfw-hooks`; link `user-agents/*.md` into `~/.claude/agents/` and `rules/**/*.md`
   into `~/.claude/rules/` (a symlinked rule loads; checked with a fresh `claude -p`).
2. Write the config file of `itdfw-sessions` (`CLAUDE_BROADCAST_FROM` is the person's name).
3. Start the always-alive sessions with their names and models (section 2), in the background.
4. Install the daily close cron, pointing at a live session with a fallback.
5. Start PMOs only for what has priority this week.

## Red flags

- A session answering the architect about a technical decision the technical lead has not seen → it goes through the
  technical lead.
- A TDD sent to implementation without QA's approval, or approved by the technical lead when it is an invented concept.
- Four sessions answering the same question in a room.
- A task waiting for the architect that is not `pendiente` on the board.
