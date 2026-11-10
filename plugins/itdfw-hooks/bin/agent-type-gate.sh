#!/usr/bin/env bash
# PreToolUse gate for the Agent tool.
#
# Blocks (exit 2, stderr message that reaches the model):
#   1. subagent_type missing or empty  -> omitting it falls into general-purpose by default
#   2. subagent_type general-purpose / claude -> catch-all without its own model or effort
#   3. model fable -> billed separately; never for a subagent
#   4. any call made by a subagent (only the main session delegates), except the graphify-runner
#   5. a fork when the main context is above 75 % of 1M tokens
#
# Why: `effort` cannot be passed per call (the Agent tool only accepts description, prompt,
# subagent_type, model, isolation). An ad-hoc agent INHERITS the session's effort: if the main
# runs on low, the subagent thinks on low and nobody notices. The only way to declare it is the
# frontmatter of an agent `.md` (e.g. an agent named "base" with model and effort set).
#
# FORK allowed: subagent_type "fork" ignores the model parameter and ALWAYS inherits the parent's
# model. That does not travel in tool_input, so this hook cannot see it.

set -uo pipefail

input=$(cat)
# a subagent (fork, custom agent, workflow agent) carries agent_id; only the main session delegates.
# Except the graphify-runner: it is an orchestrator, its job is to hand the extraction to haiku extractors.
if [ -n "$(printf '%s' "$input" | jq -r '.agent_id // ""')" ] && [ "$(printf '%s' "$input" | jq -r '.agent_type // ""')" != "graphify-runner" ]; then
  echo "BLOCKED: you are a subagent. You run the task you received yourself with your own tools; you do not launch forks or other subagents (only the main session delegates)." >&2
  exit 2
fi

type=$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // ""')
model=$(printf '%s' "$input" | jq -r '.tool_input.model // ""')

# Normalize to lowercase to compare
type_lc=$(printf '%s' "$type" | tr '[:upper:]' '[:lower:]')
model_lc=$(printf '%s' "$model" | tr '[:upper:]' '[:lower:]')

if [ -z "$type_lc" ]; then
  echo "BLOCKED: subagent_type is REQUIRED. Omitting it falls into general-purpose by default, which inherits the model and effort of the session. Use subagent_type: \"base\" (or the specific agent for the area)." >&2
  exit 2
fi

case "$type_lc" in
  general-purpose|claude)
    echo "BLOCKED: subagent_type \"$type\" is a catch-all without its own model or effort: it inherits the session's. Use subagent_type: \"base\" (a custom agent whose frontmatter sets model and effort), or another agent with its own .md definition (Explore, Plan, claude-code-guide, ...)." >&2
    exit 2
    ;;
esac

case "$model_lc" in
  *fable*)
    echo "BLOCKED: model \"$model\" is not used for subagents: it is billed separately. Use model: \"sonnet\" (agentic/terminal work, searches, synthesis), \"opus\" (deep code analysis) or \"haiku\" (trivial)." >&2
    exit 2
    ;;
esac

# Delegation by fork, both ways. Threshold 75 % of 1M (auto-compaction triggers around 97 %).
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""')
desc=$(printf '%s' "$input" | jq -r '.tool_input.description // ""')
used=""
[ -f "$transcript" ] && used=$(tac "$transcript" | jq -r 'select(.message.usage) | .message.usage | (.input_tokens + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0))' 2>/dev/null | head -1)
limit=750000

if [ -n "$used" ]; then
  # above 75 %: the fork drags everything along and may compact inside (the thread, which was the point, is lost)
  if [ "$type_lc" = "fork" ] && [ "$used" -gt "$limit" ]; then
    echo "BLOCKED: fork with the context at $used tokens (> $limit, 75 % of 1M; compaction triggers ~97 %): the fork drags everything along and may compact inside. Use a fresh subagent with a brief (an agent with explicit model)." >&2
    exit 2
  fi
  # Below 75 % a fork is no longer mandatory: a fresh subagent pays its base context once and reads it from cache
  # at its own model's price; the fork inherits the parent's model and the whole thread.
fi

exit 0
