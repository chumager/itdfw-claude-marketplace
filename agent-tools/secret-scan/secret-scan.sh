#!/usr/bin/env bash
# secret-scan.sh: secret scan with gitleaks (a pinned version) plus the rules of secret-scan.toml. It is what the
# automatic push (push-develop.sh) and any publish gate call before something leaves the machine.
#
#   secret-scan.sh [--strict] <git-range>        scans the diff of those commits (e.g. origin/develop..HEAD)
#   secret-scan.sh [--strict] --files <paths…>   scans those files as they are on disk
#
# Output: one line per finding, "BLOQUEA|AVISA <file>:<line> <rule>", never the secret. The two words are a stable
#         contract that callers match on (BLOQUEA = blocks, AVISA = warns), kept as they were.
# False positives reviewed by hand: one fingerprint per line in secret-scan.ignore (the .gitleaksignore format).
# Severity: the rules tagged "warn" (own hosts and paths) only warn; with --strict they block too.
# Exit: 0 clean or only warnings · 1 something blocks · 2 it could not scan (gitleaks missing, bad range, bad config).
#
# Env (each can also go in ${XDG_CONFIG_HOME:-$HOME/.config}/secret-scan/env, see _env.sh; the environment wins):
#   SECRET_SCAN_OWN_HOSTS   a regex (Go/RE2 syntax) for the hostnames that are yours: they become the "warn" rule
#                           itdfw-host-propio. Unset or empty: no such rule
#   SECRET_SCAN_OWN_PATHS   a regex for paths of your machine: the "warn" rule itdfw-ruta-propia. Unset: a person's
#                           home directory (/home/<name>/, /Users/<name>/). Set to empty: no such rule.
#                           /etc/itdfw/ (the documented path of the product) is never reported by this rule
#   SECRET_SCAN_ALLOW_PATHS a regex for files to leave out of the scan entirely (build output of third-party code)
#   SECRET_SCAN_IGNORE      the fingerprint file (default: secret-scan.ignore next to this script)
#   SECRET_SCAN_GITLEAKS    the gitleaks binary to use (default: gitleaks from the PATH, then ~/.local/bin). When it is
#                           set and is not executable the script stops (exit 2) and installs nothing
#   SECRET_SCAN_NO_INSTALL  1 = never try to install gitleaks (exit 2 when it is missing)
#   SECRET_SCAN_ENV         another path for the config file
# Installing gitleaks, when it is missing and the above does not forbid it: `sudo -n apt-get install gitleaks` and, if
# that fails, the release from GitHub checked against a sha256 into ~/.local/bin.
set -u
HERE="$(dirname "$(readlink -f "$0")")"
_ss_env="$HERE/_env.sh"; [ -r "$_ss_env" ] && . "$_ss_env"; unset _ss_env
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac

GL_VERSION=8.16.0
GL_SHA256=f8d4fabedaeaabd2a3e7e7b96394b8ddeff0be32941a1719aedee08fc8678601   # gitleaks_8.16.0_linux_x64.tar.gz
BASE_CONFIG="$HERE/secret-scan.toml"
IGNORE="${SECRET_SCAN_IGNORE:-$HERE/secret-scan.ignore}"   # fingerprints commit:file:rule:line (or file:rule:line)
DEFAULT_OWN_PATHS='/home/[A-Za-z_][A-Za-z0-9._-]*/|/Users/[A-Za-z0-9._-]+/'

strict=0
[ "${1:-}" = "--strict" ] && { strict=1; shift; }
[ $# -ge 1 ] || { echo "usage: secret-scan.sh [--strict] <git-range> | --files <paths…>" >&2; exit 2; }
[ -f "$BASE_CONFIG" ] || { echo "✗ missing config $BASE_CONFIG" >&2; exit 2; }
command -v jq >/dev/null || { echo "✗ jq is missing" >&2; exit 2; }

# gitleaks: apt (Debian trixie ships it) and, if that cannot be done, the GitHub release verified by sha256 into ~/.local/bin.
install_gitleaks() {
  sudo -n apt-get install -y gitleaks >/dev/null 2>&1 && command -v gitleaks >/dev/null && return 0
  local tmp; tmp=$(mktemp -d) || return 1
  local tgz="$tmp/gitleaks_${GL_VERSION}_linux_x64.tar.gz"
  curl -fsSL -o "$tgz" "https://github.com/gitleaks/gitleaks/releases/download/v${GL_VERSION}/gitleaks_${GL_VERSION}_linux_x64.tar.gz" &&
    echo "$GL_SHA256  $tgz" | sha256sum -c --quiet - &&
    tar -xzf "$tgz" -C "$tmp" gitleaks &&
    mkdir -p "$HOME/.local/bin" && install -m 755 "$tmp/gitleaks" "$HOME/.local/bin/gitleaks"
}
if [ -n "${SECRET_SCAN_GITLEAKS:-}" ]; then
  GL=$SECRET_SCAN_GITLEAKS
  [ -x "$GL" ] || { echo "✗ SECRET_SCAN_GITLEAKS is not executable: $GL" >&2; exit 2; }
else
  GL=$(command -v gitleaks || { [ -x "$HOME/.local/bin/gitleaks" ] && echo "$HOME/.local/bin/gitleaks"; })
  if [ -z "$GL" ]; then
    [ "${SECRET_SCAN_NO_INSTALL:-}" = 1 ] && { echo "✗ gitleaks is missing (SECRET_SCAN_NO_INSTALL=1: not installing it)" >&2; exit 2; }
    install_gitleaks || { echo "✗ could not install gitleaks $GL_VERSION" >&2; exit 2; }
    GL=$(command -v gitleaks || echo "$HOME/.local/bin/gitleaks")
  fi
fi

# the config file needs the .toml suffix: gitleaks 8.16 takes the format from it and, without it, runs on its defaults alone
report=$(mktemp); cfg=$(mktemp --suffix=.toml); trap 'rm -f "$report" "$report".* "$cfg"' EXIT

# The config of this run: the fixed rules, plus the own-host and own-path rules and the allowlist built from the env.
# A value that holds ''' would end the TOML literal string early, so it is refused instead of quoted.
for v in SECRET_SCAN_OWN_HOSTS SECRET_SCAN_OWN_PATHS SECRET_SCAN_ALLOW_PATHS; do
  case "${!v:-}" in *"'''"*) echo "✗ $v cannot contain three single quotes in a row" >&2; exit 2 ;; esac
