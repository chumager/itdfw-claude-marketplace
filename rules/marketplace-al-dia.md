# The public repo (`itdfw-claude-marketplace`) is kept up to date by the CTO

Everything the README claims about a piece has to be true today: test counts, what it exposes, `file:line` paths, limits and what depends on the framework.

| When | What the CTO does |
|---|---|
| a change in a marketplace piece (code, tests, `~/bin` scripts that point there) | in the same commit: its README and the root README with the numbers the suite gave, not the remembered ones |
| a piece is added | its row in the map, in "What depends on ITDFW" and in "Honest limits", and its entry in `marketplace.json` |
| every commit | it is public at once: `scripts/post-commit.sh` runs every suite, scans and pushes to `main`. So before committing, the privacy sweep of what goes in (names, clients, health, own hosts and paths) is done by the one who commits; the scan only stops secrets |

- A session that touches something that lives in the marketplace notifies the CTO with what changed; the README is updated by the CTO.
- An artifact that the owner is reviewing is not touched until he leaves his closing comment.
