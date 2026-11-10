#!/usr/bin/env bash
# PreToolUse hook for Bash: a `git commit` that carries code (anything but .md) is blocked unless the session loaded
# the itdfw-completeness skill (the definition of done: how the FW tests). Same mark file as skill-gate.sh.
set -u

MARK_DIR="$HOME/.claude/state"
input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[[ "$command" =~ git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit ]] || exit 0

session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // empty')"
session_id="${session_id}${agent_id:+-$agent_id}"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"

# only code: a commit of docs alone (TDD, claude-docs, README) passes
code="$(git -C "${cwd:-.}" diff --cached --name-only 2>/dev/null | grep -v '\.md$' | head -1)"
[ -z "$code" ] && exit 0

mark_file="$MARK_DIR/skills-loaded-$session_id"
if [ -n "$session_id" ] && [ -f "$mark_file" ] && grep -q "^itdfw-completeness	" "$mark_file"; then
  exit 0
fi
echo "Load the itdfw-completeness skill with the Skill tool before committing code: it is the definition of done (how things are tested)." >&2
exit 2
