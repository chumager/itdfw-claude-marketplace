# `git stash` is used by nobody but the owner: to set a file aside, it is copied

No agent or session uses `git stash`, `stash pop` or `stash apply`: the stack is the owner's and holds his work. To compare against the previous code, the file is copied to `$CLAUDE_JOB_DIR/tmp` and restored from there, or read with `git show HEAD:<path>`.

Every brief that asks to compare against the previous state says "copy the file to tmp", never "stash".
