# `files` in package.json — whitelist, NOT `.npmignore`

Every new package (plugin, lib, front) declares `files` in its `package.json` at birth, before publishing:

```json
{"files": ["src/", "index.js", "plugin.js", "schemas/", "README.md"]}
```

`.npmignore` is a blacklist: every new file gets in by default. `files` publishes what is declared and nothing else.

## 🔴 The whitelist is verified in every commit that touches a publishable
```sh
~/bin/itdfw-deps.sh files <package-dir>    # pnpm pack --dry-run + the script's veto list
```
- The veto list lives in the script (TDD, `.bak/.old/.orig`, images, `_retired/`…), not in each head. It is also stage 4/5 of `itdfw-deps.sh publish`.
- `TDD.md` goes in git, outside the tarball. `TDD.html` goes neither in git nor in the tarball (`**/TDD*.html` in `.gitignore`).
- What the script does not see: that everything the package imports is inside. It is cross-checked by hand when adding a folder.

## Red flag
A package without `files` publishes the whole directory.

Sibling: `commit-al-cerrar`.
