# itdfw-graph — semantic search over a code knowledge graph

An MCP server (stdio) that lets an agent ask *"which piece of the framework already solves this?"* before it writes
code. It does the search over the knowledge graph that **graphify** produces for the repository, using embeddings and
a vector database. Package: `@chumager/itdfw-graph-rag` (`package.json:2`), private and unlicensed
(`package.json:27-28`).

> **What it is not.** It does **not** read or parse code, and it is **not** an AST tool. The only file it indexes from is
> graphify's `graph.json` (`src/index.js:135-141`), and it embeds only the **label** of each graph node, not the body
> of any file (`src/index.js:157`). The AST work (tree-sitter) is done by graphify, a third-party tool, before this
> piece runs. It also does not answer questions: it returns a score, a label and a file path
> (`src/mcp.js:227`), and the agent reads the file afterwards.

Line numbers are relative to this directory and were checked against the code on 2026-11-11 (the last commit
that changed this package is `a737ec0e`).

## Why it exists

An agent that does not know the framework re-implements what already exists. "The framework probably has it" does not
say *where* or *what it is called*: nobody deduces that a multi-worker broadcast lives in `libs/sse` on top of
`mongoose-pubsub`. A plain text search finds the words you type; this finds the concept you did not know the name of,
as long as you name the capability with technical terms (see below).

## Files

| File | Lines | Role |
|---|---|---|
| `src/mcp.js` | 241 | the MCP server, bin `itdfw-graph-rag` (`package.json:13`) |
| `src/index.js` | 187 | configuration from the environment, Ollama, Qdrant over `fetch`, status, reindex, find |
| `src/gaps.js` | 131 | an optional log of searches that found nothing, in SQLite |
| `src/reindex.js` | 15 | command line, bin `itdfw-graph-rag-index` |
| `test/` | 4 test files + a helper | 13 cases, see "How to verify it" |
| `.index-meta.json` | generated | the state of one index, written **next to the graph** it was built from (`src/index.js:26`); ignored by git (`.gitignore:1`) |

Dependencies: `@modelcontextprotocol/sdk` and `ollama` (`package.json:23-26`). Qdrant is spoken to with the built-in
`fetch`, without a client. The gaps log uses `node:sqlite`, which is loaded only when the log is used
(`src/gaps.js:20`); `package.json` declares no `engines`.

## What it exposes

Four tools always, three more when the gaps log is turned on (`src/mcp.js:84-129`):

| Tool | What it does |
|---|---|
| `find` | takes `query` and an optional `limit` (default 8); checks status, embeds the query and searches by cosine similarity; each line is `score  [SCOPE] label → file`; warns when the index is older than the graph (`src/mcp.js:202-228`) |
| `reindex` | empties the collection and rebuilds it from the graph; answers with the number of concepts and the graph's commit (`src/mcp.js:158-163`) |
| `status` | Ollama (and the model), Qdrant, the collection and its point count, the dates of the graph and of the last indexing, and whether the index is outdated (`src/mcp.js:134-148`) |
| `start` | starts Qdrant, only when `QDRANT_START_CMD` is set (it runs that string through a shell and waits up to 15 s, `src/index.js:54-68`) |
| `reportGap` | records something the agent needed and the index did not return. **Only with `GAPS_DB`** |
| `gaps` | lists the open gaps (or all of them), most repeated first. **Only with `GAPS_DB`** |
| `closeGap` | marks a gap resolved, or discarded with `discard`. **Only with `GAPS_DB`** |

The three gap tools are opt-in: they are listed only when `GAPS_DB` is set (`src/mcp.js:84-111`) and any call to them is
refused otherwise (`src/mcp.js:233`). The SQLite file is opened on the first use of one of them, never at start
(`src/gaps.js:9`, `src/gaps.js:17-21`).

`find` labels each result with a scope taken from the folder prefix of the file: `[BACK]` `back/`, `[FRONT]`
`fronts/`, `[LIB]` `libs/`, `[PLUG]` `plugins/`, `[LEGACY]` for `claude-context/`, `docs/` and `.bak`/`.old`/`.backup`
files, and `[DOC]` for everything else (`src/mcp.js:210-222`). That mapping is wired to the folder layout of an ITDFW repository.

