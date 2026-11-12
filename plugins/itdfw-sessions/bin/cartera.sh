#!/usr/bin/env bash
# cartera.sh: a work board for Claude Code sessions. Each session publishes its BLOCKS of work and its tasks in
# <state-dir>/cartera/<session>.json, and a panel (a band of the interface, a script) can merge all the files. The
# session is deduced (the Claude Code session file of the parent process); CARTERA_SESION forces it and CARTERA_DIR
# changes the folder (tests).
#
# The subcommand names, the flags, the state words and the keys of the JSON files are Spanish ON PURPOSE: they are the
# contract that sessions and panels already depend on. Only the texts printed for a human are English.
#
#   tarea "<block>" "<task>" en-curso [--espera "<what>"]      you carry it, independent of the user, even if you wait
#                                                              for a lock or another session. No change in 1 hour: red
#   tarea "<block>" "<task>" pendiente --go | --pregunta "<q>"  waits for the user: their approval or an answer
#   tarea "<block>" "<task>" parqueada --espera "<condition>"   it does not run today and is not the user's: it resumes
#                                                              on a condition
#   tarea "<block>" "<task>" terminado                           tested and delivered
#   describir "<block>" ["<task>"] "<text>"        what it is, why it matters, what it needs to move ("" deletes it)
#   rutina "<text>"  ·  rutina --quitar "<text>"   what never closes (one pass per day)
#   list                                           your blocks, their tasks and your routines
#   nota "<session>" "<block>" "<task>" "<line>"   the coordinator: where a task is, in one line ("" deletes it)
#   prioridad "<session>" "<block>" "<task>" alta|media|baja|""   the coordinator: a parked task turns red after 1 hour,
#                                                  1 day or 2 days
#   archivar "<session>" "<block>"                 the user (a panel button): hides a finished block, without deleting it
#   quitar "<block>" --duplicado-de "<block>"      the owner: hides one of its own blocks that is a duplicate
#   decision "<topic>" "<decision>" "<why>" ["<what it costs to undo it>"]   the coordinator: appended to decisiones.jsonl
#   migrar                                         converts every file of the old format (once)
# A block keeps no state: it is active while it has a task that is not finished, and finished when all of them are.
#
# Reads:   <cartera-dir>/*.json, ~/.claude/sessions/<pid>.json (to find the session name)
# Writes:  <cartera-dir>/<session>.json (atomically: mktemp + mv); <state-dir>/decisiones.jsonl (decision);
#          <state-dir>/cartera-backup-v1/ (migrar). Needs jq.
# Env:     CARTERA_SESION   force the session name
#          CARTERA_DIR      the folder of the JSON files (default: <state-dir>/cartera)
#          CLAUDE_STATE_DIR state dir (default: <claude-home>/state, with <claude-home> = $CLAUDE_CONFIG_DIR or
#                           $HOME/.claude)
# Exit:    0 done · 1 the session is unknown, or the block/task does not exist · 2 bad usage (and no arguments)
set -u
STATE_DIR="${CLAUDE_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/state}"
SESSIONS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions"
DIR="${CARTERA_DIR:-$STATE_DIR/cartera}"
DECISIONS="$STATE_DIR/decisiones.jsonl"
mkdir -p "$DIR"

help_text() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

session_name() {
  [ -n "${CARTERA_SESION:-}" ] && { echo "$CARTERA_SESION"; return; }
  local p=$$
  while [ -n "$p" ] && [ "$p" != "1" ] && [ "$p" != "0" ]; do
    if [ -f "$SESSIONS_DIR/$p.json" ]; then
      jq -r '.name // empty' "$SESSIONS_DIR/$p.json"; return
    fi
    p=$(awk '{print $4}' "/proc/$p/stat" 2>/dev/null)
  done
}

