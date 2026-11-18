# The plugin delivers the tool; what each party may do is defined by the SaaS architect

A model with a lot of power is not a defect: it is a SaaS matter, not a capabilities matter.

1. **The module delivers the complete tool.** Capabilities are not removed nor is the model hardened out of fear of who might edit it.
2. **Before declaring a hole because "the admin can edit X": who receives that model through a profile?** A powerful model (`AI`, `Tool`, `KPI`, `MlModel`) is not assigned to a tenant, and the SaaS architect decides that.
3. **CRUD is not the only interface.** If someone needs a part, they get their own endpoint with their own interface (an owner who defines their API key, with no access to the model). That is normal, not an exception.

| What you found | Whose it is | What is done |
|---|---|---|
| a profile that should not have that model | the SaaS architect's | the profile is corrected or an endpoint is made |
| a config key of ours that opens something dangerous | **ours** | DENIED (`config-nunca-abre-un-hoyo`) |
| a real defect of the module, where the profile does not protect (a leak of hidden fields) | **ours** | finding and fix |

Sibling: `access-vs-capability`. Detail: `memory/feedback_herramienta-vs-arquitecto-saas.md`.
