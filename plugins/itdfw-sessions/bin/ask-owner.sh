#!/usr/bin/env bash
# ask-owner.sh: ask the person ON THEIR SCREEN: a modal tmux popup with fzf. Run it with Bash in the background
# (run_in_background): it blocks the person, never the session. "Say what to do…" is always added as the last option.
#
# Usage:   ask-owner.sh "<title>" "<option>" ["<option>"…]
# Reads:   the tmux client list (through owner-present.sh, next to this script); fzf and flock from the PATH
# Writes:  nothing permanent. A lock file serializes the questions, and a few temp files hold the popup for as long
#          as it is open
# Env:     ASK_OWNER_TIMEOUT   seconds before the popup is closed from outside (default 300)
#          ASK_OWNER_FZF       the fzf binary the popup runs (default: fzf from the PATH)
#          ASK_OWNER_LOCK      the lock file (default: ${XDG_RUNTIME_DIR:-/tmp}/ask-owner.lock)
# Exit:    (with what goes to stdout; the three words are a stable contract that callers match on, kept as they were)
#          0  the chosen option, or the free text typed after "Say what to do…"
#          2  "no está"        no tmux client is attached   → send a push notification + a one-shot cron in 5 min
#          3  "sin respuesta"  the popup closed at the timeout → same as 2
#          4  "cola llena"     another question held the popup for twice the timeout → a one-shot cron in 5 min
#          64 usage (no options), written to stderr
# Traps: the popup opens with nothing marked, Enter only accepts with a row marked (Tab or space), and Esc and Ctrl-C
# do not close it. One question at a time: flock on the lock file, the second one waits its turn.
set -u
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) echo 'Usage: ask-owner.sh "<title>" "<option>" ["<option>"…]'; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
HERE=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
TITLE=${1:?the title is missing}; shift
[ $# -gt 0 ] || { echo "options missing" >&2; exit 64; }
TIMEOUT=${ASK_OWNER_TIMEOUT:-300}
FZF=${ASK_OWNER_FZF:-$(command -v fzf || echo fzf)}
LOCK=${ASK_OWNER_LOCK:-${XDG_RUNTIME_DIR:-/tmp}/ask-owner.lock}
FREE="Say what to do…"

"$HERE/owner-present.sh" >/dev/null || { echo "no está"; exit 2; }

exec 9>"$LOCK"
flock -w $((TIMEOUT * 2)) 9 || { echo "cola llena"; exit 4; }
# the person may have left while this question waited in the queue
CLIENT=$("$HERE/owner-present.sh") || { echo "no está"; exit 2; }

OUT=$(mktemp)
printf '%s\n' "$@" "$FREE" > "$OUT.opts"
printf '%s' "$TITLE" > "$OUT.title"
cat > "$OUT.sh" <<EOF
#!/usr/bin/env bash
trap '' INT QUIT TERM TSTP
while :; do
  CHOICE=\$("$FZF" --multi 1 --prompt="mark with Tab or space and confirm with Enter > " --height=100% \\
    --no-info --pointer="▶" --marker="✔ " --header="\$(cat "$OUT.title")" \\
    --bind 'tab:clear-selection+select,space:clear-selection+select' \\
    --bind 'esc:ignore,ctrl-c:ignore,ctrl-q:ignore,ctrl-d:ignore,ctrl-g:ignore' \\
    --bind 'enter:transform:[ "\$FZF_SELECT_COUNT" -gt 0 ] && echo accept || echo ignore' \\
    < "$OUT.opts")
  if [ "\$CHOICE" != "$FREE" ]; then
    [ -n "\$CHOICE" ] && break
    continue
  fi
  printf '\n  %s\n  (empty Enter goes back to the menu)\n\n' "\$(cat "$OUT.title")"
  read -e -r -p "  > " FREE
  [ -n "\$FREE" ] && { CHOICE="\$FREE"; break; }
done
printf '%s\n' "\$CHOICE" > "$OUT"
EOF
chmod +x "$OUT.sh"

# the popup has no escape on purpose, so the timeout closes it from outside; the timer closes fd 9 first, or its
# sleep (orphaned when the timer is killed) would hold the lock and stall the next question until it expires
# (stderr silenced: bash prints "Terminado" there when the sleep dies before its subshell)
( exec 9>&-; sleep "$TIMEOUT"; tmux display-popup -C -c "$CLIENT" ) 2>/dev/null & TIMER=$!
tmux display-popup -c "$CLIENT" -E -w 80% -h 60% -T " ❓ $(date +%H:%M) " "$OUT.sh"
pkill -P "$TIMER" 2>/dev/null; kill "$TIMER" 2>/dev/null

CHOICE=$(grep -v "^$" "$OUT" 2>/dev/null | tail -1)
rm -f "$OUT" "$OUT.opts" "$OUT.title" "$OUT.sh"
[ -n "$CHOICE" ] || { echo "sin respuesta"; exit 3; }
echo "$CHOICE"