From a shell, without MCP: `node src/reindex.js [path/to/graph.json]` (`src/reindex.js:2`, `:5`). It prints the number
of nodes indexed (`src/reindex.js:11`, `:15`).

## How it works

1. **Source.** It reads the graph file: the argument of `reindex`, else `GRAPH_JSON` (default
   `graphify-out/graph.json`, `src/index.js:6`, `src/index.js:150`), parses the whole file and keeps the nodes whose
   `file_type` is `concept` or `rationale` and that have a label (`src/index.js:17`, `src/index.js:135-141`). The other
   node types graphify emits (code, documents, images, papers) are **not** indexed. On 2026-11-10 that was 18,255 of the
   48,100 nodes of the graph of this repository (the `count` in `graphify-out/.index-meta.json`, and a count of the graph
   file; one snapshot, not a property of the code).
2. **Embeddings.** The model `nomic-embed-text`, 768 dimensions (`src/index.js:9-10`), called through the `ollama`
   library against a local Ollama (`src/index.js:32`). The model needs its prefixes: `search_document:` for stored
   labels and `search_query:` for queries (`src/index.js:29-30`). The Ollama host is not configurable in this code; it
   is the library's default, `127.0.0.1:11434` (`src/index.js:76`).
3. **Vector database.** Qdrant over REST, default `http://localhost:6343`, collection `graph`, cosine distance
   (`src/index.js:7-8`, `src/index.js:154`). Every call, including the one that empties the collection, carries the
   `api-key` header when `QDRANT_API_KEY` is set (`src/index.js:34-37`, `src/index.js:153`). Ids are the positions in
   the filtered array (`src/index.js:160`); the payload keeps label, file, type and community (`src/index.js:162`).
4. **Reindexing is not incremental, on purpose.** It deletes the collection and rebuilds it in batches of 64
   (`src/index.js:150-177`). graphify regenerates the graph from scratch and can change its structure between runs; an
   incremental index would accumulate concepts that no longer exist. The state of the index (`indexedAt`, the graph's
   modification time, the commit, the count) is written to a `.index-meta.json` **next to the graph that was indexed**
   (`src/index.js:20-26`, `src/index.js:167-175`), so that two graphs never share one file. `status` compares the graph
   file's modification time with the saved one and warns when they differ (`src/index.js:122-128`).
5. **Gaps (optional).** When a search does not give the agent what it needed, it can record the need in plain words. A
   second report with exactly the same `need` text adds a repetition and reopens the gap (`src/gaps.js:50-66`); any
   change of wording creates a new gap, so there is no semantic de-duplication. The log is meant to be read before
   updating graphify, so that the next documentation pass covers the vocabulary the index could not find.

### How to query: technical terms, not prose

The tool's own description gives three levels, which its author measured and which were not reproduced here
(`src/mcp.js:16-28`): prose ("I need two processes not to do the same thing at once") returns noise; technical words
padded with filler also fail; the real names of classes, methods and modules, without filler, work (for example a hub
class name plus `broadcast pubsub`, or `mutex lock semaphore mutual exclusion`).

The index is semantic but does not translate a problem into its solution: you have to name the capability. A general
embedding model knows that "dog" and "puppy" go together, not that "mutex" solves "two processes at once". The caller
is an LLM, and the LLM does know the term; so the leap is made by the query, not by the index.

## Configuration

| Variable | Default | Note |
|---|---|---|
| `GRAPH_JSON` | `graphify-out/graph.json` | graphify's output; `reindex` also takes the path as an argument |
| `QDRANT_URL` | `http://localhost:6343` | |
| `QDRANT_API_KEY` | — | sent as an `api-key` header on every Qdrant call (`src/index.js:34-37`) |
| `COLLECTION` | `graph` | `src/index.js:8` |
| `EMBEDDING_MODEL` / `EMBEDDING_SIZE` | `nomic-embed-text` / `768` | the size must match the model |
| `NODE_TYPES` | `concept,rationale` | the author found that indexing `document` and `code` nodes added noise (a measurement that was not reproduced here) |
| `QDRANT_START_CMD` | — | its presence means "Qdrant is local and this can start it"; its absence means "remote" |
| `GAPS_DB` | — | path of the SQLite file of the gaps log. Without it the log and its three tools do not exist (`src/gaps.js:9`). A relative path resolves against the directory the client starts the server in (the project), so the log stays with the project and not with this package: `graphify-out/.gaps.db` keeps it next to the graph |

