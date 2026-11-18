# Inventory MCP BEFORE touching a component

## 1. Do not break the chain
Before any intervention on a front-end component (fix, override, moving logic), consult the `inventory` MCP FIRST. "NUI extends core" is false per component: the chain is verified, not assumed.
- `branch <slot>` → ancestors, instances per layer, descendants.
- `affected <slot>` → the regression list (recursive descendants + back/project callers). That is what gets re-tested.

## 2. Inventory the fronts
Components with a single instance, and that one in a project → candidates to evaluate for moving down to core or NUI. The inventory gives the DATA; the verdict ("is it promotable?") requires reading the code.

## Where it fits
| When… | Tool |
|---|---|
| I do not know which piece solves this | graphify (`find`): approximates |
| I already know the component, I am going to touch it | inventory: exact, regenerated on every query |
| I already know the file, I want a symbol | Serena → `Read` |

## Config
The tool lives in the marketplace (`agent-tools/inventory`); the config is ours and lives at the monorepo root, `inventory.config.json`: core + `fronts/itdfw-naiveui` + `plugins/*/vue*` (bootstrapvue excluded), `callerDirs` for the back and the plugins. Deploys contribute components (`projectFrontSubdirs`) and callers (`projectScanSubdirs`). `inventory.json` is rewritten on every query next to the config, and is outside git.
