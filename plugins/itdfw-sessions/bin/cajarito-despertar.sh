#!/usr/bin/env bash
# cajarito-despertar.sh: wake a dead background session by name, with `claude --bg --resume <sessionId>`.
#
# The session comes back in the daemon with the same id, name, agent and model, idle, with no interface and no
# process to close. Waking is not assigning work: send it a message afterwards (claude-session-msg.sh).
# A bare `claude --resume` does not work for this: it opens the interface in the foreground and dies with its terminal.
#
# Usage:   cajarito-despertar.sh <session name>
# Reads:   `claude agents --json --all` (the session list of the daemon)
# Writes:  starts a background session (`claude --bg --resume`); nothing on disk by itself.
# Env:     CAJARITO_REPO   directory the session is resumed from (claude --bg requires a trusted directory);
#                          default: the current directory
# Exit:    0 alive (it already was, or it woke up) · 1 it did not wake up · 2 no such session, or the name is ambiguous
#          (a missing argument also exits 1, from the shell's ${1:?})
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
NOMBRE="${1:?usage: cajarito-despertar.sh <session name>}"
REPO="${CAJARITO_REPO:-$PWD}"

fila() { claude agents --json --all 2>/dev/null | jq -c --arg n "$NOMBRE" '[.[]? | select(.name == $n)]'; }

FILAS=$(fila)
N=$(jq 'length' <<<"$FILAS")
[ "$N" -eq 0 ] && { echo "no session named '$NOMBRE' (claude agents --json --all)"; exit 2; }
# several with the same name: if one is alive, that one wins; if not, the most recent
VIVA=$(jq -r '[.[] | select(.status != null)][0].sessionId // empty' <<<"$FILAS")
[ -n "$VIVA" ] && { echo "$NOMBRE is already alive ($VIVA)"; exit 0; }
SID=$(jq -r 'sort_by(.updatedAt // 0) | last | .sessionId' <<<"$FILAS")
[ "$N" -gt 1 ] && echo "warning: $N sessions named '$NOMBRE', waking the most recent ($SID)"

cd "$REPO" || exit 1
timeout 60 claude --bg --resume "$SID" 2>&1 | head -2
sleep 3
ESTADO=$(fila | jq -r --arg s "$SID" '.[] | select(.sessionId == $s) | .status')
if [ -n "$ESTADO" ] && [ "$ESTADO" != "null" ]; then echo "$NOMBRE woke up ($ESTADO)"; exit 0; fi
echo "$NOMBRE did not wake up (state: ${ESTADO:-unknown})"; exit 1
