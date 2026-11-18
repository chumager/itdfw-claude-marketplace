#!/usr/bin/env bash
# precompact.sh: PreCompact hook. It runs BEFORE a compaction and prints a directive TO THE COMPACTOR (what goes to
# stdout is added to its instructions): what the summary must keep with the highest priority and what it may drop.
# It ends with "do not spend tokens on what can be re-read", which is the point: what already lives in a file costs a
# pointer in the summary, not a paraphrase.
#
# Usage:   precompact.sh            (the hook payload on stdin is ignored)
# Writes:  stdout only
# Env:     CLAUDE_BROADCAST_FROM, ITDFW_SESSIONS_BIN   the person's name in the text comes from there (see _sessions.sh)
# Exit:    0 always
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/_sessions.sh"
case "${1:-}" in -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac

cat <<EOF
=== COMPACTOR DIRECTIVE ===

COMPACTION PRIORITY:
Preserve with the highest priority the ACTIVE WORK OF THIS SESSION, whatever its kind: code and design, technical
decisions, commercial topics, strategy or the personal matters of $OWNER. What matters is what this session has in
progress, not the category.
- The decisions made and why; what is still pending and who it depends on.
- $OWNER's own words in their requests and corrections.

Leave at lower priority (or discardable):
- What already lives in files (the TDD, the docs, memory, the work board): a pointer is enough.
- Tool outputs, logs and file reads that were already digested.
- Operational hooks and notices that changed nothing.
- Findings / bugs already recorded (they live in their findings file: read it on demand). The detail of a security
  finding is NOT summarized: only its number and title.

Do NOT spend tokens summarizing what is discardable: it is recovered with Read on demand after the compaction.
EOF
exit 0
