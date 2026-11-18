# e2e ALWAYS runs with the installed Chrome, and when starting a set it is verified that it is the latest

Every `playwright.config.js` declares `channel: "chrome"`, never the bundled Chromium. When starting an e2e set (not on every run), `google-chrome --version` is compared against the published stable one, it is updated if needed BEFORE writing specs, and the version is noted in the runs TDD. A green against an old browser is a false green.

## Consequences

- A flake of the real Chrome is a data point, not a reason to change browsers.
- 🔴 **An intermittent e2e is resolved in this order:**
  0. **Correlation**: is what changed on the path of the test that fails? If they do not cross, the failure is reported without suspecting the change. If a shared mechanism were broken, all the tests that use it would fail.
  1. **Is there a race in the code?** If there is, fix it.
  2. **If there is no race**: it is the environment's or the spec's. It is verified BY HAND with a card on the module's bench page; if it always works, it is classified as environment.
  - A race that only appears at the spec's speed and never in real use: a low-probability edge, it is noted and fixed if cheap.
- `--trace on` hangs the run: the evidence comes from counters, `page.on("request")`, `error-context.md`.

Complements `cierre-es-la-suite-completa-contra-lo-real` and `e2e-programatico-nunca-mcp`.
