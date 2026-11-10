#!/usr/bin/env bash
# Comment pruning verified by syntax tree (a git helper, not a Claude hook).
#   ast-same.sh pre   <files...>   before pruning: every file must be committed (HEAD = the real "before")
#   ast-same.sh check <files...>   after pruning: the tree of HEAD and the one of the working copy must be equal
# The tree is compared by reprinting it with esbuild --minify-whitespace: it parses, drops comments and whitespace,
# and neither renames nor simplifies. A return moved out of its scope or a lost line changes the output; a comment does not.
# Run from the repository root (it uses the highest esbuild installed under node_modules/.pnpm).
set -uo pipefail

mode=${1:-}; shift || true
[ -z "$mode" ] || [ $# -eq 0 ] && { echo "usage: ast-same.sh pre|check <files...>"; exit 2; }

# the binary directly: `pnpm exec esbuild` does not exist at the root and its error, identical on both sides, read as "same tree".
# Several versions can coexist: sort -V picks the highest one explicitly (plain ls order is lexicographic: 0.9 would beat 0.27).
ESBUILD=$(ls -d "$(git rev-parse --show-toplevel)"/node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild 2>/dev/null | sort -V | tail -1)
[ -x "$ESBUILD" ] || { echo "✗ esbuild not found in node_modules/.pnpm"; exit 2; }

print() { # stdin = the code, $2 = name (for the loader); fails if esbuild does not parse or prints nothing
  local loader=js out
  case "$2" in *.jsx) loader=jsx ;; *.ts) loader=ts ;; *.tsx) loader=tsx ;; esac
  out=$("$ESBUILD" --minify-whitespace --loader="$loader" --log-level=error) || return 1
  [ -n "$out" ] || return 1
  printf '%s' "$out"
}

fail=0
for f in "$@"; do
  case "$mode" in
    pre)
      if ! git diff --quiet HEAD -- "$f"; then echo "✗ $f has uncommitted changes: commit the work before pruning"; fail=1
      else echo "✓ $f committed"; fi ;;
    check)
      before=$(git show "HEAD:$f" 2>/dev/null | print - "$f") || { echo "✗ $f: HEAD does not parse or does not exist"; fail=1; continue; }
      after=$(print - "$f" < "$f") || { echo "✗ $f: the working copy does not parse"; fail=1; continue; }
      if [ "$before" == "$after" ]; then echo "✓ $f same tree"
      else echo "✗ $f the tree changed:"; diff <(echo "$before" | tr ';' '\n') <(echo "$after" | tr ';' '\n') | head -20; fail=1; fi ;;
    *) echo "unknown mode: $mode"; exit 2 ;;
  esac
done
exit $fail
