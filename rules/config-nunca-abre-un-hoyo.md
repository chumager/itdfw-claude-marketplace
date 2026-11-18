# An FW config NEVER opens a security hole: what is dangerous is DENIED, fixed in the code

A configuration key may turn on conveniences, but never open something that allows harming third parties (redefining content, writing other people's data, bypassing the AAA). That stays denied in the code, with no key, even if the customer asks for it.

| Who opens it | Whose hole it is |
|---|---|
| the customer assigns a function wrongly in a profile (AAA) | the customer's |
| a config of ours enables something dangerous | **ours** |

- When designing or reviewing a config: *with this key, can an anonymous user or one without permission change what another sees?* If so, the capability goes through the AAA (an assignable function), not through config.
- One found like that in a TDD, plugin or review is an immediate DENIED: HIGH finding, no discussion.
- HTML sanitizing does not cover this: an `https` link to a fake site is valid HTML.

A model that an admin can edit is not a config: that is decided by the profile (`el-plugin-entrega-la-herramienta`).

Complements `access-vs-capability`.