done
own_paths="${SECRET_SCAN_OWN_PATHS-$DEFAULT_OWN_PATHS}"
{
  cat "$BASE_CONFIG"
  if [ -n "${SECRET_SCAN_OWN_HOSTS:-}" ]; then
    printf '\n[[rules]]\nid = "itdfw-host-propio"\ndescription = "own host (SECRET_SCAN_OWN_HOSTS)"\nregex = '"'''"'%s'"'''"'\ntags = ["warn"]\n' "$SECRET_SCAN_OWN_HOSTS"
  fi
  if [ -n "$own_paths" ]; then
    # /etc/itdfw/ is where the product documents its deploy config: a line that names it is not a private path
    printf '\n[[rules]]\nid = "itdfw-ruta-propia"\ndescription = "path of this machine (SECRET_SCAN_OWN_PATHS)"\nregex = '"'''"'%s'"'''"'\ntags = ["warn"]\n[rules.allowlist]\ndescription = "/etc/itdfw/ is the documented path of the product, not a private one"\nregexTarget = "line"\nregexes = ['"'''"'/etc/itdfw/'"'''"']\n' "$own_paths"
  fi
  printf '\n[allowlist]\ndescription = "a line marked as a made-up fixture%s"\nregexTarget = "line"\nregexes = ['"'''"'//\\s*scan-ok'"'''"', '"'''"'#\\s*scan-ok'"'''"']\n' "${SECRET_SCAN_ALLOW_PATHS:+, and the paths of SECRET_SCAN_ALLOW_PATHS}"
  [ -n "${SECRET_SCAN_ALLOW_PATHS:-}" ] && printf 'paths = ['"'''"'%s'"'''"']\n' "$SECRET_SCAN_ALLOW_PATHS"
} >"$cfg"

run_gl() {   # run_gl <out.json> <gitleaks args…>; exit 0/1 = it scanned, anything else = error
  "$GL" detect --no-banner -l error --redact -c "$cfg" -f json -r "$1" "${@:2}" >/dev/null 2>"$1.err"
  local rc=$?
  [ $rc -le 1 ] || { sed 's/^/  gitleaks: /' "$1.err" >&2; return 2; }
  [ -s "$1" ] || echo '[]' >"$1"
}

if [ "$1" = "--files" ]; then
  shift
  echo '[]' >"$report"
  for f in "$@"; do
    [ -f "$f" ] || continue
    run_gl "$report.one" --no-git -s "$f" || exit 2
    # with --no-git on one file gitleaks reports the path as it is; the one the caller asked for is set here
    jq --arg f "$f" '[.[] | .File = $f | .Fingerprint = "\($f):\(.RuleID):\(.StartLine)"]' "$report.one" |
      jq -s 'add' "$report" - >"$report.acc" && mv "$report.acc" "$report"
  done
else
  range=$1
  git rev-parse --git-dir >/dev/null 2>&1 || { echo "✗ not a git repository" >&2; exit 2; }
  # an empty range (nothing to push): clean without calling gitleaks
  git rev-list "$range" >/dev/null 2>&1 || { echo "✗ invalid range: $range" >&2; exit 2; }
  [ -z "$(git rev-list -n1 "$range")" ] && exit 0
  run_gl "$report" -s "$(git rev-parse --show-toplevel)" --log-opts "$range" || exit 2
fi

# fingerprints reviewed by hand as false positives (secret-scan.ignore); lines starting with # are comments
if [ -f "$IGNORE" ]; then
  jq --rawfile ig "$IGNORE" '
    ($ig | split("\n") | map(sub("\\s+$"; "")) | map(select(length > 0 and (startswith("#") | not)))) as $skip
    | [.[] | select(.Fingerprint as $fp | $skip | index($fp) | not)]' "$report" >"$report.f" && mv "$report.f" "$report"
fi

# one line per finding (file:line rule), deduplicated in case the same finding shows in two commits
jq -r --argjson strict "$strict" '
  .[] | (if (.Tags | index("warn")) and $strict == 0 then "AVISA" else "BLOQUEA" end) as $sev
  | "\($sev) \(.File):\(.StartLine) \(.RuleID)"' "$report" | sort -u | sort -k1,1 -s
jq -e --argjson strict "$strict" 'any(.[]; (.Tags | index("warn") | not) or $strict == 1)' "$report" >/dev/null && exit 1
exit 0
