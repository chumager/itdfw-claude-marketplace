# Browser tests → PROGRAMMATIC (Playwright spec), NEVER through an MCP

Every verification in a browser, mine or an agent's, is a `@playwright/test` spec that runs from the console (`npx playwright test <path> --reporter=line`). Browser MCPs are not used to test: not for "a quick look", not for a screenshot, not for a snapshot.

An MCP brings the entire page into the context on every call and every step is a round trip through the model: expensive in tokens and slow. A spec costs one line per case, runs in seconds and remains as the e2e that `itdfw-completeness` demands.

## Where it lives
- With the unit it tests: `plugins/<x>/test/e2e/*.spec.js`, `fronts/itdfw-naiveui/test/*.spec.js`.
- Pattern: `fronts/itdfw-naiveui/test/nav-items.spec.js`.
- `page.on("console")` in the spec: zero Vue errors/warnings is one more case.

Exception: the user walkthrough of `sombrero-de-usuario`, by hand, once; what is found becomes a case of the spec.

## Red flag
`browser_navigate`/`browser_snapshot`/`browser_take_screenshot` to verify, or "verify with Playwright (MCP)" in a brief → STOP. It is a spec.
