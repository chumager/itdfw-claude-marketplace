# _sessions.sh: a library (sourced, not run) for the hooks that talk to the person or to other sessions through the
# scripts of the itdfw-sessions plugin (owner-present.sh, ask-owner.sh, claude-session-msg.sh).
#
# It finds the directory that holds those scripts, in this order:
#   1. $ITDFW_SESSIONS_BIN, when it is set and holds owner-present.sh
#   2. the PATH (Claude Code puts the bin/ of an enabled plugin there for the Bash tool; a cron or a shell can do the same)
#   3. ../../itdfw-sessions/bin next to this plugin, the layout of a checkout of the marketplace
# Then it loads the sessions plugin's config file through that directory's _env.sh (the same file and rules the
# sessions scripts use, so the name of the person is configured once) and sets OWNER, the name the person goes by in
# the texts these hooks write: $CLAUDE_BROADCAST_FROM, then "user".
#
# Provides:  sessions_script <name>   the full path of a sessions-plugin script (or the bare name when none was found)
#            OWNER                    the person's name
# Needs bash: the sessions _env.sh does.

_sessions_dir() {
  local here found
  if [ -n "${ITDFW_SESSIONS_BIN:-}" ] && [ -x "$ITDFW_SESSIONS_BIN/owner-present.sh" ]; then
    echo "$ITDFW_SESSIONS_BIN"; return
  fi
  found=$(command -v owner-present.sh) && { dirname "$(readlink -f "$found")"; return; }
  here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
  [ -x "$here/../../itdfw-sessions/bin/owner-present.sh" ] && { (cd "$here/../../itdfw-sessions/bin" && pwd); return; }
  return 0
}

SESSIONS_DIR=$(_sessions_dir)

# Prints the path of a script of the sessions plugin; the bare name when the directory was not found, so the caller
# fails with the shell's own "command not found" instead of running something else.
sessions_script() {
  if [ -n "$SESSIONS_DIR" ]; then echo "$SESSIONS_DIR/$1"; else echo "$1"; fi
}

[ -n "$SESSIONS_DIR" ] && [ -r "$SESSIONS_DIR/_env.sh" ] && . "$SESSIONS_DIR/_env.sh"
OWNER=${CLAUDE_BROADCAST_FROM:-user}
