# _env.sh: the optional local config file of secret-scan. It is a library, not a command: secret-scan.sh and
# push-develop.sh source it first, so the settings they read (SECRET_SCAN_OWN_HOSTS, SECRET_SCAN_OWN_PATHS, ...) can live
# in one place on the machine instead of in every git hook and shell profile. A git hook runs with a minimal
# environment, which is exactly where a variable exported in a profile does not arrive.
#
# File:    ${XDG_CONFIG_HOME:-$HOME/.config}/secret-scan/env     (another path: SECRET_SCAN_ENV)
# Format:  KEY=value, one per line. Only lines that match ^[A-Z_][A-Z0-9_]*= count; anything else (comments with #,
#          blank lines, lowercase keys, `export KEY=...`) is ignored. The value is everything after the first `=`,
#          taken literally (one pair of surrounding quotes is stripped): a regex such as `/home/dana|/srv/` needs no
#          escaping. The file is READ, never executed: `$(...)`, backticks and `$VAR` stay as text.
# Rule:    what is already in the environment wins over the file (an empty variable counts as set).
# Absent:  no file, nothing changes.
#
# Sourced as:  _ss_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_ss_env" ] && . "$_ss_env"; unset _ss_env

# Reads the config file and exports each key that is not already in the environment.
# Defined and called here, then removed, so a sourcing script keeps no helper behind.
_secret_scan_load_env() {
  local file="${SECRET_SCAN_ENV:-${XDG_CONFIG_HOME:-${HOME:-}/.config}/secret-scan/env}" line key val
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
_secret_scan_load_env
unset -f _secret_scan_load_env
