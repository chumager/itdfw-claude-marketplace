# _env.sh: the optional local config file of this plugin. It is a library, not a command: every script of the plugin
# sources it as its first line, so the variables they read (CAJARITO_REPO, SESSION_FG_WINDOW, CLAUDE_BROADCAST_FROM...)
# can live in one place on the machine instead of in every crontab and shell profile.
#
# File:    ${XDG_CONFIG_HOME:-$HOME/.config}/claude-sessions/env     (another path: CLAUDE_SESSIONS_ENV)
# Format:  KEY=value, one per line. Only lines that match ^[A-Z_][A-Z0-9_]*= count; anything else (comments with #,
#          blank lines, lowercase keys, `export KEY=...`) is ignored. The value is everything after the first `=`,
#          taken literally (one pair of surrounding quotes is stripped). The file is READ, never executed: `$(...)`,
#          backticks and `$VAR` in a value stay as text.
# Rule:    what is already in the environment wins over the file (an empty variable counts as set).
# Absent:  no file, nothing changes.
# Why not `source`: the file may be shared or edited by a tool, and sourcing it would run whatever it holds.
#
# Sourced as:  _cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
#   (readlink -f, so a script symlinked from ~/bin still finds the _env.sh that lives next to the real one)

# Reads the config file and exports each key that is not already in the environment.
# Defined and called here, then removed, so a sourcing script keeps no helper behind.
_claude_sessions_load_env() {
  local file="${CLAUDE_SESSIONS_ENV:-${XDG_CONFIG_HOME:-${HOME:-}/.config}/claude-sessions/env}" line key val
  [ -r "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    [[ $line =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
    key=${BASH_REMATCH[1]}; val=${BASH_REMATCH[2]}
    [ -n "${!key+x}" ] && continue
    case $val in
      \"*\") val=${val#\"}; val=${val%\"} ;;
      \'*\') val=${val#\'}; val=${val%\'} ;;
    esac
    export "$key=$val"
  done < "$file"
  return 0
}
_claude_sessions_load_env
unset -f _claude_sessions_load_env
