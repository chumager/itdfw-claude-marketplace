# Verify and destroy = TWO steps, NEVER one command

Before any destructive action (rm, deleting code, drop, overwrite, deletion in the DB):

1. **Read-only scouting**: look, count, dry-run, and READ the output.
2. **Evaluate**: present the result (in the core, with the contract's yardstick).
3. **Destroy separately**, after the go-ahead.

Forbidden:
- Chaining verification and destruction in the same command (`grep … && rm …`, `select …; drop …`): the decision was already made before seeing the evidence.
- Presenting the evidence and destroying in the same turn. The why is announced and the GO is awaited, even if it seems obvious.

Without git, in production, in the DB or irreversible: always confirm with the owner.
