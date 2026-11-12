#!/usr/bin/env bash
# session-fg.sh: where is session <name> with respect to what the person is looking at? It looks in the panes of a
# tmux window for a flat piece of the session's last text answer, taken from its .jsonl transcript.
#   ACTIVE <pane>   it is on screen in the active pane: the person is with this session
#   VISIBLE <pane>  it is on screen in another pane of the window: in sight, but not the active one
#   BG              it is on screen in no pane
# It does not say whether the person is at the computer; that is a different question.
#
# Usage:   session-fg.sh <session name> [tmux window]
# Reads:   <claude-home>/sessions/*.json (name -> sessionId), <claude-home>/projects/*/<sessionId>.jsonl (transcript),
#          the panes of the tmux window (`tmux capture-pane`)
# Writes:  the verdict on stdout; nothing on disk.
# Env:     CLAUDE_CONFIG_DIR     Claude Code config dir (default: $HOME/.claude)
#          SESSION_FG_WINDOW     the tmux window to look in, when it is not the second argument
#                                (default: the current tmux window of the caller)
# Exit:    0 ACTIVE · 1 VISIBLE · 3 BG · 2 the session, its transcript, a text to look for, or a window to look in was not found
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -u
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
name="${1:?missing session name}"
window="${2:-${SESSION_FG_WINDOW:-}}"
[ -n "$window" ] || window=$(tmux display-message -p '#{session_name}:#{window_index}' 2>/dev/null)
[ -n "$window" ] || { echo "no tmux window to look in (pass it or set SESSION_FG_WINDOW)" >&2; exit 2; }
claude_home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

sid=$(jq -r --arg n "$name" 'select(.name == $n) | .sessionId' "$claude_home"/sessions/*.json 2>/dev/null | head -1)
[ -n "$sid" ] || { echo "no session '$name'" >&2; exit 2; }
log=$(find "$claude_home/projects" -maxdepth 2 -name "$sid.jsonl" 2>/dev/null | head -1)
[ -n "$log" ] || { echo "no transcript for '$name'" >&2; exit 2; }

# the pane keeps no history (only what is on screen), and while the session works its last text scrolls away under
# tool calls: so the probes are its LAST few footprints, any of which may be visible. Text: first prose line, marks
# stripped (the terminal renders `code` and **bold** without them). Tool call: first line of its command or file path.
probes=$(jq -rs '[.[] | select(.type == "assistant") | .message.content[]?
    | if .type == "text" then {t: .text} elif .type == "tool_use" then {c: (.input.command // .input.file_path // "")} else empty end]
  | .[-6:][] | (.t // empty), (.c // empty | split("\n")[0])' <(tail -n 300 "$log") 2>/dev/null |
  sed 's/[`*]//g' | grep -vE '^\s*([|#>]|[-*] |[0-9]+\. )' | awk 'length($0) >= 30 {print substr($0, 1, 40)}')
[ -n "$probes" ] || { echo "no footprints to look for in '$name'" >&2; exit 2; }

# every pane of the window: the person may have several sessions side by side
while read -r p active; do
  tmux capture-pane -p -J -t "$p" 2>/dev/null | grep -qF -- "$probes" || continue
  [ "$active" = 1 ] && { echo "ACTIVE $p"; exit 0; }
  echo "VISIBLE $p"; exit 1
done < <(tmux list-panes -t "$window" -F '#{pane_id} #{pane_active}' 2>/dev/null)
echo BG; exit 3
