#!/usr/bin/env bash
# push-develop.sh: automatic push to origin/develop after every commit (the repository's post-commit hook calls it).
#
#   Synchronous part (when the commit ends): prints what is pending from earlier commits, scans origin/develop..HEAD
#   with secret-scan.sh and, if something blocks, does not push.
#   Background part (setsid): under flock, pushes the scanned commit; if the remote moved ahead, it rebases by itself
#   with a clean tree and no predicted conflicts, scans again and retries.
#
# Usage:   push-develop.sh                       (from the post-commit hook; it needs no arguments)
#          push-develop.sh --bg <repo> <sha>     (internal: the background part, started by the synchronous one)
# State in $PUSH_DEVELOP_CACHE (default ~/.cache/push-develop/): last.log (the last background run), last-scan.txt (the
# full output of the last scan; the commit only shows a summary) and pending (failures not yet resolved; printed on
# every commit until a push goes through).
# Env (each can also go in the config file of secret-scan, see _env.sh; the environment wins):
#   SECRET_SCAN           the scanner to call (default: secret-scan.sh next to this script)
#   PUSH_DEVELOP_REMOTE   the remote (default origin)
#   PUSH_DEVELOP_BRANCH   the only branch it acts on, and the one it pushes to (default develop)
#   PUSH_DEVELOP_CACHE    the state directory
# It only acts on that branch. It never makes the commit fail: it always exits 0.
set -u
HERE="$(dirname "$(readlink -f "$0")")"
_ss_env="$HERE/_env.sh"; [ -r "$_ss_env" ] && . "$_ss_env"; unset _ss_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
REMOTE="${PUSH_DEVELOP_REMOTE:-origin}"
BRANCH="${PUSH_DEVELOP_BRANCH:-develop}"
CACHE="${PUSH_DEVELOP_CACHE:-$HOME/.cache/push-develop}"
LOCK="$CACHE/lock"
PENDING="$CACHE/pending"
LOG="$CACHE/last.log"
SCANOUT="$CACHE/last-scan.txt"
SCAN="${SECRET_SCAN:-$HERE/secret-scan.sh}"
mkdir -p "$CACHE"

# pending: "<date>\t<failure>"; the failure is short (counts, never the list) so that the commit can print it cheaply
pending() { printf '%s\t[%s] %s\n' "$(date '+%F %T')" "$(basename "$REPO")" "$*" >>"$PENDING"; }

# ---------------------------------------------------------------- background ---------------------------------
if [ "${1:-}" = "--bg" ]; then
  REPO=$2 SHA=$3
  cd "$REPO" || exit 0
  export GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes}"
  exec 9>"$LOCK"
  flock -w 300 9 || { pending "push of ${SHA:0:8} did not run: lock busy for 5 min"; exit 0; }
  exec >"$LOG" 2>&1
  echo "$(date '+%F %T') push of $SHA ($REPO)"

  push() { timeout 120 git push -q "$REMOTE" "$1:refs/heads/$BRANCH"; }
  ok() { echo "✓ $*"; : >"$PENDING"; exit 0; }

  push "$SHA" && ok "pushed $SHA"
  timeout 120 git fetch -q "$REMOTE" "$BRANCH" || { pending "push of ${SHA:0:8} failed and so did the fetch (network?)"; exit 0; }
  # another process already pushed this commit (or one that contains it): nothing to do
  git merge-base --is-ancestor "$SHA" "$REMOTE/$BRANCH" && ok "$SHA was already in $REMOTE/$BRANCH"
  # the remote moved ahead: rebase only if that is safe for the shared tree
  [ "$(git symbolic-ref -q --short HEAD)" = "$BRANCH" ] ||
    { pending "push of ${SHA:0:8} rejected and HEAD is no longer on $BRANCH: touching nothing"; exit 0; }
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "✗ remote ahead and the tree has uncommitted changes: touching nothing"
    pending "push rejected (remote ahead) and the tree has uncommitted changes: run 'git pull --rebase' and 'git push' by hand"
    exit 0
  fi
  if ! git merge-tree --write-tree "$REMOTE/$BRANCH" HEAD >/dev/null 2>&1; then
    echo "✗ remote ahead with predicted conflicts: touching nothing"
    pending "push rejected (remote ahead) and the rebase would conflict: resolve it by hand"
    exit 0
  fi
  if ! PUSH_DEVELOP_INNER=1 git pull -q --rebase "$REMOTE" "$BRANCH"; then
    git rebase --abort 2>/dev/null
    pending "push rejected and the rebase failed (aborted, the tree is as it was): resolve it by hand"
    exit 0
  fi
  # the rebase rewrote the commits: scan what is really going out
  "$SCAN" "$REMOTE/$BRANCH..HEAD" >"$SCANOUT" 2>&1; rc=$?
  [ $rc -eq 0 ] || { pending "after the rebase the scan stopped the push: $(grep -vc '^AVISA' "$SCANOUT") findings"; exit 0; }
  NEW=$(git rev-parse HEAD)
  push "$NEW" && ok "rebased and pushed $NEW"
  pending "push of ${NEW:0:8} rejected again after the rebase"
  exit 0
fi

# ---------------------------------------------------------------- synchronous (post-commit) -------------------
# a commit made by the rebase itself triggers nothing
[ -n "${PUSH_DEVELOP_INNER:-}" ] && exit 0
REPO=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ "$(git symbolic-ref -q --short HEAD)" = "$BRANCH" ] || exit 0

# one line per distinct failure, with how many times it repeated and the last date
if [ -s "$PENDING" ]; then
  echo "🔴 push-develop has unresolved failures:"
  awk -F'\t' '{n[$2]++; last[$2]=$1; if (!($2 in seen)) {seen[$2]=1; order[++k]=$2}}
    END {for (i=1;i<=k;i++) printf "   %s%s (last %s)\n", order[i], (n[order[i]]>1 ? " ×" n[order[i]] : ""), last[order[i]]}' "$PENDING"
fi

SHA=$(git rev-parse HEAD)
if git rev-parse -q --verify "$REMOTE/$BRANCH" >/dev/null; then range="$REMOTE/$BRANCH..$SHA"; else range="$SHA"; fi
"$SCAN" "$range" >"$SCANOUT" 2>&1; rc=$?
navisos=$(grep -c '^AVISA' "$SCANOUT")
[ "$navisos" -gt 0 ] && echo "ⓘ $navisos warnings about own hosts/paths (details in $SCANOUT)"
case $rc in
  0) ;;
  1) nbloq=$(grep -c '^BLOQUEA' "$SCANOUT")
     echo "🔴 push stopped: $nbloq findings — fix the commit before it goes out"
     grep '^BLOQUEA' "$SCANOUT" | sed 's/^BLOQUEA /   /'
     pending "push stopped by the scan at ${SHA:0:8}: $nbloq findings"
     exit 0 ;;
  *) echo "🔴 push stopped: the scan did not run ($(grep -v '^AVISA' "$SCANOUT" | head -1))"
     pending "scan failed at ${SHA:0:8}"
     exit 0 ;;
esac

env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE -u GIT_PREFIX \
  setsid nohup "$0" --bg "$REPO" "$SHA" </dev/null >/dev/null 2>&1 &
echo "↑ push to $REMOTE/$BRANCH in the background (result in $LOG)"
exit 0
