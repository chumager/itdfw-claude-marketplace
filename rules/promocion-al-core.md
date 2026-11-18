# What a PMO needs is born in its plugin or project; moving it up to the core is evaluated afterwards

| Moment | Who | What |
|---|---|---|
| the PMO needs something | the PMO | asks `core` for it as a need, not as a solution (`core-por-mensaje-a-core`) |
| does it touch the base? | `core` | if it serves everyone, he does it in the base; if not, he hands it back to the PMO with where to do it in its plugin or project |
| the PMO closes its delivery | `CTO` and `core` | review the PMO's new code and look for what is worth moving up to core or NUI |
| the proposal | `CTO` | takes it to the owner: what moves up, why it serves everyone and what it costs. Without his GO nothing moves |

- 🔴 **What is specific never goes straight into the core**, even if small: the core is what serves everyone. A project's injections, mixins and inits belong to the PMO.
- `core` and the `CTO` make sure that what a PMO asks for does not blow up the base.
- NUI follows the same rule with `designer`: a plugin's UI lives in the plugin, and moving it up is evaluated if it serves everyone.
