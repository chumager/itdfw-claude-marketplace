#!/usr/bin/env bash
# hilo-capturar.sh: PreCompact hook. Saves the last messages of the conversation (what the person wrote, the messages
# from other sessions, and the assistant's text; no tool calls or results) to a file, so that hilo-devolver.sh can hand
# them back to the session after the compaction. "Hilo" is Spanish for the thread of a conversation.
#
# Usage:   in settings.json, hooks.PreCompact: {"type": "command", "command": "hilo-capturar.sh"}
#          It reads the hook input on stdin: {"session_id", "transcript_path", ...}.
# Reads:   the transcript (JSONL) at transcript_path; <claude-home>/sessions/*.json to name the file by session name
# Writes:  <state-dir>/hilo/<session name, or session id if it has none>.ultimos.md
#          Nothing on stdout: a PreCompact hook's stdout becomes instructions for the compaction summary.
# Env:     HILO_MENSAJES      how many messages to keep (default 100)
#          HILO_MAX_MENSAJE   characters kept of each message; the rest is cut with a note (default 4000)
#          CLAUDE_STATE_DIR   default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude
# Exit:    always 0: a failing PreCompact hook would block or skip the compaction.
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
state="${CLAUDE_STATE_DIR:-$home/state}"
input="$(cat)"
sid=$(jq -r '.session_id // empty' <<<"$input" 2>/dev/null)
tr=$(jq -r '.transcript_path // empty' <<<"$input" 2>/dev/null)
[ -n "$sid" ] && [ -r "$tr" ] || exit 0
name=$(jq -r --arg s "$sid" 'select(.sessionId == $s) | .name // empty' "$home"/sessions/*.json 2>/dev/null | head -1)
mkdir -p "$state/hilo" || exit 0
out="$state/hilo/${name:-$sid}.ultimos.md"
{
  printf '# Últimos mensajes de %s antes de compactar (%s)\n\n' "${name:-$sid}" "$(date '+%F %T')"
  # one JSON string per message, so that a message with newlines or headings of its own is still one line to `tail`;
  # each message is cut at HILO_MAX_MENSAJE characters: one pasted log or a big message from a script would fill the
  # context that the compaction just freed
  jq -c --argjson max "${HILO_MAX_MENSAJE:-4000}" '
    def cut: if length > $max then .[0:$max] + "\n[… cortado: \(length - $max) caracteres más]" else . end;
    def text: (if type == "string" then . else (map(select(.type == "text") | .text) | join("\n")) end) | cut;
    if .type == "user" and (.isMeta | not) and (.message.content | type) == "string" then "## Usuario\n" + (.message.content | cut)
    elif .type == "user" and (.message.content | type) == "string" and (.message.content | startswith("Another Claude session")) then "## Otra sesión\n" + (.message.content | cut)
    elif .type == "assistant" then (.message.content | text) as $t | if ($t | length) > 0 then "## Asistente\n" + $t else empty end
    else empty end' "$tr" 2>/dev/null | tail -n "${HILO_MENSAJES:-100}" | jq -r '. + "\n"'
} > "$out.tmp" 2>/dev/null && mv -f "$out.tmp" "$out"
exit 0
