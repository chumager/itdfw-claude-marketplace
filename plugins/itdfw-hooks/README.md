# itdfw-hooks — rules enforced by Claude Code hooks

Thirteen registered hooks and two more for the user's own settings, written to keep an agent inside a set of working practices while it develops on the
ITDFW framework and to keep the person in the loop when they are away from the keyboard, plus two helper scripts for
`git` and the definition of the `base` agent the delegation gate asks for. A hook is a program that Claude Code runs
around a tool call and that can refuse the call. The idea behind them: a rule written as text gets forgotten, a rule
enforced by the harness does not.

> **Read this before anything else.** These hooks come from one machine and one working style, and that machine runs
> them from this folder. They are published to be **read**, not installed as they are. Several assume an ITDFW
> repository and a skill that is not in this marketplace; the presence hooks assume `tmux` and the `itdfw-sessions`
> plugin. A plugin's hooks run in **every** project where the plugin is enabled, and most of these have no "is this an
> ITDFW repository?" guard (see Limits).

All `file:line` references below are to the scripts in `bin/` and were checked against them on 2026-11-10. The hooks
were also run once each with sample input in a throwaway `HOME` (see "How to verify").

## What is registered (`hooks/hooks.json`)

| Event | Matcher | Script | Timeout |
|---|---|---|---|
| `PreToolUse` | `Bash` | `bin/safe-mvcp.sh` | default |
| `PreToolUse` | `Bash` | `bin/commit-completeness-gate.sh` | 10 s |
| `PreToolUse` | `Bash` | `bin/npm-pnpm.sh` | 5 s |
| `PreToolUse` | `Edit\|Write` | `bin/skill-gate.sh` | default |
| `PreToolUse` | `Agent` | `bin/agent-type-gate.sh` (status line "Checking subagent_type/model...") | default |
| `PreToolUse` | `Bash` | `bin/graph-gate.sh` | 5 s |
| `PostToolUse` | graph, Serena, Qdrant and inventory search tools (12 tool names) | `bin/search-mark.sh` | default |
| `PostToolUse` | `Edit\|Write\|MultiEdit` | `bin/comment-police.sh` (runs `bin/comment-police.mjs`) | default |
| `PostToolUse` | `Skill` | `bin/skill-mark.sh` | default |
| `PostToolUse` | any tool | `bin/away-notice.sh` | default |
| `Stop` | any | `bin/away-notice.sh` | default |
| `PermissionDenied` | any | `bin/permission-denied.sh` | default |
| `StopFailure` | — | `bin/stopfailure-log.sh` | default |
| `SessionStart` | `compact` | `bin/skill-reset.sh` | default |

Six scripts are **not** registered: the `git` helpers `bin/ast-same.sh` and `bin/prune-post-commit.sh`;
`bin/permission-denied-ask.sh`, which `permission-denied.sh` launches detached; `bin/_sessions.sh`, a library the
presence hooks source to find the `itdfw-sessions` scripts and the person's name; and two hooks the author registers in
their own settings rather than here, because they add text to every session in every project:

- **`bin/prompt-context.sh`** (`UserPromptSubmit`): prints the real date and time (a long-lived session's own idea of
  the date freezes when it starts), `[PRESENCIA]` (at the keyboard or away), `[CONTEXTO]` with the session's context
  percentage and what to do above 75 % and 90 %, and `[MODELO]`. It reads the `ctx-<session>.json` that the status line
  leaves (see `itdfw-sessions/examples/statusline-state.sh`).
