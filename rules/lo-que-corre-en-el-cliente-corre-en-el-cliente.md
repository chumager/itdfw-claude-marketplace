# What can run on the client, runs on the client

It is common sense, not squeezing the client: the most ordinary phone has more machine for its own work than our servers, and does not even notice. Before designing work in the back, two questions:

1. **Can the client execute it?** If so, it goes there. The back composes and delivers the object (an XLS, a PDF, a photo that is shrunk before being uploaded).
2. **Does what we hand over carry something that must be hidden?** Secrets, tokens, keys, hidden business logic. That stays in the back: the private key is not sent so that the browser signs.

🔴 **What the client decides protects nothing.** What is shown, what is hidden and what can be done is decided by the back, and only what corresponds reaches the client. Hiding it on the screen is not hiding it: the protocol delivers it anyway and anyone reads it underneath. Sending the whole schema so the browser decides leaves the back staring at the ceiling.

What comes from the client is verified in the back, cheaply: type, size, signature, permissions. Verifying is not redoing.

## Red flag
A queue, spool or semaphore in the back for per-user work → STOP: first question.

Complements `access-vs-capability` and `memory/feedback_lo-que-corre-en-el-cliente.md`.
