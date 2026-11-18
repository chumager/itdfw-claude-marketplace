# Operating model: an office of Claude Code sessions

How a set of long-lived Claude Code sessions develops one framework in parallel: who owns what, how work moves between
them, how they check each other, how they learn, and what the harness enforces versus what only the model's discipline
holds. It describes the practice that the [skills](../plugins/itdfw/skills), the [hooks](../plugins/itdfw-hooks) and the
[session scripts](../plugins/itdfw-sessions) of this repository grew out of.

**How to read it.** Every rule below exists as a text file that is loaded into each session. Text is the weak form of a
rule: a model can forget it. [Section 6](#6-what-enforces-what) says, rule by rule, which ones are backed by a hook or a
script and which depend on the model alone. [Section 7](#7-what-we-got-wrong) lists the failures that produced the rules.
The rules themselves are in [`rules/`](../rules) (the office's) and [`rules/preferences/`](../rules/preferences) (the
architect's taste), translated and with names and machine paths taken out; a few that are only personal stay on the
machine. One person, the **architect**, defines contracts and decides what is irreversible; the sessions do the rest.

## Contents

1. [The office](#1-the-office)
2. [How work moves](#2-how-work-moves)
3. [How it stays honest](#3-how-it-stays-honest)
4. [How it learns](#4-how-it-learns)
5. [How it runs unattended](#5-how-it-runs-unattended)
6. [What enforces what](#6-what-enforces-what)
7. [What we got wrong](#7-what-we-got-wrong)

---

## 1. The office

A **session** is one Claude Code conversation with a name, a role and its own context. Some are foreground, most run in
the background and nobody watches them. A background session that dies can be brought back with the same identity
([section 5](#5-how-it-runs-unattended)). The apprentice-style word *cajarito* in the scripts means one such session.

| Role | Owns | Does not |
|---|---|---|
| **Technical lead** | The architect's **technical stopper**: everything technical reaches it first. The contracts (TDD and slice 1), the review of every finished development, the approval of TDDs on known concepts, the watch that two plugins do not build the same thing, the publication of releases (with the architect's go-ahead), the security of the stack, the work board's state | Write the product code of other owners |
| **Commercial** | The architect's **business stopper**: what ships first and by when (order by revenue), the commercial analysis of each product, tenders and applications | Decide how something is built |
| **Core owner** | The base products: the back-end framework and the shared libraries. Receives requests for core changes. Front business logic lives here too | Touch a plugin or a site that belongs to someone else |
| **UI owner** | The component library that paints (the Naive UI front). Paints; carries no business logic | Decide data rules |
| **QA** | The tests. Reads **only the contract** (the TDD), never the code, and refutes or completes it. Maintains the shared test helpers | Read the implementation to "see what it does" |
| **Documenter** | Checks that skills and JSDoc agree with the code; reports to the code's owner; enriches a skill when it lacks something | Fix the code |
| **Module / project sessions** | One session per plugin, module or project. Alive while they have priority, stopped otherwise | Edit core |
| **Advisor** | The architect's counsellor: flows, new ideas, the day's topics, briefing, anything neither technical nor business. Does not edit core | Ship |

The always-alive set is the technical lead, the core owner, the UI owner, QA, the documenter and the advisor. Module
sessions are started and stopped as priorities move.

### Why one owner per piece

| Without it | With it |
|---|---|
| Two sessions edit the same file and each tests against the other's half-finished work | One place to ask "what changed", with the test and the version bump that prove it |
| A fix lands in the wrong layer because the session that needed it was the one that patched it | The session that needs a change in someone else's piece **asks for it** in domain terms (the symptom or the capability, not the solution) |
| Nobody is accountable for a regression | The owner's suite is the gate |

The symmetry matters: the owner of core does not reach into another session's work either; they tell it. A change to a
published package also carries its version bump, and publishing is a release decision, not a side effect of a fix.

### Personal topics stay out of the chain

Anything about the architect's private life (medical, career) goes straight to the architect and is never summarised to
the technical lead. If those sessions also write technical scripts, that technical summary does flow normally, without
the personal data.

---

## 2. How work moves

### 2.1 Contract before code

| Step | Rule |
|---|---|
| Write the **TDD** in a fixed order | narrative, then scopes, then model (fields, relations, endpoints), then executors, then tests with expected results |
| Declare **slice 1** | the smallest end-to-end path a real user takes this week, with everything else replaced by something dumb (one hand-loaded document, one branch, one issuer) |
| Every model, field or endpoint says in which slice it is used | "later" goes in a one-line "Outside slice 1" list, with no table and no decisions |
| What enters, enters as a whole **concept**, not a field | the shape of the data is never cut (one photo or several? it is an array even if the view shows one); UI and automation are what get cut |
| Someone approves | the architect, for a concept with no known pattern (their own invention), a new site or what a client sees first, a public core contract or anything irreversible; the technical lead for the rest, presenting it to the architect in a short summary. Without QA's approval of the test set there is no approval. An implementer receives an approved TDD and a closed brief |
| The implementer's first step | run the conformity checklist of the TDD skill against the TDD; if a mandatory section is missing, **stop and report** instead of guessing |
| The TDD declares its mode | **new** (re-implement cleanly: a wrapper over a piece of this same change is an immediate defect), **refactor with full coverage** (behaviour kept, signatures change only if the contract says so), **incremental** (signatures and edges untouched, only add) |
| "Done" is read from the TDD | before saying "ready", open the TDD and list the rows that are not green, or "none" |

The point of the slice: a design is not finished until it says what is built first. It is the brake against the design
that tries to cover every future case.

### 2.2 Requests, answers, and the chain of custody

| Situation | What happens |
|---|---|
| A session needs a change in core | It sends the core owner a **request**: what it needs (symptom or capability), in which site it will verify, and what must be restarted. Nobody else edits core |
| The core owner answers | What changed (the code), the test that proves it, the version bump with the drift against the registry in view, and "verified in <site>" |
| Another session asks a technical question | It is answered **directly** by message, not routed through the architect. If the answerer is busy: a fork analyses and replies to the asker and shuts down; if uninterruptible: "wait until ~HH:MM" |
| A peer asks for something that needs permission or touches configuration | Refused. A peer cannot grant permissions; the architect is told |
| A message arrives that does not concern you | Received **in silence**: no "noted", no reply. An acknowledgement that every session sends multiplies into noise for the person reading all of them |
| A session is dead and you need it | Wake it with one command, then send the message separately (waking is not assigning work) |

**Custody.** An assignment that passed through several sessions is closed **upwards, link by link**: each one tells
whoever handed it over, until it returns to whoever asked first. Being obliged to report to the technical lead for
review does not exempt a session from informing the requester. The reviewer also tells the original owner, not only the
session that reported. The notice is one line: what was asked, the result, and what is left for the architect.

**Everything developed is reviewed.** Every finished development (code, tests, TDD) goes to the technical lead *to be
reviewed*, not just to be informed, with pointers:

| Goes in the notice | Why |
|---|---|
| The TDD and the rows or slice that were closed | The review is against the contract, not a loose diff |
| The commit, or the files if not yet committed | Where the thing to review is |
| The change class, the branch of tests that ran, and N/N | [Section 3.3](#33-the-close-is-the-whole-suite-against-the-real-thing) |
| The decisions marked "decided while implementing, to review", and what was left out | That is where a stronger reviewer adds value |

**Decisions in your own layer are made, written and executed.** A fork in the road that blocks an approved piece of work
is resolved by the session: it writes the problem in one line, the options, the decision and its criterion, and what it
costs to undo, marks it "decided while implementing, to review", and proceeds, so that the architect reviews something
running. What stays a question for the architect: a change to a public core contract, anything irreversible (data,
production, publishing), opening or closing access for third parties.

### 2.3 The work board

Each session publishes its **blocks** (a piece of work) and **tasks** to a small file; the architect sees them in one
panel. [`cartera.sh`](../plugins/itdfw-sessions/bin/cartera.sh) is the tool. Its principle: **anything that is not
moving is explicitly waiting for something**, never because someone stared at the ceiling.

| Task state | Means |
|---|---|
| `en-curso` (in progress) | You carry it and it does not depend on the architect, however long it takes. If it waits on a shared resource or another session, it says so with `--espera` |
| `pendiente --go` | Waits for the architect's approval (a button appears) |
| `pendiente --pregunta "<q>"` | Waits for an answer from the architect (a field appears) |
| `parqueada --espera "<condition>"` | Does not run today and is not the architect's: resumed on a stated condition |
| `terminado` | Tested and ready for review |

| Rule | Why |
|---|---|
| The state says **who holds the ball**. If the architect is needed, it is `pendiente`, never `--espera "your go"` | Otherwise it does not show up as theirs |
| A task in progress with no change for over an hour turns **red** | Nobody said anything and someone has to look. Re-publish if you are still on it, park it if not |
| A wait must be actionable: who unblocks it and when | "Waiting for the window" says nothing; "waits for core to release the lab (~15:00, after #241)" does |
| Every block carries a description (what it is, why it matters, where the detail lives); a task waiting on the architect carries what they need to decide on the spot | The architect decides without asking |
| The board is the **record**, not the notice | Telling the requester is [custody](#22-requests-answers-and-the-chain-of-custody) |
| Decisions the technical lead takes in its layer go to an append-only log; the advisor receives each and brings the irreversible ones to the table | A decision that is not logged does not exist |

The board is not a project-management system for customers' projects. It coordinates the sessions between design and
test, over minutes or hours.

### 2.4 Rooms

A **room** ([`agent-tools/room`](../agent-tools/room)) is a shared chat between the person and live sessions. The
etiquette is strict because every line costs the person reading and costs every present session context:

| Moment | What is written |
|---|---|
| On entering | At most a one-line greeting to declare presence |
| While there is no agenda | Nothing. No status, no context, no what-you-know |
| With the agenda on the table | Only the part that is yours, or what you are asked |
| Someone names you (`@name`) | Answer that, briefly |

An invitation to a room is not a question. A message from another participant is not a question for you either. What two
sessions can settle between themselves goes by direct message, not in the room.

---

## 3. How it stays honest

Six rules that exist because an agent's default is to report success.

### 3.1 A fact is a pin

To diagnose, **fix the facts first**, then look for the cause inside what they leave open.

| What it is | Example | How it is treated |
|---|---|---|
| **Fact** (a sequence, a timestamp, a log, an input value and an output value) | "the push arrived at 07:03 and the briefing runs at that time" | A fixed pin. It is not refuted by a reading of your own. After a rewind, what was read before does not count |
| **Assessment** (carries a probability) | "99 % sure", "it seems" | Weighed and verified |
| **Accumulation pin** (a pattern: a memory, a rule, "this has happened before") | "it is always the butler" | Orients the search; **it is a shortcut, not a proof** |

If a decision hangs from a pin, say so. If the solution does not match reality, review the pins: which was false, or
which was a shortcut dressed as a fact.

### 3.2 "Verified" attacks the property, not the appearance

Before "ready" or "verified": (1) name the exact property the contract defines; (2) name the test that would make it
**fail** if the property did not hold; (3) only then say "verified". "It looks right" or "the text showed up" is not
verification: if what is promised is reactivity, the test shows the change arriving in the DOM. A test report states the
property, how it was attacked, what would make it fail, and then the result, separating what was seen from what was
deduced; a bare number is "trust me".

### 3.3 The close is the whole suite against the real thing

Before "green" or "ready", the **whole suite of the branch the change touches**, against the real system, never "the last
case passed".

| Change class (declared in the commit) | How it is recognised | Branch that runs |
|---|---|---|
| Incremental, harmless | A new capability behind an option | The suites of the touched piece, with their new cases |
| Behaviour change | Code that others already pass through (layout, an inherited method, a default, a hook) | The module's suite and that of everything that inherits or calls it |
| Breaking change | A signature, name or contract someone uses | All of them, and notice to the sessions that own the consumers |

Tracing the branch is the hard part: is it incremental or does it change a definition; who uses it; how; over which
scopes; what changes in observable behaviour. Without evidence to answer, the change moves up a class. A test server of
our own is fine for level 0 but certifies nothing that depends on the real server (a 304, a header, a cache mode): that
property gets its own case against the real deployment. Running everything by reflex is the opposite mistake: it means
the branch was never traced.

### 3.4 There is no "known red"

A test runs at 100 % or something is wrong. A red case means the code is wrong (fix the code), or the test is stale
(fix the test), or it cannot be covered yet (an explicit `fixme`/`skip` with the reason, the condition to return, and the
owner, in the test and in the TDD). A report with N/M that does not explain every red is not a close, even if "they were
already red": the baseline describes a debt, it does not absolve it. A fixture that is broken on purpose and lives in the
database is switched off when the test ends, so that start-up logs with known errors do not train people to ignore logs.

### 3.5 What the harness says is evidence, not law

The harness, its hooks and its automatic reviewers were written by people with general rules, and they are wrong
sometimes.

| What arrives | What it is | What is done |
|---|---|---|
| A harness state ("not sent", "terminal active") | A datum with a margin of error | Contrasted with the facts; if it does not match, one line to the person |
| An automatic review or a generic warning ("looks malicious") | A judgement without context | Weighed with the session's context: if it does not apply, say why in a line and continue; if it does, fix it |
| A hard gate: a classifier denial, a denied permission, a hook that blocks | A control that belongs to the person | **Not circumvented**, but the task is **not abandoned** |

### 3.6 A denial is respected, not routed around

| Do | Do not |
|---|---|
| Stop. Say in one line what you wanted to launch and why | Re-launch "without that", change the words, find another tool that does the same |
| Hand the retry to the person; repeat the request in a short message until approved or refused | Reformulate: it frees nothing and adds to the consecutive denials that pause the auto mode |
| If the person is away, give the **exact text** they must type to approve (naming the file and the change, not just the verb) | Let a subagent retry, or run it on a subagent's behalf without the person's explicit go-ahead |
| Keep going with what does not depend on the blocked step | Edit files with `sed`/`python`/heredocs to dodge an edit gate, or re-assemble an operation a hook blocked |

A gate that demands a step (Edit requires a prior Read) is respected; the gate forces you to see the state before
touching it. Deleting is always `rm`, in two steps: a read-only look, then an evaluation, then the destruction in a
separate step after the go-ahead, never chained in one command.

A **hypothesis** with a green test bench underneath is *executed*, not avoided: try it, measure it, and if it goes red,
revert and report with the numbers. What is not done is patching the fixture to work around the hole: that hides the
defect until production.

---

## 4. How it learns

### 4.1 Skills first, and close the gap when the skill failed

| Step | Rule |
|---|---|
| 1 | For any work on an area that has a skill, start from the skill: its `SKILL.md` and the relevant reference **before** reading framework code |
| 2 | If the skill lacks the information, go to the code |
| 3 | If you had to go to the code, the skill had a **gap**: record it at once (the gap log of [`agent-tools/graph-rag`](../agent-tools/graph-rag): `reportGap`, then `gaps`, then `closeGap`, enabled with `GAPS_DB`) with the need in the language of intent, and close it by enriching the skill |

| What you found | Where it goes | The skill |
|---|---|---|
| The skill did not say how X is done | Into the skill | **Enriched** |
| The code does **not** do what the skill says | A finding in the cross-cutting bug list, plus a fix in the code | **Not touched** |

Writing "this does not work" in the skill would canonise a defect as design. The question is always: *does the skill lie,
or does the code fail?* A fix that closes a listed finding closes it in the same commit: the body is emptied, one line
points to where the lesson now lives, and the list never claims something is broken that is not.

A **skill is the contract of one area** (a short `SKILL.md` with tables and pointers, history and cases in `references/`).
Skills that outgrow about 20 KB or 300 lines are re-organised at the daily close, behind red/green questions run by a
fresh subagent before and after, and never by cutting contract to fit the size.

Search order when the piece's name is unknown: semantic search over the knowledge graph (`itdfw-graph`), then the graph's
exact-term queries, then the component inventory, then a symbol server, and plain text search last. The framework
usually already provides the piece, so the assumption before writing infrastructure is that it exists.

### 4.2 The memory tree: three levels, because the auto-loaded one has a size limit

| Level | What it is | Loaded |
|---|---|---|
| **Manual** (`MEMORY.md`) | A small, frozen manual: the topics, how the tree works, how to rebuild one's own context, the read/write protocol, and an index of the topics with one line each | **Automatically** into every session. Kept small on purpose, because an auto-loaded file over the size limit is truncated, and a truncated manual is worse than none |
| **Tree** (`MEMORY-TREE.md`) | The content by topic (how I operate, how we collaborate, engineering discipline, framework architecture, tools, product), verbatim, each entry with a pointer | **On demand**, by topic: read the map, find the section, read only that section. Never whole |
| **Detail files** (`<type>_<slug>.md`) | One memory each, with front matter (`name`, `description`, a type such as `feedback`, `user`, `project`, `reference`) and a body that states the fact, **why**, and **how to apply** | On demand, from the pointer in the tree |

The bootstrap after a start or a compaction: the manual is already in context; read topic 1 of the tree in full (the
critical operating rules); then read the topic of the work at hand and load the skill of the area; then answer. A new
memory is written to the tree and to a detail file; the manual is never grown. A memory that changes or dies is
updated or deleted in tree and file, so there are no zombies.

### 4.3 Rules are written when they are born

A rule, a skill gap or a memory that is decided during the day is **written at that moment**. A rule that exists only in
a to-do list for the close exists for nobody: neither for the parallel sessions nor for the session that compacts and
forgets. The close queue is for things that need the architect's joint reading (findings, summary memories), not for
saving quota.

A rule is a **contract**: what to do, in tables or bullets, with its why in one line. The history (dates, quotes, the
case that originated it) goes to memory, never to the rule, because rules are loaded whole into every session. Editing a
rule live does not invalidate the prompt cache: the harness appends the diff and the running session reads it in the
same turn.

### 4.4 Two things that look alike are not merged

Before factoring, unifying or putting two similar things in one `if (A || B)`: *if the business of A evolves, must B
change the same way?* **No**: keep them separate, even if they do the same today. Sameness of output is not sameness of
logic. When the decision is "do not merge", it is **written in the file**, so the next reader does not try again.

A piece that is **ours** is not wrapped either: if it does not fit, its signature changes (and the TDD, if needed). A
wrapper, an adapter, a literal that copies getters, or an owner that re-implements the piece is the same decision as
treating our own piece as fixed. Only what is foreign (an HTTP client, the UI framework, the web server) is wrapped.

---

## 5. How it runs unattended

### 5.1 Subagents: model and effort are explicit

| Who | Model and effort |
|---|---|
| The reviewing roles (technical lead, core, QA, UI, advisor) | The stronger model, medium effort (the first two may go higher per session) |
| Project and module sessions, and every subagent that operates (implements, searches, synthesises, edits) | The mid-size model, high effort |
| Trivial or mechanical work (a lookup, a count, a format) | The small model, never for long tasks |
| The most expensive model | **Never** for subagents: the stronger tier beats it at code and reasoning and costs less |

What a mid-size model delivers is reviewed by the stronger one. An agent type with no declared effort **inherits the
session's**, so implementers use a typed agent whose front matter fixes model and effort, and the generic agent type is
never used. Delegation default: a fresh mid-size subagent with a self-contained brief; a **fork** (inherits the thread
and the model) only when the conversation itself is the input and under 75 % of context, because a fork also inherits
whatever contaminates the thread. Only the main session delegates; a subagent does its task itself. When the main
session runs on the most expensive model, the cut for who writes code is size and context: something already loaded goes
to a fork; a new file, a translation, N sites or code not loaded go to an implementer with a closed brief. The contract,
the case in prose and the decision stay with the main session, and the subagent's report is read **against the contract**,
not by its green number.

A subagent's browser verification is a **Playwright spec run from the console**, never a browser tool through the model:
every browser-tool call puts the whole page into the context.

### 5.2 The daily close (a cron with a day mark)

At a fixed hour a system cron messages the owner session of the close (or a fallback if it is not alive) using
[`claude-session-msg.sh`](../plugins/itdfw-sessions/bin/claude-session-msg.sh); the pattern to copy is
[`examples/daily-close-cron.sh`](../plugins/itdfw-sessions/examples/daily-close-cron.sh). There is **no acknowledgement**:
a cron is not a session and receives no replies. The signal is a **day mark**: the session creates `<date>.running` at
the start and renames it to `<date>.done` at the end; a `.running` older than 3 hours is taken as dead and a retry is
allowed. One close per day.

| Step of the close | Detail |
|---|---|
| Gaps | List the open skill gaps, document what was missing (README, skill, architecture notes), close them |
| Knowledge graph | Update the graph (never the bare command that rebuilds it), then re-index the semantic search. If the update is rejected for **shrinking**: legitimate (deletions, moves, renames that account for the deficit) means force; an unexplained massive deficit means never force, report |
| Reality anchor | Rewrite one fixed-path file that the architect opens to check what is true today: flat statements of what is true, what did **not** break, pointers to the real evidence, and the real pending items framed as small and bounded. Short enough to read in 30 seconds |
| Audits | Weigh every skill and send the oversized ones to be re-organised; list leftover `.bak`/`.old` files and **offer** to delete them (offered, not deleted) |
| Compaction | Afterwards, the technical lead compacts the idle sessions over 50 % of context |
| Quota | Read the usage at the start and the end, and report the difference |

The close runs on the mid-size model, in the background, and if it takes over about 30 minutes something is waiting on a
prompt. A message from a cron carries the cron's own name as sender, never the receiver's, because a session that
received a ping under its own name once tried to answer itself.

### 5.3 Compacting and reviving sessions

| Need | Mechanism |
|---|---|
| A session is dead and needed | [`cajarito-despertar.sh`](../plugins/itdfw-sessions/bin/cajarito-despertar.sh): `claude --bg --resume <id>` brings it back in the daemon with the same id, name, agent and model, idle. A bare `claude --resume` opens the interface in the foreground and dies with its terminal |
| A session's context is large | [`cajaritos-compactar.sh`](../plugins/itdfw-sessions/bin/cajaritos-compactar.sh): attaches in a terminal-multiplexer window, runs `/compact`, waits for the percentage to drop, closes the window; the session stays alive. It skips sessions that are not idle or have tasks in the last 10 minutes |
| A session cannot compact itself | Another one asks for it: a session is never compacted by itself |
| A session's cache is going cold | [`claude-keepalive.sh`](../plugins/itdfw-sessions/bin/claude-keepalive.sh) queues a ping in every live session. A session idle over an hour has an expired cache, so any message costs it a full context rewrite, even if it answers nothing |
| A notice reaches everyone | [`claude-broadcast.sh`](../plugins/itdfw-sessions/bin/claude-broadcast.sh). An announcement is applied and the turn ends: it does not open work, and the board, not chat, carries what is the architect's |

### 5.4 The weekly quota is a funnel

At **95 %** of the weekly quota, everything stops and documents what it has; before that, nobody brakes on its own. The
technical lead then decides what continues, from what was agreed with the architect. The aim is to arrive with air: more
than 15 % free at the daily close, and more than 10 % free before the weekly reset. The board holds the priority; a task
parked by the funnel is not a red to be scolded for. [`claude-usage-watch.sh`](../plugins/itdfw-sessions/bin/claude-usage-watch.sh)
reads the usage without an open session.

### 5.5 Testing without stepping on each other

| Rule | Mechanism |
|---|---|
| Saving a file restarts nothing: the shared back-end runs the code of its last restart, so testing against it without restarting tests **old code with no error** | Each session starts its **own** back-end for its suite, and stops it afterwards |
| Restarting the shared back-end, and the final test through the real proxy with the service worker active, are exclusive operations | A queue: take the lab (FIFO, with a reason and a duration), restart, test, release saying what was done. A queued turn arrives as a message; nobody asks "is it free?" |
| Whoever **modifies** tests first, in their own back-end, to N/N; only then publishes to the shared one | A change is never sent to another session "so you test it" |
| Each concept is tested in its own site of the development deploy | One site per concept; nobody builds or seeds in another concept's site |
| Automated tests are deleted for real; what was built stays visible for the architect | A test-only model declares a hard delete; a test-only collection is dropped; a "showcase" site keeps sample data |
| Tests are **published** with their package | No credentials, hosts, personal data or internal context in a test; the environment supplies them and a missing variable is an error |

---

## 6. What enforces what

"Hook" = Claude Code runs a program around a tool call and can refuse it. "Script" = a command the session or a cron
runs. "Text only" = nothing stops a model that forgets. Scripts marked *private* live in the author's tooling, not in this
repository.

| Rule | Mechanism | Kind | Where |
|---|---|---|---|
| Load the skill of an area before editing it | `skill-gate` blocks an edit of a mapped path until the skill was loaded in this session; `skill-mark` records it; `skill-reset` clears it after a compaction | Hook | [`itdfw-hooks`](../plugins/itdfw-hooks) |
| Editing a `TDD*.md` requires the TDD skill | The same gate, one row of its path map | Hook | idem |
| Read the definition of done before committing code | `commit-completeness-gate` blocks a commit of non-Markdown files unless that skill was loaded. It checks the **skill was loaded**, not that the suite ran | Hook | idem |
| Use the structured search tools before text search | `graph-gate` blocks the first `rg`/`grep -r` unless a structured search ran in the last 10 minutes; the second attempt passes (a reminder, not a wall) | Hook | idem |
| Typed subagents, explicit model, no most-expensive model, fork only under 75 % of context, only the main session delegates | `agent-type-gate` | Hook | idem |
| Effort of a subagent | The front matter of the agent file, inherited otherwise | Configuration | the agent definition |
| Do not overwrite files by accident | `safe-mvcp` denies `mv`/`cp` without `-n`/`-i` | Hook | idem |
| Use the project's package manager | `npm-pnpm` denies `npm`/`npx` | Hook | idem |
| Comment only what the code cannot say | `comment-police` after an edit (exit 2 with a message; it does not undo the edit); `prune-post-commit.sh` after a commit (never blocks) | Hook / git hook | idem |
| A comment prune changes no code | `ast-same.sh pre` then `check`: both sides re-printed by esbuild with whitespace minified and compared | Script, on demand | idem |
| Edit needs a prior Read | The harness itself | Harness | Claude Code |
| A denial is not circumvented | The harness denies; a local hook logs the denial and notifies the person (not published). The behaviour of the agent after a denial is text | Harness + text | n/a |
| Wake a dead session without bothering the person | `cajarito-despertar.sh` | Script | [`itdfw-sessions`](../plugins/itdfw-sessions) |
| Compact idle sessions at the close | `cajaritos-compactar.sh` (threshold 50 % by default) | Script | idem |
| Reach a live session from a cron | `claude-session-msg.sh`; the day mark pattern is in the example cron | Script + convention | idem |
| Work board states, the red flag after an hour, priorities | `cartera.sh` | Script | idem |
| Keep the cache warm, broadcast, read the quota | `claude-keepalive.sh`, `claude-broadcast.sh`, `claude-usage-watch.sh` | Script | idem |
| Stop at 95 % of the quota | The script **reads** the quota; the stop is a rule the sessions obey | Text (with a script that measures) | idem |
| Gaps in skills are recorded and closed | `reportGap` / `gaps` / `closeGap` over a small SQLite log (opt-in with `GAPS_DB`); closing means enriching the skill, which is text | Tool + text | [`agent-tools/graph-rag`](../agent-tools/graph-rag) |
| Room etiquette | The room is the chat; staying silent is text | Text | [`agent-tools/room`](../agent-tools/room) |
| Own back-end per session; the lab queue; restarts exclusive | Private scripts for starting and stopping a session's back-end, for the FIFO lab, and for a restart that records its time | Script, *private* | not published |
| No secrets in the repository | A secret scanner in strict mode run before a push, and a whitelist check of what a package publishes | Script, *private* | not published |
| Version bump per change, and drift against the registry | A private script that compares the monorepo with the registry; publishing is a release step | Script, *private* + text | not published |
| One owner per piece; core changes by request | Nothing | Text only | n/a |
| Chain of custody; review of every development; silence for notices that do not concern you | Nothing: the board is a record, not a notice | Text only | n/a |
| TDD before code, slice 1, mode of the TDD, conformity checklist | The TDD skill states the checklist and the stop rule; the gate only forces the skill to be loaded | Text (skill) | [`itdfw` skills](../plugins/itdfw/skills) |
| A fact is a pin; "verified" is the property; the close is the whole suite; no known red; the harness is evidence; a hypothesis is executed | Nothing | Text only | n/a |
| Decisions in your own layer are written and made | Nothing | Text only | n/a |
| Rules written when they are born; the memory tree in three levels | Nothing, beyond the size limit that truncates the auto-loaded manual | Text only | n/a |

The honest reading of this table: **mechanical rules are the cheap ones** (a path, a command word, a flag, a count). The
rules that carry the most weight, the ones about honesty and ownership, are all in the "text only" rows. They hold
because every session reads them at start and because the technical lead reviews against them, not because anything stops
a model from skipping them. See [what we got wrong](#7-what-we-got-wrong) for what each cost.

---

## 7. What we got wrong

Each rule above exists because of a failure. These are five of them, generalised.

| What happened | What it produced |
|---|---|
| **A session closed an assignment and did not tell the requester.** The work had passed through three sessions; the last one reported to the technical lead, the technical lead closed it, and neither of the two earlier links ever heard it was done | The **chain of custody**: a close travels back up the same chain it came down, and the reviewer tells the original owner too. The board is explicitly a record, not a notice |
| **A restart of the session daemon killed 7 of 13 sessions** and there was no way to bring them back without the architect | `cajarito-despertar.sh` (resume in the daemon with the same identity), the rule that the technical lead revives sessions itself, and later the compaction script built on the same attach mechanism |
| **A harness presence status said a push was "not sent: terminal is active"** while the person was away from the machine, and a session repeated the verdict as if it were a fact | "What the harness says is evidence, not law": a harness state is a datum with a margin of error, contrasted with the facts; and a hard gate is still never circumvented |
| **Browser verification through a browser tool in the model** put the whole page into the context on every call, and each step was a round trip through the model: slow and expensive in tokens | Browser verification is **always a Playwright spec run from the console**, as one line per case; the browser tools are not used to test |
| **A test bench's fixture was patched to work around a hole** (a cache header set on its endpoints instead of trying the change in the service worker that was the real cause). The patch hid exactly what needed closing | A hypothesis with a green bench underneath is **executed, measured and reverted** if red; what is never done is patching the fixture. A one-line revert costs 30 seconds; a patched fixture hides the defect until production |

Two more, shorter, that shaped the testing rules: a session tested against a shared back-end that does not restart on
save and saw no error while running old code (hence each session's own back-end), and a local fix wrapped around a piece
of our own made three more pieces, each explaining the previous one (hence "a piece of ours is not wrapped: its signature
changes").

---

*Counts and behaviours of the published scripts and hooks are those in their own READMEs, checked there against the code.
This document describes a practice, not a guarantee: the rules it lists are loaded into sessions as text, and section 6
says how far each is more than that.*