- **`bin/precompact.sh`** (`PreCompact`): tells the compactor what to keep with priority (the work in progress, the
  decisions and their reason, the person's own words) and what to drop (what already lives in files).

`user-agents/base.md` is the generic agent (Sonnet, high effort) that `agent-type-gate.sh` sends the model to. It is a
user-level agent, linked into `~/.claude/agents/`, so that its name stays `base` with no plugin prefix
(`user-agents/README.md`).

## What each one does, and the practice behind it

| Hook | What it does | The practice it backs |
|---|---|---|
| `safe-mvcp.sh` | Denies a `mv` or `cp` that has no `-n`/`-i` (no-clobber or interactive) flag (`safe-mvcp.sh:11-19`). It answers with a `deny` decision in JSON and exit 0 (`safe-mvcp.sh:22-29`). | Do not overwrite files by accident. The script cites a real case: a `mv` overwrote a plugin and broke a login check (`safe-mvcp.sh:5`). |
| `npm-pnpm.sh` | Denies any command that uses `npm` or `npx` as a command word (`npm-pnpm.sh:15`), and says to use `pnpm`/`pnpx` or to ask the user to run it with `!` (`npm-pnpm.sh:17-26`). | The repository uses pnpm. The script's reason: logins are per tool, and `npm view` of a private package answers 404 when it is really a 401 (`npm-pnpm.sh:28-29`). |
| `skill-gate.sh` | Blocks an `Edit` or `Write` on a file in a mapped framework area unless the matching skill was already loaded in this session (`skill-gate.sh:25-71`). Exit 2 with "Load the `<skill>` skill with the Skill tool before touching `<file>`". | Load the skill of an area before editing it. The path-to-skill map is in `skill-gate.sh:29-56` (see the table below). |
| `skill-mark.sh` | After the `Skill` tool runs, appends the skill name and the time to a marker file for this session (`skill-mark.sh:26-29`). It strips a `<plugin>:` prefix so that a namespaced skill unlocks the gate (`skill-mark.sh:13-14`). | Makes `skill-gate` and `commit-completeness-gate` possible. |
| `skill-reset.sh` | On a session that resumes after a compaction, empties that session's marker file (`skill-reset.sh:12-18`). | After a compaction the skills must be loaded again. |
| `commit-completeness-gate.sh` | Blocks a `git commit` whose staged files include anything other than `.md` unless the `itdfw-completeness` skill was loaded (`commit-completeness-gate.sh:17-24`). | Read the definition of done before committing code. |
| `agent-type-gate.sh` | Blocks an `Agent` (subagent) call in five cases, below. | Delegate on purpose: every subagent has a declared type, and cost and effort are not left to inheritance. |
| `graph-gate.sh` | When a `rg`/`grep -r` runs over the repository, blocks it **once** unless a structured search was used in the last 10 minutes; the second attempt passes (`graph-gate.sh:62-83`). | Ask the tools that already know the code (graph, Serena, inventory) before searching text. It is a reminder, not a wall (`graph-gate.sh:2-4`). |
| `search-mark.sh` | After one of the structured search tools runs, appends a line to this session's `search-used` file (`search-mark.sh:17`). | Makes `graph-gate` possible. |
| `comment-police.sh` / `.mjs` | After an edit of a `.js`/`.jsx`/`.mjs`/`.cjs` file, exits 2 with a message when the edit added comment noise, and warns when the whole file is saturated with comments (`comment-police.mjs:1-4`). | Comment only what the code cannot say. JSDoc is exempt (`comment-police.mjs:76`). |
| `away-notice.sh` | After a tool call, when `owner-present.sh` (from `itdfw-sessions`) finds no `tmux` client, tells the session once per turn that the person is away, so that what they must know or decide also goes out as a push notification. `Stop` clears the once-per-turn mark. | A session working alone does not leave a decision buried in a chat nobody is looking at. |
| `permission-denied.sh` | When the auto-mode classifier denies a call, appends a line to `denials.jsonl` and launches `permission-denied-ask.sh` detached, which asks the person in a popup (`ask-owner.sh`). "I approve it: type it in" types their approval, with the denied command verbatim, into the denied session's own chat through `cajarito-teclear.sh` (a peer's message never counts as the person's approval); any other answer goes back as a message from `hook:permissions`. | A denial is a decision of the person, not a puzzle for the model to route around: the model stops and the person answers. |
| `stopfailure-log.sh` | When a turn ends on an API error, appends one line with the session, the time and the error to `stopfailure.log`. | Errors that end a turn are counted, not lost. |

### `skill-gate.sh`: which path needs which skill

The first match wins (`skill-gate.sh:25-57`):

| Path contains | Skill required |
|---|---|
| `tests/` or `test/`, or ends in `.spec.js`/`.test.js` (and `.cjs`/`.mjs` variants) | `itdfw-completeness` |
| `fronts/itdfw-naiveui/`, `libs/itdfw-site-vue-core/src/`, `plugins/<name>/vue*/`, or `site/src/` (overridable) | `itdfw-front-develop` |
| `mongooseSchema/` | `itdfw-models` |
| `mongooseTypes/` | `itdfw-mongoose-types` |
| `mongoosePlugins/` | `itdfw-plugins` |
| `plugins/<name>/index.js` or `FWPlugins/` | `itdfw-fwplugin` |
| `APP/` | `itdfw-api-system` |
| `init.js` | `itdfw-core-init` |
| a `TDD*.md` file | `tdd-narrativo` |
| `claude-docs/` | `itdfw-documentation` — **a skill that is not in this marketplace** (`skill-gate.sh:52-53`) |
| `.itdfw.js` or `/etc/itdfw/*.yaml` | `itdfw-deploy-config` |

### `agent-type-gate.sh`: the five refusals

1. The call comes from a subagent, unless it is the `graphify-runner` (`agent-type-gate.sh:24-27`). Only the main session delegates.
2. `subagent_type` is missing (`agent-type-gate.sh:36-39`).
3. `subagent_type` is `general-purpose` or `claude` (`agent-type-gate.sh:41-46`).
4. The model name contains `fable` (`agent-type-gate.sh:48-53`).
5. A `fork` is requested while the main context is above 750,000 tokens (75 % of a 1M window), read from the last usage record of the transcript (`agent-type-gate.sh:55-70`, the number at `:60`).

The reason is stated in the script: an agent without its own type inherits the session's model and effort, and `effort`
cannot be passed per call, so the only way to fix it is the front matter of a custom agent file
(`agent-type-gate.sh:11-14`).

## Environment variables

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `ITDFW_MONOREPO` | `graph-gate.sh:12` | `$CLAUDE_PROJECT_DIR` | root of the repository the gate protects. Without it (and without `CLAUDE_PROJECT_DIR`) the gate does nothing (`graph-gate.sh:23`) |
| `ITDFW_SITE_SRC_PATTERN` | `skill-gate.sh:10` | `(^|/)site/src/` | regex that recognises a site's front-end source file |
| `ITDFW_HOOKS_DEPS` | `comment-police.mjs:11` | `$HOME/.claude/hook-deps` | directory that holds `node_modules/espree` |
| `ITDFW_HOOKS_BIN` | `prune-post-commit.sh:16` | the script's own directory | directory that holds `comment-police.mjs` |
| `ITDFW_SESSIONS_BIN` | `_sessions.sh` | the `PATH`, then `../../itdfw-sessions/bin` | directory that holds the `itdfw-sessions` scripts |
| `CLAUDE_BROADCAST_FROM` | `_sessions.sh` (from the `itdfw-sessions` config file) | `user` | the name the person goes by in the texts these hooks write |
| `CLAUDE_CONFIG_DIR` | the presence hooks and `stopfailure-log.sh` | `$HOME/.claude` | where `denials.jsonl`, `stopfailure.log` and the session records live |

`CLAUDE_PLUGIN_ROOT` is set by Claude Code and is how `hooks.json` finds the scripts.

State: the gates keep marker files in `$HOME/.claude/state/` (`skills-loaded-<session>`, `search-used-<session>`,
`search-plr-<session>`), keyed by the session id and, for a subagent, its agent id. Nothing in this plugin deletes them
except `skill-reset.sh` (empties one) and `graph-gate.sh:71` (removes the "already warned" mark).

## The two git helpers

- **`ast-same.sh pre|check <files>`** (`ast-same.sh:3-4`). `pre` checks that every file is committed, so that `HEAD` is the
  real "before". `check` compares `HEAD` with the working copy by re-printing both with **esbuild**
  `--minify-whitespace` and comparing the two texts (`ast-same.sh:5-6`, `:21`, `:33-35`). esbuild parses the code, drops
  comments and whitespace and does not rename, so a comment-only change prints the same and a lost line does not. It is
  a comparison of re-printed text, not of a serialized tree. It looks for esbuild **only** under
  `node_modules/.pnpm/esbuild@*/` of the current repository and takes the highest version (`ast-same.sh:15-16`); if there is
  none it exits 2.
- **`prune-post-commit.sh`** is a `post-commit` git hook (not a Claude hook). After a commit it runs `comment-police.mjs`
  over the committed `.js`/`.jsx`/`.mjs` files and prints "pruning pending" for a saturated one; it never blocks
  (`prune-post-commit.sh:18-22`). `prune-post-commit.sh --install <repo>` copies the script into that repository's hooks
  directory and refuses to overwrite an existing one (`prune-post-commit.sh:8-15`).
  **The installed copy cannot find `comment-police.mjs`**: it looks next to itself (`prune-post-commit.sh:16`). It works
  if `ITDFW_HOOKS_BIN` points to the plugin's `bin/`, or if the hook is a symlink to the script instead of a copy.

## How to verify

```
cd plugins/itdfw-hooks && node --test "test/*.test.mjs"
```

52 cases for `away-notice`, `permission-denied` (with `-ask`), `stopfailure-log` and `prompt-context` (the four lines,
present and away, each context threshold), with fake `tmux`, `fzf` and session
records on the `PATH` and a throwaway config directory: the notice once per turn and silence with a client, a denial
logged and each answer of the popup delivered (approve, no, free text, away, no answer), the error line with its six
fields and the refusals on bad input. The older hooks still have no suite. What was checked by hand on 2026-11-10, each
of them once with sample input in a throwaway `HOME` (so that no real marker files were written):

| Input | Result |
|---|---|
| `mv a b` / `mv -n a b` (`safe-mvcp`) | `deny` JSON / allowed |
| `npm install x` / `pnpm install` (`npm-pnpm`) | `deny` JSON / allowed |
| edit of `/x/tests/a.js` with no skill loaded / after `skill-mark` with `itdfw:itdfw-completeness` (`skill-gate`) | exit 2 / allowed, so the plugin prefix is handled |
| `Agent` with `general-purpose`, `model: fable`, or issued by a subagent (`agent-type-gate`) | exit 2 each; with `base` and `sonnet`, allowed |
| a JS file with three commented-out lines (`comment-police`) | exit 2 with the "COMMENTS" message |
| `rg` over a configured repository, twice (`graph-gate`) | exit 2 the first time, allowed the second; with no repository root, allowed |
| `ast-same.sh pre|check` on a committed file | "committed" and "same tree" |
| `prune-post-commit.sh --install`, then a commit | with the copy and no `ITDFW_HOOKS_BIN`: silent (it cannot find the police); with the variable or a symlink: "pruning pending" |

`commit-completeness-gate.sh` and `search-mark.sh` were read, not run.

Requirements: `bash`, `jq`, Node.js and, for the comment police, the npm package `espree` (11.2.0 on the author's machine)
under `$ITDFW_HOOKS_DEPS/node_modules`. Without `espree`, `comment-police.mjs` fails when it loads
(`comment-police.mjs:12`). The scripts use GNU tools: `stat -c` (`graph-gate.sh:63`), `tac` (`agent-type-gate.sh:59`),
`readlink -f` (`comment-police.sh:3`).

## What depends on ITDFW

| Hook | Depends on |
|---|---|
| `skill-gate`, `commit-completeness-gate` | the names of this marketplace's skills and the framework's folder layout (`mongooseSchema/`, `APP/`, `FWPlugins/`…) |
| `graph-gate`, `search-mark` | the structured search tools being configured (`itdfw-graph`, Serena, a Qdrant search, `inventory`), and the repository layout (`back`, `plugins`, `libs`, `fronts`, `claude-docs` in `graph-gate.sh:37`) |
| `agent-type-gate` | the author's delegation policy (a custom agent named `base`, no Fable, 75 % rule) |
| `comment-police`, `ast-same`, `prune-post-commit` | nothing from the framework: they work on any JavaScript repository |
| `safe-mvcp`, `npm-pnpm` | nothing from the framework; `npm-pnpm` assumes the project uses pnpm |

## Limits

- **They apply to every project where the plugin is enabled.** `safe-mvcp`, `npm-pnpm`, `commit-completeness-gate`,
  `skill-gate` (for paths such as `tests/`, `APP/`, `init.js`, `claude-docs/`) and `agent-type-gate` have no guard that
  the project is an ITDFW one. `graph-gate` does nothing without a repository root.
- **`agent-type-gate` requires an agent named `base`**: its messages tell the model to use one (`agent-type-gate.sh:14`,
  `:37`). The plugin ships it in `user-agents/base.md`, but Claude Code does not install it: it has to be linked into
  `~/.claude/agents/` by hand. Its numbers are the author's: 750,000 tokens (`:60`), and it refuses the model `fable`
  (`:48-53`).
- **The presence hooks need the `itdfw-sessions` scripts and `tmux`.** In Claude Code's plugin cache each plugin is a
  separate copy, so `_sessions.sh` only finds them through `ITDFW_SESSIONS_BIN` or the `PATH` there; the sibling folder
  works only in a checkout of this repository. Whether Claude Code puts a plugin's `bin/` on the `PATH` of a hook was
  not measured. "Away" means no `tmux` client attached, nothing more.
- **`ask-owner.sh` answers in Spanish on stdout** (`no está`, `sin respuesta`, `cola llena`) because the callers on the
  author's machine compare those words.
- **`skill-gate` refers to `itdfw-documentation`**, which is not in this marketplace (`skill-gate.sh:53`). Its default
  `site/src/` pattern matches that folder name in any project (`skill-gate.sh:10`).
- **`ast-same.sh` only finds esbuild in `node_modules/.pnpm`**, so it needs a pnpm repository with esbuild installed. A
  `.js` file that contains JSX fails (it uses the `js` loader), and `.vue` is not supported; both fail closed, never as
  "same tree" (`ast-same.sh:20-22`).
- **`comment-police` only looks at** `.js`, `.jsx`, `.mjs`, `.cjs` (`comment-police.mjs:14`). If `espree` cannot parse the
  file it exits 0 without a word (`comment-police.mjs:71-73`). Its thresholds (15 % of added code, at least 3 lines, blocks
  of at most 2 lines, 10 % and 30 lines for a saturated file) are constants in the script (`:15-19`). Being a `PostToolUse`
  hook, it runs after the edit was applied: its message goes to the model, it does not undo the edit.
- `prune-post-commit.sh` still names itself `poda-post-commit.sh` in its own usage comments
  (`prune-post-commit.sh:4-5`, `:9`).
- The text of `graph-gate.sh` describes Serena as "AST, not text" (`graph-gate.sh:79`). Serena is a client of language
  servers and has no parser of its own.
- The marker files in `$HOME/.claude/state/` are never cleaned up.

## What is not here, and why

The author's machine has more hooks, which are **not** part of this plugin because they are personal or depend on a
setup that cannot travel:

- **`stop-unseen`** made a session go on once when the author was not looking at its screen. It is switched off on that
  machine.
- **The personal part of the prompt hook** (an exercise reminder and the end-of-day ritual) and the **resume and
  post-compaction hooks**, which inject the author's own routines. Their generic parts are `prompt-context.sh`,
  `precompact.sh` and, in `itdfw-sessions`, `hilo-capturar.sh` / `hilo-devolver.sh`.

None of them is needed to understand the rest.
