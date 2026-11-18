# A comment prune is verified by TREE, with the work already committed

Pruning comments cannot change the code, and what bites (a `return` outside its scope, a line that goes away with the comment) is seen neither by a text diff nor by a green suite.

```
~/bin/ast-same.sh pre   <files…>   # before: each file committed (HEAD = the real "before")
~/bin/ast-same.sh check <files…>   # after: the HEAD tree and the working tree must be equal
```

- `pre` first: with uncommitted work, HEAD is not the "before". It is committed and only then pruned.
- `check` compares both sides reprinted with esbuild `--minify-whitespace`. Any difference is a code change.
- A prune's brief carries the two commands.
- **On the spot**: the hook `~/bin/poda-post-commit.sh` (install with `--install <repo>`) writes `🧹 poda pendiente: <file>` (prune pending) on commit. On seeing it: a `base` subagent with `pre` → prune → `check`; the manager reads the `check` and commits the prune separately.
