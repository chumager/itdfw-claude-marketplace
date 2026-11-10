#!/usr/bin/env bash
# PreToolUse hook for Bash: an rg/grep over the monorepo gets blocked ONCE unless a structured
# search tool (graph find / Serena / RAG) was used recently. The second attempt passes: the block
# is a reminder with the alternatives, not a wall. Marks live per session+agent, like skill-gate.
# Env: ITDFW_MONOREPO = root of the repository the gate protects (default: $CLAUDE_PROJECT_DIR).
set -u

MARK_DIR="$HOME/.claude/state"
mkdir -p "$MARK_DIR"
SEARCH_WINDOW=600  # seconds a structured search keeps rg/grep unlocked
PLR_WINDOW=180     # seconds the "already warned" pass stays valid
MONOREPO="${ITDFW_MONOREPO:-${CLAUDE_PROJECT_DIR:-}}"

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // empty')"
session_id="${session_id}${agent_id:+-$agent_id}"

[ -z "$cmd" ] || [ -z "$session_id" ] && exit 0
# Without a known repository root the gate has nothing to protect (an empty root would match every path).
[ -z "$MONOREPO" ] && exit 0

# The graphify CLI is a structured search too (it runs through Bash, so search-mark.sh never sees it).
re_graphify='(^|[;&|(][[:space:]]*)graphify[[:space:]]+(query|path|explain)[[:space:]]'
if [[ "$cmd" =~ $re_graphify ]]; then
  printf 'graphify-cli\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$MARK_DIR/search-used-$session_id"
  exit 0
fi

# Regexes in variables: bash chokes on unbalanced "(" inside a bracket expression written inline.
# A grep AFTER a pipe is a filter over another command's output, not a search: only the first
# command of a pipeline segment counts.
re_search='(^|[;&(][[:space:]]*|&&[[:space:]]*)(rg|grep|egrep)[[:space:]]'
re_ssh='(^|[[:space:]|;&(])ssh[[:space:]]'
re_repo_path='(^|[[:space:]])(back|plugins|libs|fronts|claude-docs|\.)(/|[[:space:]]|$)'

# Only rg/grep as a command (not inside a word like "egrep -c" of a test log, not after ssh).
[[ "$cmd" =~ $re_search ]] || exit 0
# A plain grep over ONE named file is reading, not searching: the gate is for "where does X live".
# rg is recursive by default, so it always counts; grep only when it recurses.
re_grep='(^|[;&(][[:space:]]*|&&[[:space:]]*)e?grep[[:space:]]'
re_recursive='(^|[[:space:]])(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive|--dereference-recursive)([[:space:]]|$)'
if [[ "$cmd" =~ $re_grep ]] && ! [[ "$cmd" =~ $re_recursive ]]; then
  exit 0
fi
# Remote or system searches are not the graph's business; neither are browser snapshots/logs.
[[ "$cmd" =~ $re_ssh ]] && exit 0
[[ "$cmd$cwd" == *".playwright-mcp"* || "$cmd$cwd" == *"graphify-out"* ]] && exit 0
# Searching over the monorepo: by explicit path in the command, or by cwd when the command names no
# absolute path of its own (a grep over /usr/lib or ~/.local from inside the repo is not the graph's).
re_abs_other='(^|[[:space:]"])(/|~/|\$[A-Za-z_]+)[^[:space:]]*'
if [[ "$cmd" == *"$MONOREPO"* || "$cmd" =~ $re_repo_path ]]; then
  :
elif [[ "$cwd" == "$MONOREPO"* ]] && ! [[ "$cmd" =~ $re_abs_other ]]; then
  :
else
  exit 0
fi

now=$(date +%s)
age() { local f="$1"; [ -f "$f" ] && echo $(( now - $(stat -c %Y "$f") )) || echo 999999; }

search_mark="$MARK_DIR/search-used-$session_id"
plr_mark="$MARK_DIR/search-plr-$session_id"

[ "$(age "$search_mark")" -lt "$SEARCH_WINDOW" ] && exit 0

if [ "$(age "$plr_mark")" -lt "$PLR_WINDOW" ]; then
  rm -f "$plr_mark"
  exit 0
fi

touch "$plr_mark"
cat >&2 <<'EOF'
Reminder: rg/grep over the monorepo without asking the tools that already know it. First:
  - mcp__itdfw-graph__find "<technical terms>"      -> which piece solves this and which file holds it?
  - Serena find_symbol / find_referencing_symbols   -> one symbol, a key, who uses it (AST, not text)
  - mcp__qdrant-code-search__qdrant-find            -> semantic search over code and docs
If none of them finds it: mcp__itdfw-graph__reportGap with what you were looking for, then repeat the rg: it passes now.
EOF
exit 2
