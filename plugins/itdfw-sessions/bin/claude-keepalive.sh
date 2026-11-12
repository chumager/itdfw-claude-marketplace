#!/usr/bin/env bash
# claude-keepalive.sh: keep-alive of the prompt cache (1 h TTL) of ALL the live sessions, from the system cron.
# It queues in each session a "ping" as a cross-session message with from-name="keepalive": the interface shows it
# on ONE line ("Message from @keepalive: ping") and the session answers "pong" when it is free. If the session is
# busy the message waits in its queue: it interrupts nothing.
#
# Where each thing comes from (Claude Code 2.1.283, read from the binary on 2026-09-26):
#   <claude-home>/sessions/<pid>.json       session file: messagingSocketPath, name, spare
#   <claude-home>/sessions/<pid>.<sha>.key  {"peerToken": ...}: the key the other sessions use
#   protocol: JSON lines; first {"type":"auth","token":...}, then {"type":"user",...}
# Processes with "spare": true are daemon reserves, not sessions: they are skipped.
#
# Usage:   claude-keepalive.sh                    (no arguments)
# Reads:   the session and key files above
# Writes:  nothing on disk; one message per live session socket (needs jq and socat); "failed <name> (<pid>)" on
#          stderr when a delivery fails.
# Env:     CLAUDE_CONFIG_DIR   Claude Code config dir (default: $HOME/.claude)
# Exit:    always 0 (a failed delivery is only reported on stderr)
# crontab (every 30 min: with one per hour the interval sits right at the 1 h TTL):
#   20,50 * * * * claude-keepalive.sh
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac

dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions"
for meta in "$dir"/*.json; do
  [ -f "$meta" ] || continue
  read -r pid sock spare name < <(jq -r '[.pid, .messagingSocketPath // "", (.spare // false), .name // ""] | @tsv' "$meta" 2>/dev/null) || continue
  [ "$spare" = "true" ] && continue
  [ -S "$sock" ] || continue
  kill -0 "$pid" 2>/dev/null || continue
  key=$(ls "$dir/$pid".*.key 2>/dev/null | head -1)
  [ -n "$key" ] || continue
  tok=$(jq -r '.peerToken // empty' "$key" 2>/dev/null)
  [ -n "$tok" ] || continue
  {
    printf '{"type":"auth","token":"%s"}\n' "$tok"
    # from="cron:keepalive" (not uds:): it is not a session, so nobody tries to answer it with SendMessage
    # (with from="uds:<its own socket>" a session tried to answer itself, 2026-09-26).
    printf '%s\n' '{"type":"user","message":{"role":"user","content":"<cross-session-message from=\"cron:keepalive\" from-name=\"keepalive\" from-mode=\"prompting\">\nkeep-alive ping from the system cron, to keep the prompt cache warm: answer only pong, as text, with no tools\n</cross-session-message>"}}'
  } | socat -t 2 - UNIX-CONNECT:"$sock" 2>/dev/null || echo "keepalive: failed $name ($pid)" >&2
done
