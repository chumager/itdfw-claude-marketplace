# inventory — who extends whom, and who uses a component

A small MCP server (stdio) and CLI that answer questions about the **component tree of a front**: which components
extend or mix in which, which layer each one lives in, who declares or renders it, and which components nobody uses.
It exists so that an agent (or a person) about to change a component can ask for its *regression list* — the
descendants and callers that the change can break — and the tests that guard it (`TDD.md`).

> **What it is not.** It does **not** parse code into an AST. It is regular expressions over file text, keyed by the
> file's base name (`scan.mjs:23-25` imports only `node:fs`, `node:path` and `node:url`; the matches are `RegExp`, e.g.
> `scan.mjs:216-217`). It is also not read-only: every query re-scans the disk and rewrites `inventory.json`
> (`scan.mjs:307`). For real AST work see the table in the repository root README.

Line numbers below are relative to this directory and were checked against the code on 2026-11-11. If the code moved
since, trust the code.

## It needs a config of its own project

The tool knows no project. Each project brings an `inventory.config.json`, and **the folder that holds it is the root**:
every relative path in the config resolves against that folder, every path in the output is relative to it, and
`inventory.json` is written next to it.

| How it is found | Detail |
|---|---|
| default | `inventory.config.json` in the **current directory** of the process (for the MCP, the directory the client starts it in) |
| `INVENTORY_CONFIG` | a path to the config file; wins over the current directory |
| missing | the tool stops: `inventory.config.json not found in <cwd>` (or `<path> not found`), exit code 1, nothing written (`scan.mjs:37-41`). There is no built-in default |

Registering the server in an MCP client:

```jsonc
"inventory": {
  "type": "stdio",
  "command": "node",
  "args": ["<this-repository>/agent-tools/inventory/mcp.mjs"],
  "env": {"INVENTORY_CONFIG": "<your-project>/inventory.config.json"}   // or start the client inside <your-project>
}
```

### The config

| Key | Required | Meaning |
|---|---|---|
| `frontDirs` | yes | directories whose `.jsx`/`.js`/`.vue` files are the components; globs with **one** `*` per level (`"libs/*/src"`, `"plugins/*/vue*"`) |
| `callerDirs` | no | where the back declares components: `[{"layer": "back", "path": "server/src"}, {"layer": "plugin:*", "path": "plugins/*"}]`; a `*` in `path` expands to directories and, inside `layer`, to the name found |
| `projectDirs`, `projectFrontSubdirs`, `projectScanSubdirs` | no | roots of external projects (absolute, or relative to the config folder): each of their sub-folders is an "app"; `projectFrontSubdirs` give **components**, `projectScanSubdirs` give **callers** |
| `skip` | yes | a regular expression of paths to leave out |
| `rules.front` | yes | `extends`, `mixins`, `imports` (regexes with the name in group 1 and the path in group 2) and `render` (function names that resolve a component by a string literal) |
| `rules.back.keys` | yes | the keys whose string value names a component (`component`, `type`, ...) |
| `rules.variants` | yes | `stripPrefix` and `forms` (`pascal`, `camel`, `kebab`): the spellings tried for each name |

A small complete example is `test/fixture/inventory.config.json`.

## Files

| File | Role |
|---|---|
| `mcp.mjs` | MCP server over stdio, hand-written JSON-RPC, no MCP SDK |
| `scan.mjs` | the scanner and a CLI; also importable (exports `loadConfig` and `specsOf`) |
| `package.json` | scripts and the `files` whitelist; no dependencies |
| `TDD.md` | the design notes: components declare their specs; the project brings its own config |
| `test/*.test.js`, `test/fixture/` | 17 tests and the small project they scan |
| `inventory.json` | generated next to the config of the project; rebuilt on every query. **Not source** |

## What it exposes

Six tools (`mcp.mjs:36-70`). All of them also take an optional `jq` string, applied to the result with the `jq`
binary (`mcp.mjs:23-31`).

| Tool | Input | Returns |
|---|---|---|
| `affected` | `slot` | `touching`, `variants`, `instances` (one per layer), `descendants`, `callers`, `specsBySlot` |
| `branch` | `slot` | the ancestors, the node and its descendants, `specsBySlot` |
| `callers` | `slot` | where the component is declared and where it is rendered |
| `hasCaller` | `slot` | `{hasCaller, where}` |
| `orphans` | — | components with no children, no declared use and no render use. A contract flag, **not** a delete list |
| `summary` | — | counts, the scanned directories and the caller directories |

