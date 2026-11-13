#!/usr/bin/env bash
# hilo-devolver.sh: PostCompact hook. Hands the thread back to the session that was just compacted: its own summary
# (if it wrote one in the last 24 h, see hilo-listo.sh) and the last messages that hilo-capturar.sh saved, as ONE
# message from "cron:hilo" over the session socket.
#
# Usage:   in settings.json, hooks.PostCompact: {"type": "command", "command": "hilo-devolver.sh"}
#          It reads the hook input on stdin: {"session_id", ...}.
# Reads:   <claude-home>/sessions/*.json (the session's name: a session without a name gets nothing)
#          <state-dir>/hilo/<name>.md (the session's summary) and <state-dir>/hilo/<name>.ultimos.md
# Writes:  <state-dir>/hilo/<name>.enviado.md (what was sent); one message through claude-session-msg.sh, sent in the
#          background a few seconds later so the hook returns at once. A PostCompact hook cannot add context itself.
# Env:     HILO_ESPERA        seconds before sending (default 5)
#          CLAUDE_STATE_DIR   default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude
# Exit:    always 0.
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
state="${CLAUDE_STATE_DIR:-$home/state}"
sid=$(jq -r '.session_id // empty' 2>/dev/null)
[ -n "$sid" ] || exit 0
name=$(jq -r --arg s "$sid" 'select(.sessionId == $s) | .name // empty' "$home"/sessions/*.json 2>/dev/null | head -1)
[ -n "$name" ] || exit 0
resumen="$state/hilo/$name.md"; ultimos="$state/hilo/$name.ultimos.md"; enviado="$state/hilo/$name.enviado.md"
[ -n "$(find "$resumen" -mmin -1440 2>/dev/null)" ] || resumen=""
[ -n "$resumen" ] || [ -r "$ultimos" ] || exit 0
{
  echo "Te acaban de compactar. Esto es el hilo de antes de la compactación: léelo entero y retoma desde aquí."
  echo "No es un pedido nuevo: no respondas a este mensaje, úsalo como contexto para lo que sigue."
  [ -n "$resumen" ] && { echo; echo "=== Tu resumen ($resumen) ==="; cat "$resumen"; }
  [ -r "$ultimos" ] && { echo; echo "=== Los últimos mensajes ($ultimos) ==="; cat "$ultimos"; }
} > "$enviado" 2>/dev/null || exit 0
send="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/claude-session-msg.sh"
( sleep "${HILO_ESPERA:-5}"; "$send" "$name" hilo < "$enviado" ) >/dev/null 2>&1 </dev/null &
disown 2>/dev/null
exit 0
