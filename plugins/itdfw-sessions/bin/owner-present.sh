#!/usr/bin/env bash
# owner-present.sh: is the person in front of the laptop? It is, when a tmux client is attached. One detector for every
# script and hook that has to decide whether to interrupt the person on screen or to leave a message instead.
# Reliable since a suspended laptop drops off its ssh connection after about two minutes (tcp_retries2 plus the
# server's ClientAlive); before that a dead client stayed listed for ~15 minutes.
#
# Usage:   owner-present.sh
# Reads:   the tmux server's client list (`tmux list-clients`); nothing else
# Writes:  the name of the first attached client on stdout, when there is one
# Exit:    0 a client is attached (its name is printed) · 1 none (silent)
_cs_env="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_env.sh"; [ -r "$_cs_env" ] && . "$_cs_env"; unset _cs_env
case "${1:-}" in -h|--help) echo "Usage: owner-present.sh"; awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
CLIENT=$(tmux list-clients -F '#{client_name}' 2>/dev/null | head -1)
[ -n "$CLIENT" ] || exit 1
echo "$CLIENT"
