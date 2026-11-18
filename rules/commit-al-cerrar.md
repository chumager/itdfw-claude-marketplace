# Commit when each TESTED thing closes

When something is tested (the slice, the fix, the green test), it is committed at that moment. The commit depends on what was tested; the bump, on the published version (`bump-al-arreglar`).

- If it touched a publishable, first: `~/bin/itdfw-deps.sh files <package-dir>` has to come out clean (the veto lives in the script).
- If the fix closes a finding, it is closed in the same commit (`fix-cierra-su-hallazgo`).
- Message in English, `type(scope): what`: detailed if behavior changed; short if mechanical.

| Who | What they commit |
|---|---|
| each session that owns a module (Contabilidad → `plugins/accounting`, ALM → `plugins/alm`, `core` → the core…) | their own module and nothing from another; if it crosses modules, each owner their part |
| subagents (forks, implementer, base) | nothing: the session that launched them reviews and commits |
| push to `develop` | automatic on every commit, after the secrets scan (set up and maintained by the `CTO`). If the scan stops it, the commit is fixed before it goes out |
| push to `main` and tags | only in a release: decided by the `CTO`, with the owner's GO |
