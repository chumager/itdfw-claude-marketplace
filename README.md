# ITDFW — Claude Code marketplace

The `itdfw` plugin: the skills to build on the ITDFW framework (models, types, endpoints, plugins, front, new front
libraries, deploy config, TDD, definition of done).

## Install

On the dev machine (loads in place, edits apply on the next session or `/reload-plugins`):

```sh
claude plugin marketplace add /path/to/itdfw-claude-marketplace
claude plugin install itdfw@itdfw
```

A session that was already open sees the plugin after `/reload-plugins` or a restart (`/reload-skills` does not load
a newly installed plugin).

From git (other machines): add the repo URL instead of the path, and set `autoUpdate: true` on the marketplace in
`extraKnownMarketplaces` so each commit reaches it. `plugin.json` has no `version` on purpose: the plugin tracks commits.
Force an update with `claude plugin update itdfw@itdfw`.
