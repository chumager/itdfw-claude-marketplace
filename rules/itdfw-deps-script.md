# FW deps in a deploy: NEVER by hand — there is `~/bin/itdfw-deps.sh`

To move a deploy's `@<scope>/*` dependencies (the framework's npm scope) between a link to the monorepo and a published version, or to know which module is missing a bump:

```
~/bin/itdfw-deps.sh            # no arguments = help + state
```

Verbs: `check` · `to-link` · `to-version` · `guard` · `drift` · `files` · `publish`. Dry-run by default; `--apply` edits the `package.json` files and runs `pnpm install`.

- **LINK**: the deploy sees the FW's changes at once, without publishing. Development mode.
- **VERSION**: points to the registry; the only publishable mode.

Flow: `to-link` → develop and test → `drift` → bump → `to-version` → `guard` → `publish` → deploy.

## Red flag
Editing a `package.json` by hand to go from `^7.x.x` to `link:`, or looking up a plugin's path → STOP: it is `to-link`.
