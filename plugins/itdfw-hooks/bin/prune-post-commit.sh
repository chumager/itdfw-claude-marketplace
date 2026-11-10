#!/usr/bin/env bash
# post-commit git hook (not a Claude hook): runs the comment police over the .js/.jsx/.mjs files of the commit; if one is
# saturated with comments it says so in the commit output. Does not block: the commit is already done.
#   prune-post-commit.sh                    run it from post-commit (a copy of this file, or a symlink to it)
#   prune-post-commit.sh --install <repo>   copies itself as the post-commit hook of that repo (never overwrites an existing one)
# comment-police.mjs is looked up next to this file (symlinks resolved), or in ITDFW_HOOKS_BIN when set: with an
# installed COPY, set ITDFW_HOOKS_BIN to the plugin's bin directory.
if [ "${1:-}" = "--install" ]; then
  repo=${2:?usage: prune-post-commit.sh --install <path-to-repo>}
  hooks=$(git -C "$repo" rev-parse --git-common-dir)/hooks
  case "$hooks" in /*) ;; *) hooks="$repo/$hooks" ;; esac
  [ -e "$hooks/post-commit" ] && { echo "✗ $hooks/post-commit already exists: not overwriting it"; exit 1; }
  cp -n "$0" "$hooks/post-commit" && chmod +x "$hooks/post-commit" && echo "✓ installed in $hooks/post-commit"
  exit
fi
police="${ITDFW_HOOKS_BIN:-$(dirname "$(readlink -f "$0")")}/comment-police.mjs"
root=$(git rev-parse --show-toplevel)
git diff-tree --no-commit-id --name-only -r --diff-filter=AM HEAD | grep -E '\.(m?js|jsx)$' | while read -r f; do
  [ -f "$root/$f" ] || continue
  printf '{"tool_input":{"file_path":"%s"}}' "$root/$f" | node "$police" 2>&1 >/dev/null |
    grep -q "SATURATED" && echo "🧹 pruning pending (comment-saturated): $f"
done
exit 0
