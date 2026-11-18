# Skills first, and close the gap if the skill fails

For any work on an area that has a skill (implement, diagnose, understand, answer):

1. **Start with the skill**: `SKILL.md` and the relevant reference BEFORE reading FW code.
2. If it does not have the information → only then the code.
3. **Document the gap in the skill** as part of the fix, and record it on the spot with `mcp__itdfw-graph__reportGap` (the need, in language of intent).

If you had to go to the code, the skill had a gap. Closing it is what improves it with use.

## 🔴 The problem is fixed, not the skill

| What you found | Where it goes | The skill |
|---|---|---|
| the skill did not say how to do X | to the skill | it is ENRICHED |
| the code does NOT do what the skill says | finding (`current/bugs-cross-cutting.md`) + fix of the code | IS NOT TOUCHED |

Writing in the skill "this does not work" canonizes the defect as design. The question: *does the skill lie or does the code fail?*

## Red flag
- `grep`/`Read` on FW code before opening the reference → STOP.
- Taking a capability away from a skill because you tried and it did not work → STOP: it is a finding about the code.

Complements `load-skill-before-implementing`.
