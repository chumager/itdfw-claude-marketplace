# Commit when each TESTED thing closes

When something is tested (the slice, the fix, the green test), it is committed at that moment. The commit depends on what was tested; the bump, on the published version (`bump-al-arreglar`).

- If it touched a publishable, first: `~/bin/itdfw-deps.sh files <package-dir>` has to come out clean (the veto lives in the script).
- If the fix closes a finding, it is closed in the same commit (`fix-cierra-su-hallazgo`).
- Message in English, `type(scope): what`: detailed if behavior changed; short if mechanical.
- 🔴 **The `Claude-Session:` trailer carries the session's NAME** (`Claude-Session: CTO`, `Claude-Session: Degustacion`),
  never the claude.ai URL the harness suggests: the name says who committed without opening anything. The
  `Co-Authored-By` line stays as the harness gives it.

| Who | What they commit |
|---|---|
| each session that owns a module (Contabilidad → `plugins/accounting`, ALM → `plugins/alm`, `core` → the core…) | their own module and nothing from another; if it crosses modules, each owner their part |
| subagents (forks, implementer, base) | nothing: the session that launched them reviews and commits |
| push to `develop` | automatic on every commit, after the secrets scan (set up and maintained by the `CTO`). If the scan stops it, the commit is fixed before it goes out |
| the scan stops the push | 🔴 **a false positive** (a fixture password built per run, a sample key): the `CTO` reviews it and adds its fingerprint to the ignore file; new fixture lines carry `// scan-ok`. **A real secret**: it is rotated first, and only the `CTO` rewrites the unpublished stretch, checking that every other session's commit keeps its content. 🔴 **No session rewrites commits of other sessions** on a shared branch, not even with plumbing and an identical tree: what is not a secret is fixed with a new commit on top |
| push to `main` and tags (monorepo) | only in a release: decided by the `CTO`, with the owner's GO |
| push to `main` of the marketplace | automatic on every commit, once every suite passes and the scan is clean (`scripts/post-commit.sh`). A failure is printed on the next commit and fixed before anything else |
