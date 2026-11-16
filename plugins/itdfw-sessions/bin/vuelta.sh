#!/usr/bin/env bash
# vuelta.sh: the shared ledger of "which session owes an answer to which", used by the `vuelta` hooks module of this
# plugin (hooks/vuelta.ts). A message from a session opens a debt on the receiver; the receiver's answer closes it;
# a turn that ends with a debt still open gets a reminder. One open debt is one file, created without clobbering and
# closed by removing it, so two sessions never step on each other.
#
# Usage:   vuelta.sh name <pid>            the session name of that Claude process ("" when it has none)
#          vuelta.sh receive <me> <from>   a message from <from> arrived at <me>; prints
#                                            reply    it answers something <me> had asked <from>: nothing is owed
#                                            request  <me> now owes <from> an answer (opened, or already open)
#          vuelta.sh sent <me> <to>        <me> sent a message to <to>: closes the debt <me> had with <to>, if any.
#                                          <to> is a name, "name [ref]" or a session socket address
#          vuelta.sh pending <me>          the sessions <me> still owes, one per line. Each call counts as one
#                                          reminder; a debt reminded more than VUELTA_MAX times is closed as failed
#          vuelta.sh list                  every open debt: "<ower> owes <asker> since <HH:MM> (<reminders>)"
# Reads:   <claude-home>/sessions/*.json (name, messagingSocketPath)
# Writes:  <state-dir>/vuelta/open/<ower>/<asker>      one open debt: start epoch, reminders sent
#          <state-dir>/vuelta/answered/<asker>/<ower>  short-lived mark: the answer on its way reads as a reply
#          <state-dir>/vuelta/log.jsonl                opened / answered / failed, one line each (append-only)
# Env:     CLAUDE_STATE_DIR   default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude
#          VUELTA_MAX         reminders before giving up on a debt (default 1: each reminder is a whole turn)
#          VUELTA_TOKEN_TTL   seconds an "answered" mark stays valid (default 120)
# Exit:    0 · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -u
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
dir="${CLAUDE_STATE_DIR:-$home/state}/vuelta"
max="${VUELTA_MAX:-1}"
mkdir -p "$dir/open"

key() { printf '%s' "$1" | tr '/' '_'; }                       # a session name as a file name
log() { jq -cn --arg at "$(date -Is)" --arg e "$1" --arg o "$2" --arg a "$3" '{at: $at, event: $e, ower: $o, asker: $a}' >> "$dir/log.jsonl"; }
close() {                                                       # close <ower> <asker> <event>; 0 when there was one
  local f="$dir/open/$(key "$1")/$(key "$2")"
  [ -f "$f" ] || return 1
  rm -f "$f" && log "$3" "$1" "$2"
}
resolve() {                                                     # a SendMessage recipient to a session name
  local to="${1% \[*\]}"
  case "$to" in
    *.sock) jq -r --arg s "${to#uds:}" 'select(.messagingSocketPath == $s) | .name // empty' "$home"/sessions/*.json 2>/dev/null | head -1 ;;
    *) printf '%s\n' "$to" ;;
  esac
}

case "${1:-}" in
  name)
    [ $# -eq 2 ] || { echo "usage: vuelta.sh name <pid>" >&2; exit 2; }
    jq -r '.name // empty' "$home/sessions/$2.json" 2>/dev/null ;;
  receive)
    [ $# -eq 3 ] || { echo "usage: vuelta.sh receive <me> <from>" >&2; exit 2; }
    me="$2"; from="$3"
    if close "$from" "$me" answered; then echo reply; exit 0; fi
    tok="$dir/answered/$(key "$me")/$(key "$from")"
    if [ -f "$tok" ]; then
      age=$(( $(date +%s) - $(cat "$tok") )); rm -f "$tok"
      [ "$age" -le "${VUELTA_TOKEN_TTL:-120}" ] && { echo reply; exit 0; }
    fi
    d="$dir/open/$(key "$me")"; mkdir -p "$d"
    if ( set -o noclobber; printf '%s\n0\n' "$(date +%s)" > "$d/$(key "$from")" ) 2>/dev/null; then log opened "$me" "$from"; fi
    echo request ;;
  sent)
    [ $# -eq 3 ] || { echo "usage: vuelta.sh sent <me> <to>" >&2; exit 2; }
    to="$(resolve "$3")"
    # the answer leaves a short-lived mark for the asker: when it arrives there it must read as a reply, not as a new
    # request (otherwise each answer would open the opposite debt and the pair would never stop)
    if [ -n "$to" ] && close "$2" "$to" answered; then mkdir -p "$dir/answered/$(key "$to")"; date +%s > "$dir/answered/$(key "$to")/$(key "$2")"; fi
    exit 0 ;;
  pending)
    [ $# -eq 2 ] || { echo "usage: vuelta.sh pending <me>" >&2; exit 2; }
    d="$dir/open/$(key "$2")"; [ -d "$d" ] || exit 0
    for f in "$d"/*; do
      [ -f "$f" ] || continue
      asker="$(basename "$f")"; start="$(sed -n 1p "$f")"; n="$(sed -n 2p "$f")"; n=$(( ${n:-0} + 1 ))
      if [ "$n" -gt "$max" ]; then close "$2" "$asker" failed; continue; fi
      printf '%s\n%s\n' "$start" "$n" > "$f"
      echo "$asker"
    done ;;
  list)
    for f in "$dir"/open/*/*; do
      [ -f "$f" ] || continue
      echo "$(basename "$(dirname "$f")") owes $(basename "$f") since $(date -d "@$(sed -n 1p "$f")" +%H:%M) ($(sed -n 2p "$f"))"
    done ;;
  *) echo "usage: vuelta.sh name|receive|sent|pending|list ... (--help)" >&2; exit 2 ;;
esac
