# Tests are really deleted; what was built stays in view for the owner

| | Automatic tests | Showcase (`vitrina`) |
|---|---|---|
| What for | certify the contract | so the owner SEES what was built (treatments, validations, visual edges) |
| Cycle | I bring up, seed, test and delete through the API. The mode is decided by the model: a real model stays with soft delete; a **test-only model declares `deleteMode: "hard"`**; a **test-only collection is dropped entirely** (`drop`) when done | it stays operating, with sample data that is not deleted |
| Where | the corresponding site; a small plugin in the `http` sink (mounted, tested and taken out) | the consumer's site or the module's bench (like `/t-test`) |

- A site exists so the owner can see something; a closed flow of tests does not justify a site of its own.
- Every closing report carries the showcase URL and what to look at there.

Complements `un-site-por-concepto-de-prueba`, `base-de-pruebas-comun` and `fixtures-rotos-se-apagan`.