# old format (a flat array of {tema, estado, ...}) → {bloques, rutinas}: each topic becomes a block holding one task
# of the same name; activo → en_curso, archivado → archived block. Applied on every read, so a stray old file heals.
NORM='
  def task_of($t): {tarea: $t.tema, estado: (if $t.estado == "activo" then "en_curso" elif $t.estado == "archivado" then "terminado" else $t.estado end), at: ($t.at // 0)}
    + (if $t.espera then {espera: $t.espera} else {} end)
    + (if $t.pregunta then {pregunta: $t.pregunta} else {} end)
    + (if $t.nota then {nota: $t.nota} else {} end);
  def norm: if type == "array"
    then {bloques: map({bloque: .tema, at: (.at // 0), tareas: [task_of(.)]} + (if .estado == "archivado" then {archivado: true} else {} end)), rutinas: []}
    else {bloques: (.bloques // []), rutinas: (.rutinas // [])} end;'

# write <file> <jq program> [jq args…]: reads (normalized), applies, writes atomically
edit() {
  local f="$1" prog="$2"; shift 2
  local tmp; tmp=$(mktemp "$DIR/.tmp.XXXXXX")
  [ -f "$f" ] || echo '{"bloques":[],"rutinas":[]}' > "$f"
  if jq "$@" "$NORM norm | $prog" "$f" > "$tmp"; then mv "$tmp" "$f"; else rm -f "$tmp"; return 1; fi
}

need_session() { s=$(session_name); [ -n "$s" ] || { echo "I do not know which session I come from (use CARTERA_SESION)" >&2; exit 1; }; }

cmd="${1:-}"
case "$cmd" in
  -h|--help) help_text; exit 0 ;;
  tarea)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] && [ -n "${4:-}" ] || { echo "usage: $0 tarea \"<block>\" \"<task>\" en-curso [--espera \"<what>\"] | pendiente --go | pendiente --pregunta \"<q>\" | parqueada --espera \"<condition>\" | terminado" >&2; exit 2; }
    b="$2"; t="$3"
    case "$4" in en-curso) e=en_curso ;; pendiente) e=pendiente ;; parqueada) e=parqueada ;; terminado) e=terminado ;;
      *) echo "unknown state: $4 (en-curso, pendiente, parqueada or terminado)" >&2; exit 2 ;; esac
    w=""; q=""
    case "${5:-}" in
      --go) w=go ;;
      --pregunta) [ -n "${6:-}" ] || { echo "--pregunta needs the question" >&2; exit 2; }; w=texto; q="$6" ;;
      --espera) [ -n "${6:-}" ] || { echo "--espera needs what is being waited for" >&2; exit 2; }; w="$6" ;;
      "") ;;
      *) echo "unknown option: $5 (--go, --pregunta \"<q>\" or --espera \"<what>\")" >&2; exit 2 ;;
    esac
    case "${5:-}" in
      --go|--pregunta) [ "$e" = pendiente ] || { echo "--go and --pregunta are only for pendiente" >&2; exit 2; } ;;
      --espera)
        [ "$e" = terminado ] && { echo "--espera does not go with terminado" >&2; exit 2; }
        # the old way of saying "waits for something that is not the user": kept so no session breaks
        if [ "$e" = pendiente ]; then
          e=parqueada
          echo "  note: 'pendiente --espera' became parqueada. If you still carry it yourself (a lock, another session), use: en-curso --espera \"<what>\"" >&2
        fi ;;
    esac
    [ "$e" = parqueada ] && [ -z "$w" ] && { echo "parqueada needs --espera \"<condition>\": what resumes it" >&2; exit 2; }
    need_session
    now=$(date +%s%3N)
    edit "$DIR/$s.json" '
      def task: {tarea: $t, estado: $e, at: $at}
        + (if $w != "" then {espera: $w} else {} end) + (if $q != "" then {pregunta: $q} else {} end);
      def upd: .estado = $e | .at = $at | del(.espera, .pregunta)
        | if $w != "" then .espera = $w else . end | if $q != "" then .pregunta = $q else . end;
      (if any(.bloques[]; .bloque == $b) then . else .bloques += [{bloque: $b, at: $at, tareas: []}] end)
      | .bloques |= map(if .bloque == $b
          then .at = $at | del(.archivado)
            | (if any(.tareas[]; .tarea == $t) then .tareas |= map(if .tarea == $t then upd else . end) else .tareas += [task] end)
          else . end)' \
      --arg b "$b" --arg t "$t" --arg e "$e" --arg w "$w" --arg q "$q" --argjson at "$now" \
      && echo "$s: $b › $t · $e${w:+ (waiting: $w)}"
    [ "$e" = pendiente ] && [ -z "$w" ] && echo "  note: pendiente is what waits for the user: --go or --pregunta. Otherwise en-curso or parqueada" >&2
    exit 0 ;;
  activo|pendiente|terminado)
    # old interface, kept so no session breaks: the topic is both block and task
    [ -n "${2:-}" ] || { echo "usage: $0 tarea \"<block>\" \"<task>\" <state> (new interface)" >&2; exit 2; }
    echo "warning: '$cmd \"<topic>\"' is the old interface; use: $0 tarea \"<block>\" \"<task>\" en-curso|pendiente|terminado" >&2
    st="$cmd"; [ "$st" = activo ] && st=en-curso
    topic="$2"; shift 2
    exec "$0" tarea "$topic" "$topic" "$st" "$@" ;;
  rutina)
    need_session; now=$(date +%s%3N)
    if [ "${2:-}" = --quitar ]; then
      [ -n "${3:-}" ] || { echo "usage: $0 rutina --quitar \"<text>\"" >&2; exit 2; }
      edit "$DIR/$s.json" '.rutinas |= map(select(.rutina != $r))' --arg r "$3" && echo "$s: routine removed · $3"
    else
      [ -n "${2:-}" ] || { echo "usage: $0 rutina \"<text>\"" >&2; exit 2; }
      edit "$DIR/$s.json" 'if any(.rutinas[]; .rutina == $r) then .rutinas |= map(if .rutina == $r then .at = $at else . end) else .rutinas += [{rutina: $r, at: $at}] end' \
        --arg r "$2" --argjson at "$now" && echo "$s: routine · $2"
    fi ;;
  list)
    need_session; f="$DIR/$s.json"
    [ -f "$f" ] || { echo "(no blocks)"; exit 0; }
    jq -r "$NORM"' norm
      | (.bloques[] | select(.archivado != true)
          | ((if (.tareas | length) > 0 and all(.tareas[]; .estado == "terminado") then "✓" else "●" end) + " " + .bloque),
            (if .desc then (.desc | split("\n") | .[0:2][] | "\u001b[2m    " + . + "\u001b[0m") else empty end),
            (.tareas[] | "    \(.estado)\(if .espera then " [espera: \(.espera)]" else "" end)\t\(.tarea)\(if .nota then " — \(.nota)" else "" end)")),
        (if (.rutinas | length) > 0 then "↻ rutinas: " + ([.rutinas[].rutina] | join(" · ")) else empty end)' "$f" ;;
  nota)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] && [ -n "${4:-}" ] && [ "$#" -ge 5 ] || { echo "usage: $0 nota \"<session>\" \"<block>\" \"<task>\" \"<line>\"" >&2; exit 2; }
    f="$DIR/$2.json"
    [ -f "$f" ] && jq -e --arg b "$3" --arg t "$4" "$NORM"' norm | any(.bloques[]; .bloque == $b and any(.tareas[]; .tarea == $t))' "$f" >/dev/null \
      || { echo "\"$3 › $4\" does not exist in $2" >&2; exit 1; }
    edit "$f" '.bloques |= map(if .bloque == $b then .tareas |= map(if .tarea == $t then (if $n == "" then del(.nota) else .nota = $n end) else . end) else . end)' \
      --arg b "$3" --arg t "$4" --arg n "$5" && echo "$2: note · $3 › $4${5:+ — $5}" ;;
  prioridad)
    # the coordinator: how long a parked task may wait before it turns red. It does not touch `at`: the clock keeps running
    [ "$#" -eq 5 ] && [ -n "$2" ] && [ -n "$3" ] && [ -n "$4" ] || { echo "usage: $0 prioridad \"<session>\" \"<block>\" \"<task>\" alta|media|baja|\"\"" >&2; exit 2; }
    case "$5" in alta|media|baja|"") ;; *) echo "unknown priority: $5 (alta, media, baja or \"\" to delete it)" >&2; exit 2 ;; esac
    f="$DIR/$2.json"
    [ -f "$f" ] && jq -e --arg b "$3" --arg t "$4" "$NORM"' norm | any(.bloques[]; .bloque == $b and any(.tareas[]; .tarea == $t))' "$f" >/dev/null \
      || { echo "\"$3 › $4\" does not exist in $2" >&2; exit 1; }
    edit "$f" '.bloques |= map(if .bloque == $b then .tareas |= map(if .tarea == $t then (if $p == "" then del(.prioridad) else .prioridad = $p end) else . end) else . end)' \
      --arg b "$3" --arg t "$4" --arg p "$5" && echo "$2: priority · $3 › $4${5:+ · $5}" ;;
  describir)
    # what the block (or one task) is, why it matters and what it needs to move: what the user reads before deciding
    need_session; f="$DIR/$s.json"
    if [ "$#" -eq 3 ]; then
      [ -n "$2" ] || { echo "usage: $0 describir \"<block>\" [\"<task>\"] \"<text>\"" >&2; exit 2; }
      [ -f "$f" ] && jq -e --arg b "$2" "$NORM"' norm | any(.bloques[]; .bloque == $b)' "$f" >/dev/null || { echo "block \"$2\" does not exist in $s" >&2; exit 1; }
      edit "$f" '.bloques |= map(if .bloque == $b then (if $d == "" then del(.desc) else .desc = $d end) else . end)' \
        --arg b "$2" --arg d "$3" && echo "$s: description · $2"
    elif [ "$#" -eq 4 ]; then
      [ -n "$2" ] && [ -n "$3" ] || { echo "usage: $0 describir \"<block>\" [\"<task>\"] \"<text>\"" >&2; exit 2; }
      [ -f "$f" ] && jq -e --arg b "$2" --arg t "$3" "$NORM"' norm | any(.bloques[]; .bloque == $b and any(.tareas[]; .tarea == $t))' "$f" >/dev/null \
        || { echo "\"$2 › $3\" does not exist in $s" >&2; exit 1; }
      edit "$f" '.bloques |= map(if .bloque == $b then .tareas |= map(if .tarea == $t then (if $d == "" then del(.desc) else .desc = $d end) else . end) else . end)' \
        --arg b "$2" --arg t "$3" --arg d "$4" && echo "$s: description · $2 › $3"
    else
      echo "usage: $0 describir \"<block>\" [\"<task>\"] \"<text>\"   (\"\" deletes it)" >&2; exit 2
    fi ;;
  archivar)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] || { echo "usage: $0 archivar \"<session>\" \"<block>\"" >&2; exit 2; }
    f="$DIR/$2.json"
    [ -f "$f" ] && jq -e --arg b "$3" "$NORM"' norm | any(.bloques[]; .bloque == $b)' "$f" >/dev/null || { echo "block \"$3\" does not exist in $2" >&2; exit 1; }
    edit "$f" '.bloques |= map(if .bloque == $b then .archivado = true else . end)' --arg b "$3" && echo "$2: archived · $3" ;;
  quitar)
    # the owner hides one of ITS blocks that duplicates another (a migration leftover), leaving the trace of which
    # block replaces it; not a review, so it never shows as finished
    [ -n "${2:-}" ] && [ "${3:-}" = --duplicado-de ] && [ -n "${4:-}" ] || { echo "usage: $0 quitar \"<block>\" --duplicado-de \"<block that stays>\"" >&2; exit 2; }
    need_session; f="$DIR/$s.json"
    [ -f "$f" ] && jq -e --arg b "$2" "$NORM"' norm | any(.bloques[]; .bloque == $b)' "$f" >/dev/null || { echo "block \"$2\" does not exist in $s" >&2; exit 1; }
    jq -e --arg b "$4" "$NORM"' norm | any(.bloques[]; .bloque == $b and .archivado != true)' "$f" >/dev/null || { echo "the current block \"$4\" does not exist in $s" >&2; exit 1; }
    [ "$2" = "$4" ] && { echo "a block cannot be a duplicate of itself" >&2; exit 2; }
    edit "$f" '.bloques |= map(if .bloque == $b then .archivado = true | .duplicadoDe = $d else . end)' --arg b "$2" --arg d "$4" \
      && echo "$s: removed · $2 (duplicate of $4)" ;;
  decision)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] && [ -n "${4:-}" ] || { echo "usage: $0 decision \"<topic>\" \"<decision>\" \"<why>\" [\"<undo>\"]" >&2; exit 2; }
    s=$(session_name)
    jq -cn --arg ts "$(date -Iseconds)" --arg de "${s:-?}" --arg t "$2" --arg d "$3" --arg p "$4" --arg u "${5:-}" \
      '{ts: $ts, de: $de, tema: $t, decision: $d, porque: $p} + (if $u != "" then {deshacer: $u} else {} end)' >> "$DECISIONS" \
      && echo "decision recorded · $2" ;;
  migrar)
    backup="$(dirname "$DIR")/cartera-backup-v1"
    mkdir -p "$backup" && cp -n "$DIR"/*.json "$backup"/ 2>/dev/null
    for f in "$DIR"/*.json; do
      [ -f "$f" ] || continue
      if jq -e 'type == "array"' "$f" >/dev/null 2>&1; then edit "$f" '.' && echo "migrated: $(basename "$f")"; fi
    done
    echo "backup in $backup" ;;
  *)
    help_text >&2; exit 2 ;;
esac
