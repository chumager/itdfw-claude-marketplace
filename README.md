# ITDFW — what was built around Claude Code

This repository holds the working tools built to develop **ITDFW**, a Node.js/MongoDB application framework, with
Claude Code as the main developer: a set of **skills**, three **MCP servers**, a **chat room** for live sessions, and
**hooks** that enforce working rules in code.

**It is meant to be read, not installed.** Everything here assumes the ITDFW framework and a specific machine. The
framework itself is not in this repository: the skills describe it. Each piece has its own README with the same
sections — what it is, what it exposes, how it works, how to verify it, what depends on ITDFW, and its limits — and
the technical claims in those READMEs carry a `file:line` that was checked against the code on 2026-11-10.

## Map

| Piece | What it is | Where | Problem it addresses | How to verify |
|---|---|---|---|---|
| **Skills** (`itdfw` plugin) | 17 skills: Markdown instructions that Claude Code loads on demand, one per area of the framework | [`plugins/itdfw/skills/`](plugins/itdfw/skills) | An agent that does not know the framework re-invents what exists or breaks its conventions. A skill gives it the contract of one area before it edits | Read them; each states its trigger in its front matter. `tdd-narrativo` and `itdfw-completeness` describe how work is specified and when it counts as done |
| **MCP `itdfw`** | A server over stdio with 14 tools to read and change a **running** ITDFW back end with a real user's identity | [`agent-tools/itdfw-mcp/`](agent-tools/itdfw-mcp) | Lets an agent inspect models, forms, grids and translations of a live system without booting the framework | `node --test` on its one test file, which needs a running back end (9 cases); not self-contained |
| **MCP `inventory`** | A server over stdio that answers "who extends this component, who uses it" for the front | [`agent-tools/inventory-mcp/`](agent-tools/inventory-mcp) | Before changing a component, list what the change can break | `node --test test/` (2 cases, self-contained; they cover only the `@spec` reader) |
| **MCP `itdfw-graph`** | A server over stdio doing semantic search over the knowledge graph that the third-party tool graphify builds | [`agent-tools/graph-rag-mcp/`](agent-tools/graph-rag-mcp) | Find *which piece already solves this* when you do not know its name | No tests. Manual: the `status` and `find` tools |
| **`room`** | A command-line chat between a person and live Claude Code sessions on the same machine | [`agent-tools/room/`](agent-tools/room) | Lets several sessions and a person talk in one place with history, without a server | `node --test` (27 cases, self-contained, fake sessions) |
| **Hooks** | Shell and Node scripts that Claude Code runs on lifecycle events to enforce rules (load the skill before editing, no generic subagents, comment hygiene, presence notices) | [`plugins/itdfw-hooks/`](plugins/itdfw-hooks) | Rules written as text get forgotten; a hook makes the harness refuse the action | Not tested. Read the scripts; they are short |

## What is a real AST and what is not

"AST" is easy to over-claim, so here is each tool, from the code:

| Tool | Mechanism | Evidence | Whose code |
|---|---|---|---|
| **MCP `inventory`** | Regular expressions over file text, keyed by the file's base name. **Not an AST.** | `agent-tools/inventory-mcp/scan.mjs:19-22` imports only Node built-ins; the matches are `RegExp` (`scan.mjs:125-126`, `scan.mjs:173-174`) | ours |
| **MCP `itdfw`** | JSON over HTTP to the back end. It does not read or parse code. **Not an AST.** | `agent-tools/itdfw-mcp/src/server.js:2-6`; the HTTP client is the package `@chumager/itdfw-headless-client` (`src/index.js:31-42`), a dependency that is **not included** in this repository | ours |
| **MCP `itdfw-graph`** | Embeds the labels of nodes that graphify already produced. It parses nothing. **Not an AST.** | `agent-tools/graph-rag-mcp/src/index.js:127-133`, `:142` | ours |
| **graphify** | For source code, tree-sitter parsing (a real AST), no LLM. For documents and images, a model. Only part of the graph is code (about a fifth of the nodes in our graph on 2026-11-09). We run it with a small local patch so that `.jsx` files use the TSX grammar | graphify's own package metadata and `extract.py` | third party (`graphifyy`, Apache-2.0) |
| **Serena** | A client of language servers (LSP). It has no parser of its own | its installed package (`serena-agent`); in our project it is configured with one language server, `vue` | third party |
| **`comment-police`** (hook) | Parses the edited JavaScript file with **espree** (ESLint's parser) to extract comments and to tell whether a comment is commented-out code | `claude-hook-comment-police.mjs:5`, `:57-63` | ours, using espree (third party) |
| **`ast-same.sh`** | Re-prints the file at `HEAD` and the working copy with **esbuild** (`--minify-whitespace`) and compares the two texts. A re-printed text, not a serialized tree | `ast-same.sh:14`, `:20` | ours, using esbuild (third party) |

So the AST work in this repository is done by espree, esbuild, tree-sitter (inside graphify) and a language server
(inside Serena). The three MCP servers written here do not parse code.

## How the pieces relate

- The **skills** are loaded by Claude Code according to their front matter. They hold the knowledge of the framework.
- The **hooks** run around tool calls and enforce a few rules mechanically, for example that the skill of an area has
  been loaded before an edit in that area, or that comments are not left as dead code.
- The **MCP servers** give the agent facts instead of guesses: the live system (`itdfw`), the component tree
  (`inventory`), the knowledge graph (`itdfw-graph`).
- **`room`** is unrelated to the framework: it lets sessions talk to each other and to a person.

## What depends on ITDFW

| Piece | Runs without ITDFW? |
|---|---|
| Skills | No. They describe the framework |
| MCP `itdfw` | It needs the package `@chumager/itdfw-headless-client`, which is not included here. The back-end half is an ITDFW plugin; the stdio half would run against anything that accepts the same JWT, but almost every tool points at an ITDFW route |
| MCP `inventory` | The scanner is a directory walker and regexes, but its rules (cascade slot, `localImport`, the `Itd` prefix) are the framework's idiom |
| MCP `itdfw-graph` | Yes, for any repository that has a graphify graph. Defaults and tool texts are ITDFW's |
| `room` | Yes, it imports nothing from the framework. It depends on **Claude Code's internal session files and socket protocol**, which are not documented |
| Hooks | They are personal to one machine and one user (absolute paths, session names, a task board). None is installable as is |

## Honest limits

- Few automated tests. `inventory` has 2 (only for the `@spec` reader), `itdfw` has 9 that need a running back end,
  `room` has 27 (the only suite that runs by itself in full), `itdfw-graph` and the hooks have none.
- Several READMEs list open findings. They are real, not hidden: one of them (the headless client attaching its token
  to an absolute URL on another host) is documented in the `itdfw` MCP README.
- The skills are written in a mix of English and Spanish and were written for an agent reader, not as a manual.
- Counts such as the number of tools or graph nodes are the result of one reading on 2026-11-10; the code is the
  authority if it has moved.

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