Example client entry (placeholders in angle brackets):

```jsonc
"itdfw-graph": {
  "type": "stdio",
  "command": "node",
  "args": ["<this-repository>/agent-tools/graph-rag/src/mcp.js"],
  "env": {"GRAPH_JSON": "<your-repo>/graphify-out/graph.json", "QDRANT_URL": "http://localhost:6343"}
}
```

Run `pnpm install --ignore-workspace` once inside `agent-tools/graph-rag/` so that its two dependencies are present. The
graph is read relative to the working directory of the client unless `GRAPH_JSON` is absolute.

## What graphify is (third party)

graphify is a separate package, `graphifyy` on PyPI (Apache-2.0), repository `github.com/Graphify-Labs/graphify`
(package metadata, version 0.9.62 installed). It turns a folder of code, documents, papers and images into a graph
with communities (`graph.json`, `graph.html`, a report). For source code it extracts structure with tree-sitter and no
LLM; for documents and images it uses a model (graphify's own skill text). Using it is documented in its skill; nothing
of graphify is part of this repository. Be careful with the label "AST": in the graph this piece reads, a node coming
from code and a node coming from a document sit side by side, and only `file_type: code` nodes are tree-sitter output.

## How to verify it

```sh
pnpm install --ignore-workspace   # once
pnpm test                         # node --test "test/*.test.js"
```

13 cases in four files, run on 2026-11-11: `tests 13, pass 13, fail 0`. They need no Ollama and no real Qdrant: they start
the server as a child process and use a local listener that answers like the vector database and records what it
receives (`test/lib.js:10-28`).

| File | Cases | What it proves |
|---|---|---|
| `test/gaps.test.js` | 4 | without `GAPS_DB` the server lists only the four core tools, refuses the gap tools and touches nothing on start; with it, the three tools appear, the database file is created on the first use and not before, and a gap is recorded, reopened by a repeat and closed |
| `test/reindex.test.js` | 5 | the graph to index can be given as an argument, to `reindex()` or by `GRAPH_JSON`, and the index state is written next to that graph; the call that empties the collection carries the `api-key` header; the command line prints the node count, not an object |
| `test/neutral.test.js` | 4 (one per source file) | no file in `src/` names a customer, a deployment model, an internal role or a numbered internal finding |

The graphs used by the reindex tests hold no node of an indexed type, so nothing is embedded. **The embedding path and
`find` against a real index are not covered**, nor `status` against real services or `start`.

## What depends on ITDFW

It does not import anything from the framework (`src/index.js:1-3`, `src/mcp.js:2-8`). The search over a graphify
`graph.json` works for any repository that has one. What is specific to ITDFW:

- the text of the `find` description, which the LLM reads, names the framework and its `libs/sse` and `$sse`
  (`src/mcp.js:12`, `src/mcp.js:33`);
- the `[BACK]/[FRONT]/[LIB]/[PLUG]/[LEGACY]` scopes (`src/mcp.js:210-222`);
- the gaps workflow (document, update graphify, close) is shaped around a daily close routine of this project
  (`src/mcp.js:68-72`).

## Limits

- The stack is fixed: Ollama with `nomic-embed-text`, Qdrant, graphify. "Today there is one consumer"; an adapter per
  provider is not written.
- It does not translate prose into a solution (see above) and it does not index code, documents or images.
- Ollama's host cannot be set from the environment (`src/index.js:76`).
- `find` stores type and community in each point (`src/index.js:162`) but offers no filter on them, and `limit` has no
  upper bound (`src/mcp.js:205`).
- The server announces its own version `0.1.0` by hand (`src/mcp.js:76`), duplicated from `package.json:3`.
- The graph's node ids are not stored in the index, so a result can lead back to a file but not to the node.
- `package.json` declares no `engines`; the gaps log needs a Node that has `node:sqlite`.
