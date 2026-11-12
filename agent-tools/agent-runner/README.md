# agent-runner

A proof of concept: **Claude Agent SDK jobs ("recipes") behind a small HTTP API**, plus the scripts that measured them and
the results (`RESULTS.md`). A client `POST`s a job, the service queues it, runs it with the Agent SDK in a folder of its own,
and the client reads the state and the output files back (or gets a callback).

The recipes in this repository turn **photos of a printed menu into a `menu.json`**. That task was the vehicle for measuring
three models (Haiku, Sonnet, Opus) and five prompt versions on the same job. The service and its contract do not depend on it:
a recipe is a declaration plus a prompt.

> **Read this before using the numbers.** The reference the results were compared with was another model's transcription of
> the photos, and nobody validated it against the photos. `RESULTS.md` therefore measures **agreement between two readings**,
> not correctness. It is a proof of concept with 3 runs per configuration and one menu.

## At a glance

| | |
|---|---|
| **What it is** | A Node.js HTTP service (`src/server.mjs`, no dependencies of its own), a job runner (`src/run-job.mjs`), recipes (`src/recipes/`), and benchmark / validation scripts. |
| **How a job runs** | `inline` (default): the live service calls the SDK's `query()`; the SDK starts its own `claude` child with the job folder as `cwd`. `spawn`: one fresh `node src/worker.mjs <job folder>` per job, which dies when the job ends. Same contract in both. |
| **How the agent is fenced** | `permissionMode: "dontAsk"`, a short `tools` list, `allowedTools` rules that name the job folder (`Read` anywhere in it, `Edit` only in `out/`), `disallowedTools` for the rest, and `settingSources: []` so no host settings load. The job reads only a **copy** of its photos (`<job>/in/`). |
| **Where data lives** | Everything under `AGENT_RUNNER_STATE` (default `<os tmpdir>/agent-runner`): `jobs/<id>/` (`job.json`, `meta.json`, `in/`, `out/`), `results/` (benchmark output and spend ledger), `claude-config/<id>/`. |
| **What it needs** | Node.js (tested on 26) and `pnpm` to install. The suite needs **no API key and no network**. Real jobs need `ANTHROPIC_API_KEY`. OCR recipes need `tesseract` and ImageMagick (`magick`), both optional. |
| **What it is not** | Not isolated (no container, no separate user), not authenticated, not a queue that survives a restart. See Limits. |

## Install

```sh
pnpm install --ignore-workspace      # this folder is its own package, outside any workspace
```

`@anthropic-ai/claude-agent-sdk` is pinned to `0.3.321`. The SDK does **not** use the `claude` of the host: it runs the native
binary of its optional dependency for your platform (it was checked on Linux x64 through the executable path of the child
process). `CLAUDE_BIN` is only an optional override.

## How to verify it

```sh
pnpm test        # node --test --test-timeout=60000 "test/*.test.js"
```

48 cases (`node:test`), about 3 seconds: 14 in `test/input-dir.test.js`, 13 in `test/http-contract.test.js`, 21 in
`test/validate.test.js`. On 2026-11-12 they gave `tests 48, pass 48, fail 0`.

They start the service on a free port with a temporary state folder (`test/harness.mjs`) and use the `selfTest` recipe, which
sleeps and writes a file, so **no model is called and no key is needed**. What they cover:

| Property | How it is attacked |
|---|---|
| `202` on accept, with `{id, status: "registered"}` | `POST /jobs` with `selfTest`, both runner modes |
| States `registered -> running -> done`, files, cost, callback | poll `GET /jobs/:id`, read `hello.txt` through `/files/`, receive the callback in a local sink |
| The queue never runs more than `MAX_PROCS` at once | `MAX_PROCS=1`, two jobs: the second stays `registered` while `/health` says `running 1, queued 1` |
| Input handling | 415 wrong content type, 400 for non-JSON / body over 64 KB / bad id / unknown or inherited command name / bad params / bad callback URL, 409 repeated id, 404 and 400 for files |
| `inputDir` step | only images are copied (as real files, sorted), the copy is a copy, 20 images and 20 MB pass, 21 images / 20 MB + 1 / unsafe names / relative or `..` paths / not a directory / empty are refused with the reason and leave no job folder |
| OCR is best effort | an image the OCR cannot read does not fail the job and leaves no `.ocr.txt` |
| Validator, comparator, recipes | verdict rules, the known limit of the verdict (see `RESULTS.md`), registry and tool fences of every recipe, the fixtures |

What the tests do **not** show: that a recipe works against the real API. No test calls a model. The `failed` state
reached through a real SDK error is not exercised either. For that, `bench.mjs` (below) spends money.

## Endpoints

| Call | Answer |
|---|---|
| `POST /jobs` `{id, command, params, callbackUrl?}` | `202 {id, status: "registered"}`. `415` not `application/json`; `400` invalid body, id (`[A-Za-z0-9_-]{1,64}`), command (the answer lists the known ones), params or `callbackUrl`; `409` id exists |
| `GET /jobs/:id` | `{id, command, status, error, costUsd, numTurns, timing, callback, files}`. `status` is `registered`, `running`, `done` or `failed` |
| `GET /jobs/:id/files/:name` | a file of the job's `out/` (and `out/captures/`) |
| `GET /health` | `{ok, runner, pid, maxProcs, running, queued}` |

