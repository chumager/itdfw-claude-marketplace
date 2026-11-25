# Tests are really deleted; what was built stays in view for the owner

| | Automatic tests | Showcase (`vitrina`) |
|---|---|---|
| What for | certify the contract | so the owner SEES what was built (treatments, validations, visual edges) |
| Cycle | I bring up, seed, test and delete through the API. The mode is decided by the model: a real model stays with soft delete; a **test-only model declares `deleteMode: "hard"`**; a **test-only collection is dropped entirely** (`drop`) when done | it stays operating, with sample data that is not deleted |
| Where | the corresponding site; a small plugin in the `http` sink (mounted, tested and taken out) | the consumer's site or the module's bench (like `/t-test`) |

- 🔴 **Temporary files are deleted too.** The machine never reboots, so `/tmp` never empties by itself, and when it
  fills every session's tests fall over at once. A test creates its scratch with `mkdtemp` and removes it in its
  `after`/`finally`, also when it fails. A session's own scratch (probes, captures, dumps, worktrees) goes to
  `$CLAUDE_JOB_DIR/tmp`, never to bare `/tmp`, and whoever creates a worktree removes it when done.
- A site exists so the owner can see something; a closed flow of tests does not justify a site of its own.
- Every closing report carries the showcase URL and what to look at there.

Complements `un-site-por-concepto-de-prueba`, `base-de-pruebas-comun` and `fixtures-rotos-se-apagan`.
