#!/usr/bin/env bash
# post-commit hook of this repository: every commit on main is tested and, if every suite passes, scanned and pushed.
#
#   The commit returns at once. In the background: scripts/test-all.sh; if it passes, agent-tools/secret-scan/
#   push-develop.sh with PUSH_DEVELOP_BRANCH=main (it scans origin/main..HEAD and refuses to push a leaking commit).
#   A failed run leaves its reason in $CACHE/pending, and the next commit prints it.
#
# Install: ln -s ../../scripts/post-commit.sh .git/hooks/post-commit
# State: ${MARKETPLACE_PUSH_CACHE:-~/.cache/marketplace-push}/{last.log,pending}
set -u

root="$(git rev-parse --show-toplevel)"
cache="${MARKETPLACE_PUSH_CACHE:-$HOME/.cache/marketplace-push}"
mkdir -p "$cache"

[ "$(git -C "$root" symbolic-ref --short HEAD 2>/dev/null)" = main ] || exit 0
[ -s "$cache/pending" ] && { echo "⚠️  marketplace: the last automatic push did not go through:"; cat "$cache/pending"; }

setsid bash -c '
  root="$1"; cache="$2"; sha="$3"
  {
    echo "== $(date -Is) $sha"
    if ! "$root/scripts/test-all.sh"; then
      echo "$(date -Is) $sha: a suite failed, not pushed (see $cache/last.log)" > "$cache/pending"; exit 0
    fi
    : > "$cache/pending"
    (cd "$root" && PUSH_DEVELOP_BRANCH=main PUSH_DEVELOP_CACHE="$cache/push" agent-tools/secret-scan/push-develop.sh)
    # push-develop.sh always exits 0; what it could not push stays in its own pending file
    [ -s "$cache/push/pending" ] && cp "$cache/push/pending" "$cache/pending"
  } > "$cache/last.log" 2>&1
' _ "$root" "$cache" "$(git -C "$root" rev-parse --short HEAD)" </dev/null >/dev/null 2>&1 &
exit 0
