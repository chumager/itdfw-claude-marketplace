# Every fix checks whether it closes a finding, and if it does, it closes it in the same commit

When finishing a tested fix, before the commit: does it correct a finding in `claude-docs/current/bugs-cross-cutting.md`, or a row of one? Look by number, file or symptom: the fix almost never starts from the finding.

1. The body is emptied and ONE line remains:
   `## Finding #N: <title> — MOVED → <destination> (RESOLVED <date>, <commit>, <package version>)`
2. Destination: where what was learned lives (the skill or `claude-docs/architecture/` if it left a rule; the test that covers it if it was a one-off).
3. If it fixes only one row of a finding with a table: `✅ RESOLVED <date> (<commit>)` on that row; the finding stays.
4. In the same commit as the fix, or the next one of the same turn.

If the list lies, what was resolved gets re-diagnosed or what works is believed broken.
