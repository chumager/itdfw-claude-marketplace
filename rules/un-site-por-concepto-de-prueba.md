# Each thing is tested in ITS site of the dev deploy — one per concept

| What is being done | Where it is tested |
|---|---|
| a plugin | that plugin's site (one is defined if none exists) |
| a set of plugins that form a concept | a single site for the concept |
| the core (`core` session: back, `libs/*`, NUI) | the `http` site |
| a fix in the core to unblock a plugin | in `http` without the plugin, and in the plugin's site with it |

- 🔴 **`http` is the core's workshop**: `core` transpiles only `http`. What is new is born in the `http` site's layer (`site/src/components/`, its `mongooseTypes/`), tested there, and with everything green it is promoted to the core.
- 🔴 **A new site is brought up by ourselves with `sudo -n`** (nginx, `/etc/hosts`, `/etc/itdfw/*.yaml`); the owner is never asked for it. The brief of an agent that needs a site says so explicitly. A micro plugin may have its bench in its consumer's site.
- Everything about the test lives in that site (fixtures, onDev models, `BASE_URL`, the `-H` of `tests/back`). Nobody builds or seeds in another concept's site.

Complements `back-se-edita-con-permiso-de-todas-las-sesiones` (when) and `lab-compartido-el-que-modifica-prueba-primero`.
