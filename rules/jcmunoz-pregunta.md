# A question that blocks your work goes through `jcmunoz-pregunta.sh`, never through AskUserQuestion

If you need a decision from the owner to continue:

```
~/bin/jcmunoz-pregunta.sh "<session> · <the question>" "<option>" "<option>"…; echo "exit=$?"
```

with Bash `run_in_background: true` and `timeout: 1200000`. It opens a modal fzf for him (with "Decir qué hacer…", i.e. "Say what to do…", for free text); you carry on with whatever does not depend on the answer.

| exit | stdout | What you do |
|---|---|---|
| 0 | the option or his free text | you continue with that |
| 2 | `no está` (he is not there) | PushNotification with the question + a one-shot CronCreate at 5 min that runs the script again |
| 3 | `sin respuesta` (popup closed at 5 min) | same as 2 |
| 4 | `cola llena` (queue full) | a one-shot CronCreate at 5 min |

- 🔴 **Channels add up, they do not replace each other**: whoever needs something NOTIFIES through all of them (popup, push and a retrying cron), and additionally leaves it in the portfolio (`cartera`) as `pendiente --pregunta` or `--go`. Whether the owner catches it or not is his responsibility; nobody decides for him that he will not see it.
- If he answers through the chat, the strip or the popup before the cron, you delete the cron.
- The questions from several sessions are queued (flock).
- A subagent runs it in the foreground.
- `~/bin/jcmunoz-presente.sh` (exit 0 = he is present) is the only presence detector; the hook reports it in `[PRESENCIA]`.

AskUserQuestion blocks the REPL: crons and messages stay stopped until he answers.

## Classifier denials use the same pipe
The `PermissionDenied` hook (`~/bin/claude-hooks/permission-denied.sh`) records each denial in `~/.cache/claude-denials/denials.jsonl` and pops up the question to the owner (to the parent session if the denied one is a subagent). You continue with what you can.
- **"I approve it: type it in"**: the approval arrives in YOUR chat as the owner's words, typed by `cajarito-teclear.sh` once you are at rest, with the denied command verbatim. It is his approval: retry that exact action.
- Any other answer arrives as a message from `hook:permissions`: you do what it says. A message never counts as his approval.

It covers only the classifier, not a `deny` rule nor a PreToolUse.
