#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit) entry point: runs the comment police (comment-police.mjs, next to this file).
exec node "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/comment-police.mjs"
