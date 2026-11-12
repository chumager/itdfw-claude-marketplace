#!/usr/bin/env bash
# Runs the test suite of every piece of this repository that has one, each from its own folder with its own command,
# prints one line per piece with its pass/fail counts and a total, and exits 1 if any suite fails.
#
# It does NOT run the hooks: they have no suite.
#
# A piece that needs its dependencies (`pnpm install --ignore-workspace`) gets them installed here only when its
# `node_modules` is missing.
set -u

case "${1:-}" in
  -h|--help)
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
    echo
    echo "Usage: scripts/test-all.sh [--help]"
    exit 0
    ;;
esac

root="$(cd "$(dirname "$0")/.." && pwd)"
# piece | needs install (1/0) | command
pieces=(
  'agent-tools/room|1|node --test --test-timeout=30000 "test/*.test.mjs"'
  'agent-tools/graph-rag|1|node --test "test/*.test.js"'
  'agent-tools/inventory|0|node --test "test/*.test.js"'
  'plugins/itdfw-sessions|0|node --test "test/*.test.mjs"'
)

total_pass=0; total_fail=0; status=0
for entry in "${pieces[@]}"; do
  IFS='|' read -r dir install cmd <<<"$entry"
  cd "$root/$dir" || { echo "$dir: missing"; status=1; continue; }
  if [ "$install" = 1 ] && [ ! -d node_modules ]; then
    pnpm install --ignore-workspace >/dev/null 2>&1 || { echo "$dir: install failed"; status=1; continue; }
  fi
  out="$(bash -c "$cmd" 2>&1)"; code=$?
  pass="$(printf '%s\n' "$out" | sed -n 's/^[^0-9]*pass \([0-9]*\)$/\1/p' | tail -1)"
  fail="$(printf '%s\n' "$out" | sed -n 's/^[^0-9]*fail \([0-9]*\)$/\1/p' | tail -1)"
  pass="${pass:-0}"; fail="${fail:-0}"
  [ "$code" -ne 0 ] && [ "$fail" -eq 0 ] && fail=1
  printf '%-24s pass %-4s fail %s\n' "$dir" "$pass" "$fail"
  total_pass=$((total_pass + pass)); total_fail=$((total_fail + fail))
  [ "$code" -ne 0 ] && status=1
done
printf '%-24s pass %-4s fail %s\n' "TOTAL" "$total_pass" "$total_fail"
exit "$status"
