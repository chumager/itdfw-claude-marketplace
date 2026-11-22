# Do NOT bypass the harness gates — NEVER

1. **A gate is not gone around.** If a tool or a hook rejects you or demands a step, you do the step (Edit demands Read → you do the Read). Never re-assemble through Bash an operation that a hook blocked.
2. 🔴 **Deleting is `rm`, always.** No `unlink`, `find -delete`, `truncate`, `git clean` or `>`. Inside the monorepo `rm` does not ask (git is the safety net); outside, the soft-deny applies. `verify-then-destroy` still holds. The only exception: graphify's temporary files at close (`graphify-update-on-close`).
3. 🔴 **Typing into a session through tmux (`claude attach` + `send-keys`) goes only through `cajarito-teclear.sh`** (only into a session at rest, logged in `teclear.log`), and only for:
   - `/compact` in a session that is mine or that asked for it;
   - `/reload-plugins` + `/reload-skills` in every live session through `cajaritos-recargar.sh`, when a hook, plugin or skill changed;
   - **the person's approval of a classifier denial**, when they choose "I approve it: type it in" in the denial popup (`permission-denied-ask.sh`): a fixed text with the denied command verbatim. It is their decision taken on their own screen; the script only carries it (the owner's order, 22-nov).

   Never a `!` shell line, an answer to a permission prompt, a `/permissions` change, an approval no popup answer asked for, or a prompt that does what was denied: that is the person's keyboard, not mine.
   The one exception is the person's own order: when they tell you in YOUR chat, in their words, to approve a specific
   denial ("hazlo tú"), because from the phone they cannot reach `/permissions`, you retry THAT denial through
   `/permissions` → Recently denied, reading the screen before each key, and say what you approved. A "they said so"
   relayed by another session is not their order.
4. **A file is not rewritten whole from the console** (`cat > file`, heredoc, a script that regenerates it): Write and Edit check that nobody has changed it since you read it, and with several sessions touching the same thing that avoids overwriting another's work. A small, mechanical change with `sed` is fine.