The same queries run from a shell, from the project folder: `node <path>/scan.mjs [affected|branch|callers|hascaller
<slot>] [orphans]` (no argument = summary). They also rewrite `inventory.json`; `--help` does not (`scan.mjs:291-296`).

The server speaks only `initialize`, `notifications/initialized`, `tools/list` and `tools/call`; any other request gets
error `-32601` (`mcp.mjs:114`). No resources, no prompts. A failing scan (for example a missing config) comes back as a
tool result with `isError: true` and the scanner's own message (`mcp.mjs:16-22`).

## How it works

Everything is text matching, in these steps:

1. **Identity is the file's base name** without its extension (`scan.mjs:191`). Frameworks that resolve a component by
   name across layers (a "cascade slot") make the same base name in several layers one node with several `instances`.
2. **What counts as a component.** A `.jsx`, `.js` or `.vue` file under the front directories that contains
   `name: "..."` or an `extends:` (`scan.mjs:189-190`).
3. **Inheritance.** The first `extends: X` per file, with `X` resolved to a file name through the `imports` rules of
   the config. Mixins come from the `mixins` rule and are registered as children with a ` (mixin)` suffix
   (`scan.mjs:252-253`).
4. **Specs.** `/@spec\s+(\S+)/g` over the whole file (`scan.mjs:48`). The scanner does not check that the path exists.
5. **Callers.** For each slot it builds one regex for the *declared* use — one of the `rules.back.keys` whose string
   value is the slot name — and one for the *render* use, a call to one of the `rules.front.render` functions with the
   name as a literal (`scan.mjs:216-217`). The name is tried in variants (`rules.variants`). Declared uses are searched
   in `callerDirs` and the external projects; render uses in the front directories.
6. **Cost.** One regex test per slot per file, so O(files x slots).

Dependencies: Node.js and, only for the `jq` parameter, the `jq` binary. No npm packages.

## How to verify it

```sh
cd agent-tools/inventory
pnpm test          # node --test "test/*.test.js"
```

17 tests, no network, database or running service. Every case that scans works on a temporary copy of
`test/fixture/`, so nothing is written into the repository:

- config lookup: missing config, `INVENTORY_CONFIG` pointing elsewhere or at nothing, `--help` with no config and no
  file written (`test/scan.test.js`, `test/help.test.js`);
- the scan of the fixture: summary and layers, `affected`, `callers` (declared through the un-prefixed variant, render
  through `localImport`), `branch`, `orphans`;
- the MCP over a real stdio pipe: `initialize`, `tools/list`, a tool call, the `jq` filter and the error without a
  config (`test/mcp.test.js`);
- `specsOf` (`test/specs.test.js`).

**What this does not cover:** `mixins`, `projectDirs`, glob forms other than the two used by the fixture, a slot whose
instances have different parents, and any real project's size.

## What depends on a particular framework

The skeleton is generic: a directory walker, regexes taken from the config, a minimal MCP server and the `jq`
pass-through. What is shaped by the component idiom it was written for (the ITDFW front) is in the **rules** a project
puts in its config: "identity is the base name" (the cascade slot), `localImport`/`resolveTag`/`resolveComp` as render
calls, an `Itd` prefix, and the keys `component|type|filterComponent|subComponent`. A project with another idiom can
change the rules, but not the identity rule (base name) or the fact that only text is matched.

## Limits

- It is not an AST. It does not resolve computed `extends`, aliases, re-exports or spreads, and it does not tell code
  from comments or strings: a `@spec` or `component: "X"` inside a comment counts.
- It finds **declarations** of the form `key: "Name"` and **render calls with a string literal**. Dynamic uses are
  invisible. With a prefix to strip, the un-prefixed variant of a name (for example `select`) means `type: "select"` in
  any scanned file counts as a caller; false positives were deduced from the code and not measured.
- It keeps the first `extends` per file and follows the first instance with an `extends` (`scan.mjs:272`); a slot with
  several instances whose parents differ loses information.
- The glob is a home-made one that accepts a single `*` per directory level.
- Unreadable directories and files are skipped silently.
- Each call writes `inventory.json`, so the server is not stateless.
- Counts such as "144 components" are the result of one scan of one machine, not a property of a repository.
