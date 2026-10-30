# ITDFW — Claude Code marketplace

Two plugins with the skills to work on the ITDFW framework.

| Plugin | For |
|---|---|
| `itdfw` | developing on the framework: models, types, endpoints, plugins, front, deploy config, TDD, definition of done |
| `itdfw-internal` | the framework team: documentation layout, new front libraries |

## Install

On the dev machine (loads in place, edits apply on the next session or `/reload-plugins`):

```sh
claude plugin marketplace add /path/to/itdfw-claude-marketplace
claude plugin install itdfw@itdfw
```

From git (other machines): add the repo URL instead of the path, and set `autoUpdate: true` on the marketplace in
`extraKnownMarketplaces` so each commit reaches it. `plugin.json` has no `version` on purpose: the plugin tracks commits.
Force an update with `claude plugin update itdfw@itdfw`.
