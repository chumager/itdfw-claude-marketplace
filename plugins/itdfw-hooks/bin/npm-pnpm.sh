#!/usr/bin/env bash
# PreToolUse(Bash): Claude does not run npm/npx here. Ever. A pnpm monorepo must not get npm commands.
# The check below matches npm/npx as a standalone command word (not inside pnpm) and denies.
#
# Why DENY and not a warning: with `allow` the command runs anyway, and an `npm install/add` breaks the pnpm
# lockfile. Telling "harmless" verbs (--version, run) from dangerous ones would require the hook to guess the
# whole verb list right: a judgement not worth risking for commands that are of no use here anyway.
#
# Escape hatch: Claude asks the user to run `! npm ...` themselves. User-run commands do NOT go through hooks.

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
# A coarse prefilter on the substring "npm " would also catch "pnpm ". The only job here: npm/npx must not be
# glued to an alphanumeric character.
[[ "$cmd" =~ (^|[^[:alnum:]_-])(npm|npx)[[:space:]] ]] || exit 0

read -r -d '' msg <<'EOF'
🔴 npm/npx BLOCKED. This repository uses pnpm/pnpx, always.

Replace: npm install -> pnpm install · npm add -> pnpm add · npm view -> pnpm view · npx -> pnpx

Was npm an ARGUMENT and not the command (e.g. `grep npm file`)? The filter is deliberately coarse:
get around it by quoting (`grep "npm" file`) and carry on.

And if npm is really needed (rare), do NOT insist: ask the user to run it themselves with
`! npm <whatever>`. Their commands do not go through this hook.

Why: logins are PER TOOL. With the session on pnpm, `npm view` of a private package answers
404 even if it exists and you are logged in: that 404 LIES (it is a 401).
EOF

jq -n --arg m "$msg" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$m}}'
exit 0
