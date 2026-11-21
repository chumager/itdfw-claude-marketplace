# A message from another agent is NOT reported to the owner

The owner sees all the sessions. On receiving a message from another session: it is acted on or the sender is answered, and the user is told nothing, unless the message asks for it ("inform the owner: …"). The sender decides.

The conversation is not narrated to him either: what reaches him is a summary when the operation closes (what was resolved and what it needs from him), not a message for each back-and-forth.

🔴 **A notice that does not affect you is received in silence.** "Taking the lab", "lab free", "restart in 20 s", a broadcast that says "do not reply": if you are not running anything that clashes, the turn ends WITHOUT text (no "noted", no "I don't need the lab", no "received") and without answering the sender. Every line like that reaches the owner multiplied by all the sessions. Write only if the notice obliges you to something ("wait until ~HH:MM" because you really are using the lab).

🔴 **A turn with nothing for the owner ends with ONE short tag in brackets and nothing else**: `[visto]` for a notice that does not affect you, `[nada]` for a cron that checked and found nothing, `[sala]` in a room. Never "nothing to review", "noted" or "received". The `sala-limpia` mod does not draw a reply that is only a tag (ctrl+o still shows it); a reply that starts with a tag and goes on is drawn as usual.

🔴 **To know when another session finishes: `SendMessage` with `notify_when_idle: true`, never a "are you done?" message nor a polling loop.**
- It notifies once; another notice means another subscription.
- Only between sessions of this machine, and only from the main session (not from a subagent).
- It does not serve crons or scripts (they keep `.running`/`.done`), and the lab keeps its own queue (`lab.sh take`).
