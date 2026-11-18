# A test never takes longer than a person doing the same thing by hand

The owner checks the DOM, logs and network by hand faster than the suite: if the machine is slower, the automation is badly made. The yardstick of every spec is the time of a person doing that walkthrough.

| Instead of | Wait for |
|---|---|
| a fixed time (`waitForTimeout`, `sleep`, a `setTimeout` in a promise) | the signal: the visible locator, the endpoint's response (`waitForResponse`), the text that changed |
| `networkidle` (with SSE or polling it never settles) | the response or the element that matters |
| a back restart with a long wait | poll the health endpoint every ~200 ms until it answers, with a cap |
| a new context and login for every test | **like a person: you sign in once.** The `test` from `tests/e2e/lib/session.js` brings the `signedIn` fixture (one session per worker); for another user or the anonymous one, `sharedPage(test, {signIn, use})`, one session per describe. Pattern: `tests/README.md`. No `describe.serial`: one red does not hide the ones that follow. If a clean start is needed, refresh or navigate. A bare `login(page)` only for the specs that test the login |
| testing logged in, anonymous and another user one after another | **in parallel**, each session in its own context or worker, each with its chained suite. What is serialized is only what steps on the site's shared state (a config, a server counter) |
| seeding and deleting the DB through the UI | the API, in the `before` / `after` |
| `workers: 1` or retries by default | parallel when the tests do not share state; a retry hides a flake, it does not fix it |

- The base helpers (`tests/e2e/lib`, pattern in `tests/README.md`): `settle(page)` still screen for a screenshot, `track(page, match, method)` count requests to assert that something did NOT go out, `keep(model, id, fields)` save and restore shared state. A spec that needs another one asks QA for it.
- 🔴 **A `timeout` is a cap, not a wait.** It may be generous; what it cannot do is be waited out in full when the signal has already arrived.
- 🔴 **A fixed wait in a spec is justified in writing next to it**, saying which signal does not exist and why. Without that it is a PLR (a kick in the backside, i.e. a nasty surprise).
- When reporting a run, its duration goes with it. If a spec takes longer than the manual walkthrough, it is a finding for the spec's owner.

Complements `e2e-programatico-nunca-mcp` and `e2e-siempre-chrome-real-y-al-dia`.
