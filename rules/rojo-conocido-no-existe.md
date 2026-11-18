# There is no such thing as "the usual red": a test runs at 100 % or something is wrong

A red that is carried along trains people not to look at it, and hides the day it fails for something real (an infra or business-logic change that nobody carried to the test).

| A case in red | What is done |
|---|---|
| the code is wrong | the code is fixed |
| the test went stale (the infra, the logic or the contract changed) | the test is fixed |
| it cannot be covered yet | explicit `fixme`/`skip`, with the why, the condition to come back and the owner, in the test and in the TDD |

- 🔴 A report with N/M that does not explain each red is not a close, even if the reds "were already there". An unexplained earlier red goes to the top of its owner's queue.
- The baseline does not absolve: "the same ones as before" describes a debt, not a green.

Complements `cierre-es-la-suite-completa-contra-lo-real` and `fixtures-rotos-se-apagan`.