The service listens on `127.0.0.1` by default. When a job ends it POSTs `{id, status, files}` to `callbackUrl` (3 attempts).

## Recipes (`command`)

| Command | What it does | Model |
|---|---|---|
| `selfTest` (`sleepMs`) | no model: sleeps and writes `out/hello.txt`; tests the queue, the watcher and the callback | none |
| `extractMenuImages` (`name`, `inputDir`) | v1 prompt. Reads the photos of a folder (1 to 20 `.jpg/.jpeg/.png/.webp`, up to 20 MB each) and writes `menu.json` + `report.md` | Haiku |
| `extractMenuImagesV2` | v2: reading guide by typographic weight, `source` and `doubt` per dish | Haiku |
| `extractMenuImagesV3` | v2 + OCR text next to each photo + `WebSearch` | Haiku |
| `extractMenuImagesV4` | v3 with the OCR demoted to an alarm | Haiku |
| `extractMenuImagesV5` | v4 with two OCR readings (own size and enlarged), the agent decides how far to trust them | Haiku |
| `extractMenuImagesSonnet`, `extractMenuImagesOpus` | the v1 recipe with another model (Opus also with a 1 USD cap) | Sonnet, Opus |

`inputDir` is an absolute path. Before queueing, the service validates it, copies the images to `<job>/in/` and records
`input: {dir, count, files}` in `meta.json`. The agent cannot list the folder (no `Glob`, no `Bash`): the user message carries
the ordered list.

## Configuration

| Variable | Default | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | needed by real jobs and by `bench.mjs` / `probe-permissions.mjs`; only travels in the child's environment |
| `PORT`, `HOST` | `8080`, `127.0.0.1` | where the service listens |
| `RUNNER` | `inline` | `inline` or `spawn` |
| `MAX_PROCS` | `3` | jobs running at once; `0` accepts jobs but never starts them (the tests use it) |
| `AGENT_RUNNER_STATE` | `<os tmpdir>/agent-runner` | root of all data |
| `JOBS_DIR` | `<state>/jobs` | where job folders live |
| `OCR_LANG` | `eng` | tesseract language for the OCR recipes (the measurements used a Spanish menu with `spa`) |
| `CLAUDE_BIN` | unset | optional path of a `claude` binary instead of the SDK's own |

## Use

```sh
ANTHROPIC_API_KEY=... PORT=18080 node src/server.mjs          # RUNNER=inline (default) | spawn
curl -s localhost:18080/jobs -H 'content-type: application/json' \
  -d '{"id":"demo-1","command":"extractMenuImages","params":{"name":"Sample Cafe","inputDir":"'"$PWD"'/fixtures/menu-in"}}'
curl -s localhost:18080/jobs/demo-1
```

| Script | What it does | Spends money |
|---|---|---|
| `node bench.mjs inline --label x --runs 3` | starts its own service, runs the recipe `--runs` times (default recipe `extractMenuImages`, default input the fixture), validates each run, samples memory and CPU from `/proc` (Linux only), keeps a spend ledger and stops at `--cap` USD (default 2) | yes |
| `node validate.mjs <job>/out [reference.json]` | verdict and numbers of one run against a reference (default `fixtures/menu-reference.json`) | no |
| `node compare-menu.mjs <job>/out [reference.json]` | the exact lists: missing and extra products, price and text differences | no |
| `node probe-permissions.mjs` | asks the agent to try allowed and forbidden actions and prints what the SDK denied | about 0.01 USD |

## Fixtures

`fixtures/menu-in/menu-1.png` is an **invented** printed menu ("Sample Cafe": 3 sections, 12 items, one dish with two
portions, one dish printed with a deliberate misprint), and `fixtures/menu-reference.json` is its answer, written by hand.
No real business, photo or price list is involved. `bash fixtures/make-menu.sh` regenerates the image (needs ImageMagick and
the DejaVu fonts). The measurements in `RESULTS.md` were made on a different, real printed menu that is not published here.

## Limits

- **Left out of this repository:** (1) the part that drove this service from tools of a private application framework (an
  integration test and the two tool definitions): it depends on that framework, which is not in this repository.
  (2) The recipes that read a **public website** instead of photos (plain fetch, and a headless browser through a Playwright MCP
  server with theme extraction and screenshots), their probes and result tables: their evidence is about third-party sites
  and they need a local Chrome. (3) A probe that asked Haiku to rewrite dish descriptions: it read the real menu's reference.
  `RESULTS.md` keeps the findings of all three at the level they can be told without the data.
- **No isolation.** No container, no separate user, one shared API key for all jobs. The `allowedTools` rules fence the SDK's
  tools, not the process. `callbackUrl` accepts any `http(s)` URL, loopback included. There is no shared secret on the service.
- **State is not durable.** The queue is in memory; a restart forgets the queue (finished jobs stay on disk and `GET` finds them).
  Callbacks are retried 3 times. Job folders are never cleaned.
- **Photo checks are shallow.** The extension decides what is an image (no magic-byte check), and a file can change between the
  scan and the copy.
- **`bench.mjs` reads `/proc`:** it runs on Linux only. The cost it reports is the SDK's `total_cost_usd`, a client-side estimate.
- **The SDK and the binary change fast.** Everything was measured with SDK `0.3.321`; the model ids in the recipes are the ones
  used at that time.
- **The results are a proof of concept**, not a benchmark: see `RESULTS.md` for what 3 runs on one menu can and cannot say.
