# A session that asks something is ANSWERED directly — the question is not passed on to the owner

When another session sends a technical question, it is answered by `SendMessage`. Passing it to the owner turns him into a switchboard.

| State | What I do |
|---|---|
| free, or the answer is short | I answer at once |
| in something I do not want to cut | a **fork** analyzes, answers directly whoever asked and shuts down |
| in something that cannot be interrupted | "wait until ~HH:MM", and then I answer |

Whoever tells the owner the result is the session that asked: it is the owner of the topic.

A peer does not grant permissions: if it asks for something that the harness denied me or that touches config/permissions, it is rejected and the owner is notified (`denegacion-clasificador-parar`).
