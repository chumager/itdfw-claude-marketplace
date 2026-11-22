#!/usr/bin/env bash
# cajaritos-reposo.sh: during the day, a session at rest over a context threshold writes its thread and is compacted
# while its prompt cache is still warm (it lasts 1 h), so its next turn and the daily close do not re-read a big
# context cold. Meant for a user timer every 10 minutes. Two steps, each on the session's OWN status
# (<claude-home>/sessions/*.json: `idle` or `shell` = its turn is over; `busy` = working, also inside a long tool call):
#   1. compact: a session that left its mark (hilo-listo.sh) and has been at rest for --listo minutes is compacted
#      (cajaritos-compactar.sh --solo, trusting its own status over the daemon's) and its mark is deleted;
#   2. ask: a session at rest between --quieto and --frio minutes, at --umbral % or more, with no mark and not asked in
#      the last --frio minutes, is asked for its thread (hilo-pedir.sh --solo). One already cold (at rest longer than
#      --frio) is not woken: that costs a full cold re-read, and the daily close asks it anyway.
#
# Usage:   cajaritos-reposo.sh [--umbral 50] [--quieto 30] [--frio 55] [--listo 2] [--seco]
#          --seco  print what it would do, and do nothing
# Reads:   <claude-home>/sessions/*.json (name, sessionId, status, statusUpdatedAt in ms); <state-dir>/ctx-<sid>.json
#          (field `used`); <state-dir>/compactables/<name> (the marks)
# Writes:  <state-dir>/reposo-pedido/<name> (when it was asked); deletes a mark once its session is compacted
# Output:  one line per action: "compacted <name>: …", "not compacted <name>: …", "asked <name> (<used>%)"
# Env:     CLAUDE_STATE_DIR (default <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or $HOME/.claude)
#          CAJARITOS_BIN    where hilo-pedir.sh and cajaritos-compactar.sh live (default: this script's folder)
# Exit:    0 · 2 bad usage
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
set -uo pipefail
HOME_CC="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
STATE_DIR="${CLAUDE_STATE_DIR:-$HOME_CC/state}"
BIN="${CAJARITOS_BIN:-$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")}"
UMBRAL=50; QUIETO=30; FRIO=55; LISTO=2; SECO=0
usage() { echo "usage: cajaritos-reposo.sh [--umbral N] [--quieto MIN] [--frio MIN] [--listo MIN] [--seco]"; }
while [ $# -gt 0 ]; do
  case "$1" in
    --umbral) UMBRAL="$2"; shift 2 ;;
    --quieto) QUIETO="$2"; shift 2 ;;
    --frio) FRIO="$2"; shift 2 ;;
    --listo) LISTO="$2"; shift 2 ;;
    --seco) SECO=1; shift ;;
    -h|--help) usage; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
for n in "$UMBRAL" "$QUIETO" "$FRIO" "$LISTO"; do [[ "$n" =~ ^[0-9]+$ ]] || { usage >&2; exit 2; }; done
marks="$STATE_DIR/compactables"; asked="$STATE_DIR/reposo-pedido"
mkdir -p "$asked"
now_ms=$(date +%s%3N)

jq -r --argjson now "$now_ms" 'select(.name and .sessionId and .status)
  | [.name, .sessionId, .status, (((($now - (.statusUpdatedAt // $now)) / 60000) | floor) | tostring)] | @tsv' \
  "$HOME_CC"/sessions/*.json 2>/dev/null |
while IFS=$'\t' read -r name sid status mins; do
  case "$status" in idle|shell) ;; *) continue ;; esac
  if [ -f "$marks/$name" ]; then
    # The ritual's mark is left in the turn that ends right before the rest began; a mark older than that rest by
    # more than 10 min belongs to an earlier ritual, and the session worked after it: it is dropped, not obeyed.
    marca_min=$(( ($(date +%s) - $(stat -c %Y "$marks/$name")) / 60 ))
    if [ "$marca_min" -gt $(( mins + 10 )) ]; then
      if [ "$SECO" = 1 ]; then echo "would drop the stale mark of $name"; else rm -f "$marks/$name"; echo "dropped the stale mark of $name"; fi
      continue
    fi
    [ "$mins" -ge "$LISTO" ] || continue
    if [ "$SECO" = 1 ]; then echo "would compact $name (at rest $mins min)"; continue; fi
    out=$("$BIN/cajaritos-compactar.sh" --solo "$name" --umbral 0 --quieto 1 --aunque-ocupada 2>&1 | tail -1)
    if echo "$out" | grep -qE "% -> [0-9]+%" && ! echo "$out" | grep -q "NOT compacted"; then
      rm -f "$marks/$name" "$asked/$name"; echo "compacted $name: $out"
    else
      echo "not compacted $name: $out"
    fi
    continue
  fi
  [ "$mins" -ge "$QUIETO" ] && [ "$mins" -lt "$FRIO" ] || continue
  used=$(jq -r '.used // empty' "$STATE_DIR/ctx-$sid.json" 2>/dev/null)
  [ -n "$used" ] && [ "$used" -ge "$UMBRAL" ] 2>/dev/null || continue
  [ -n "$(find "$asked/$name" -mmin -"$FRIO" 2>/dev/null)" ] && continue
  if [ "$SECO" = 1 ]; then echo "would ask $name (${used}%, at rest $mins min)"; continue; fi
  "$BIN/hilo-pedir.sh" --solo "$name" --umbral "$UMBRAL" --motivo "Llevas un rato en reposo" >/dev/null 2>&1 \
    && { touch "$asked/$name"; echo "asked $name (${used}%)"; }
done
exit 0
