# You fixed something in a package → BUMP its version in the same turn

Every change in a publishable (`plugins/*`, `libs/*`, `back/itdfw`, `fronts/*`) carries its bump together with the change.

| What you did | Bump |
|---|---|
| fixed something without changing the interface | patch |
| added a capability | minor |
| broke something existing | major |

🔴 **Current exception: ALWAYS MINOR until further notice**, even if it breaks, to keep the FW aligned. When a major is needed, everything goes up together.

## 🔴 Against the registry, not against the previous diff
The question is which version is published and what changed since that one:
```
~/bin/itdfw-deps.sh drift        # from the monorepo root; requires login and fails without it
```
A bump without the drift in view is guessing.

The commit is another decision (`commit-al-cerrar`). Release flow: `memory/reference_release-flow.md`.

🔴 **Publishing is NOT a session's job.** The owning session bumps and commits; publishing is the release, which the owner and `itdfw` decide and the `CTO` executes. "Publish X" does not go in the portfolio (`cartera`): the bumped package is reported to the CTO, who adds it to his "Release" block (a single GO from the owner for everything that is ready).
🔴 **A release is made out of operational need**: when an external machine has to test or deploy the new code, not because bumps have accumulated. In the meantime the CTO keeps it certified and ready, without asking for the GO.
