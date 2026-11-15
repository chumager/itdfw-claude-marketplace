# ITDFW — what was built around Claude Code

This repository holds the working tools built to develop **ITDFW**, a Node.js/MongoDB application framework, with
Claude Code as the main developer: a set of **skills**, two **MCP servers**, a **chat room** for live sessions,
**session scripts** to reach background sessions from a cron, an **Agent SDK** service with measured model
comparisons, **hooks** that enforce working rules in code, and the **operating model** that ties them together.

> Evaluating this repository? Start with [`START-HERE.md`](START-HERE.md): the main claims, each with the place that
> checks it, and one command that runs every test.

**It is meant to be read, not installed.** Everything here assumes the ITDFW framework and a specific machine. The
framework itself is not in this repository: the skills describe it. Each piece has its own README with the same
sections — what it is, what it exposes, how it works, how to verify it, what depends on ITDFW, and its limits — and
the technical claims in those READMEs carry a `file:line` that was checked against the code on 2026-11-10.

## Map

| Piece | What it is | Where | Problem it addresses | How to verify |
|---|---|---|---|---|
| **Skills** (`itdfw` plugin) | 18 skills: Markdown instructions that Claude Code loads on demand, one per area of the framework, plus three on process | [`plugins/itdfw/skills/`](plugins/itdfw/skills) | An agent that does not know the framework re-invents what exists or breaks its conventions. A skill gives it the contract of one area before it edits | Read them; each states its trigger in its front matter. `producto-antes-del-tdd`, `tdd-narrativo` and `itdfw-completeness` describe who studies a product before it is specified, how work is specified and when it counts as done |
| **MCP `inventory`** | A server and CLI over stdio that answer "who extends this component, who uses it" for a front. It needs an `inventory.config.json` of the project that uses it | [`agent-tools/inventory/`](agent-tools/inventory) | Before changing a component, list what the change can break | `pnpm test` (17 cases, self-contained: a small fixture project; they cover the config lookup, the scan and the MCP pipe, not `mixins` or external project roots) |
| **MCP `itdfw-graph`** | A server over stdio doing semantic search over the knowledge graph that the third-party tool graphify builds | [`agent-tools/graph-rag/`](agent-tools/graph-rag) | Find *which piece already solves this* when you do not know its name | `pnpm test` (13 cases, self-contained: no Ollama, a fake vector-database listener). The embedding path and `find` against a real index are not covered |
| **`room`** | A command-line chat between a person and live Claude Code sessions on the same machine | [`agent-tools/room/`](agent-tools/room) | Lets several sessions and a person talk in one place with history, without a server | `pnpm test` (43 cases, self-contained, fake sessions) |
| **Sessions** (`itdfw-sessions` plugin) | Fourteen shell scripts to talk to Claude Code sessions from a cron or another session: message a live session by name, wake a dead background one, broadcast, keep the prompt cache warm, compact idle sessions and hand each one back its thread after any compaction, read the usage, a small work board | [`plugins/itdfw-sessions/`](plugins/itdfw-sessions) | A cron or a script that needs the tools of a session has no safe way in; a dead background session has no one-command way back | `node --test "test/*.test.mjs"` in the plugin (157 cases: fake sessions, fake sockets and stubs; not covered: what a real Claude Code still accepts) |
| **`agent-runner`** | A small HTTP service on the Claude Agent SDK that runs one recipe per job (read a printed menu from photos into structured JSON), with a validator that scores each run against a reference; plus the measured comparison of Haiku, Sonnet and Opus and of five prompt versions, with cost per run | [`agent-tools/agent-runner/`](agent-tools/agent-runner) | Choosing a model and a prompt by measurement instead of by impression, and showing where the defects come from (the model or the prompt's definition) | `pnpm test` (48 cases, no API key and no model); the results are in its `RESULTS.md`, whose reference was another model's reading that nobody validated |
| **Hooks** | Shell and Node scripts that Claude Code runs on lifecycle events to enforce rules (load the skill before editing, no generic subagents, comment hygiene, presence notices) | [`plugins/itdfw-hooks/`](plugins/itdfw-hooks) | Rules written as text get forgotten; a hook makes the harness refuse the action | No automated tests; each hook was run once by hand with sample input (see its README). The scripts are short |
| **Operating model** | A document, not code: how an office of long-lived sessions with one owner per piece works in parallel, coordinates, reviews and corrects itself, and which of its rules a hook or script enforces versus which rest on the model's discipline | [`docs/operating-model.md`](docs/operating-model.md) | Parallel sessions without a shared practice collide, forget to report, and report success by default | Read section 6 (rule to mechanism table) and check each row against the hooks and session scripts it names |

## What is a real AST and what is not

"AST" is easy to over-claim, so here is each tool, from the code:

| Tool | Mechanism | Evidence | Whose code |
|---|---|---|---|
| **MCP `inventory`** | Regular expressions over file text, keyed by the file's base name. **Not an AST.** | `agent-tools/inventory/scan.mjs:23-25` imports only Node built-ins; the matches are `RegExp` (`scan.mjs:216-217`) | ours |
| **MCP `itdfw-graph`** | Embeds the labels of nodes that graphify already produced. It parses nothing. **Not an AST.** | `agent-tools/graph-rag/src/index.js:135-141`, `:157` | ours |
| **graphify** | For source code, tree-sitter parsing (a real AST), no LLM. For documents and images, a model. Only part of the graph is code (about a fifth of the nodes in our graph on 2026-11-09). We run it with a small local patch so that `.jsx` files use the TSX grammar | graphify's own package metadata and `extract.py` | third party (`graphifyy`, Apache-2.0) |
| **Serena** | A client of language servers (LSP). It has no parser of its own | its installed package (`serena-agent`); in our project it is configured with one language server, `vue` | third party |
| **`comment-police`** (hook) | Parses the edited JavaScript file with **espree** (ESLint's parser) to extract comments and to tell whether a comment is commented-out code | `plugins/itdfw-hooks/bin/comment-police.mjs:12`, `:64-70` | ours, using espree (third party) |
| **`ast-same.sh`** | Re-prints the file at `HEAD` and the working copy with **esbuild** (`--minify-whitespace`) and compares the two texts. A re-printed text, not a serialized tree | `plugins/itdfw-hooks/bin/ast-same.sh:15`, `:21` | ours, using esbuild (third party) |

So the AST work in this repository is done by espree, esbuild, tree-sitter (inside graphify) and a language server
(inside Serena). The two MCP servers written here do not parse code.

## How the pieces relate

- The **skills** are loaded by Claude Code according to their front matter. They hold the knowledge of the framework.
- The **hooks** run around tool calls and enforce a few rules mechanically, for example that the skill of an area has
  been loaded before an edit in that area, or that comments are not left as dead code.
- The **MCP servers** give the agent facts instead of guesses: the component tree (`inventory`) and the knowledge
  graph (`itdfw-graph`).
- **`room`** is unrelated to the framework: it lets sessions talk to each other and to a person.
- The **session scripts** are unrelated to the framework too: they let a cron or a script reach a live session, wake a
  dead one or compact the ones that grew too much.

- The **operating model** ([`docs/operating-model.md`](docs/operating-model.md)) is the practice that ties all of the
  above together: the roles of the sessions, how work and reports move between them, and a table of which rules the
  hooks and scripts here enforce and which are text only.

## What depends on ITDFW

| Piece | Runs without ITDFW? |
|---|---|
| Skills | No. They describe the framework |
| MCP `inventory` | The scanner is a directory walker and regexes taken from the project's own `inventory.config.json`; the identity rule (the file's base name, a cascade slot) is the framework's idiom |
| MCP `itdfw-graph` | Yes, for any repository that has a graphify graph. Defaults and tool texts are ITDFW's |
| `room` | Yes, it imports nothing from the framework. It depends on **Claude Code's internal session files and socket protocol**, which are not documented |
| `agent-runner` | Yes. It needs an Anthropic API key to run a job (not for its tests); the recipes that read the framework's own data were left out |
| Sessions | Yes, they import nothing from the framework. Like `room`, they depend on **Claude Code's internal session files and socket protocol**, which are not documented |
| Hooks | Ten of them are packaged, but they assume an ITDFW repository, an agent type named `base` and a skill that are not shipped, and they run in every project where the plugin is enabled. Read them rather than install them |

## Honest limits

- `scripts/test-all.sh` runs every suite in one command. `inventory` has 17, `itdfw-graph` 13, `room` 43,
  `agent-runner` 48 and the session scripts 159 (280 in all, each runs by itself), and the hooks have none.
- Each README lists its own open limits, with the line that shows each one. None is hidden.
- The skills are written in a mix of English and Spanish and were written for an agent reader, not as a manual.
- Counts such as the number of tools, tests or graph nodes are the result of one reading on 2026-11-12; the code is
  the authority if it has moved.

## Installing the skills (optional)

The skills load as a Claude Code plugin. They are useful only next to the ITDFW code.

On a dev machine (loads in place; edits apply on the next session or `/reload-plugins`):

```sh
claude plugin marketplace add /path/to/this/repository
claude plugin install itdfw@itdfw
```

A session that was already open sees the plugin after `/reload-plugins` or a restart (`/reload-skills` does not load
a newly installed plugin). From git, add the repository URL instead of the path. `plugin.json` has no `version` on
purpose: the plugin tracks commits.
