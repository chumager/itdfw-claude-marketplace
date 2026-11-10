#!/usr/bin/env bash
# PreToolUse hook for Edit and Write: blocks touching a file in a mapped
# framework area unless the required skill was already loaded (via the
# Skill tool) in this session.
# Env: ITDFW_SITE_SRC_PATTERN overrides the regex that recognises a site front source file
# (default: any path containing site/src/).
set -u

MARK_DIR="$HOME/.claude/state"
SITE_SRC_PATTERN="${ITDFW_SITE_SRC_PATTERN:-(^|/)site/src/}"

input="$(cat)"

file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
# Same key as skill-mark.sh: subagents share session_id but carry agent_id.
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // empty')"
session_id="${session_id}${agent_id:+-$agent_id}"

# Nothing to gate without a file path.
if [ -z "$file_path" ]; then
  exit 0
fi

# path -> skill map. First regex match wins.
# Order matters: more specific patterns (init.js, TDD*.md) go before broader ones.
skill=""
# tests first: whoever writes a test must know how the FW tests (cleanup by the model's deleteMode, showcase, etc.)
if [[ "$file_path" =~ (^|/)tests?/ ]] || [[ "$file_path" =~ \.(spec|test)\.[cm]?js$ ]]; then
  skill="itdfw-completeness"
elif [[ "$file_path" =~ (^|/)fronts/itdfw-naiveui/ ]] \
  || [[ "$file_path" =~ (^|/)libs/itdfw-site-vue-core/src/ ]] \
  || [[ "$file_path" =~ (^|/)plugins/[^/]+/vue[^/]*/ ]] \
  || [[ "$file_path" =~ $SITE_SRC_PATTERN ]]; then
  skill="itdfw-front-develop"
elif [[ "$file_path" =~ (^|/)mongooseSchema/ ]]; then
  skill="itdfw-models"
elif [[ "$file_path" =~ (^|/)mongooseTypes/ ]]; then
  skill="itdfw-mongoose-types"
elif [[ "$file_path" =~ (^|/)mongoosePlugins/ ]]; then
  skill="itdfw-plugins"
elif [[ "$file_path" =~ (^|/)plugins/[^/]+/index\.js$ ]] \
  || [[ "$file_path" =~ (^|/)FWPlugins/ ]]; then
  skill="itdfw-fwplugin"
elif [[ "$file_path" =~ (^|/)APP/ ]]; then
  skill="itdfw-api-system"
elif [[ "$file_path" =~ (^|/)libs/itdfw-site-vue-core/src/init\.js$ ]] \
  || [[ "$file_path" =~ (^|/)init\.js$ ]]; then
  skill="itdfw-core-init"
elif [[ "$file_path" =~ TDD[^/]*\.md$ ]]; then
  skill="tdd-narrativo"
elif [[ "$file_path" =~ (^|/)claude-docs/ ]]; then
  skill="itdfw-documentation"
elif [[ "$file_path" =~ \.itdfw\.js$ ]] \
  || [[ "$file_path" =~ ^/etc/itdfw/.*\.ya?ml$ ]]; then
  skill="itdfw-deploy-config"
fi

# Outside the map: pass through untouched.
if [ -z "$skill" ]; then
  exit 0
fi

mark_file="$MARK_DIR/skills-loaded-$session_id"

if [ -n "$session_id" ] && [ -f "$mark_file" ] && grep -q "^$skill	" "$mark_file"; then
  exit 0
fi

echo "Load the $skill skill with the Skill tool before touching $file_path" >&2
exit 2
