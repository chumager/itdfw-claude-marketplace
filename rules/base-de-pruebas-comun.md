# The shared test bases live in `tests/` at the root: they are imported, not copied

| What | Where |
|---|---|
| e2e (Playwright): login, base site | `tests/e2e/lib/session.js` → `login(page)`, `BASE` |
| back (node:test): host, user, token, client | `tests/back/lib/site.js` → `admin()`, `as()`, `request()`, `json()` |
| back: log in BY SESSION (for `req.sessAuth && req.sameOrigin`) | `tests/back/lib/site.js` → `await session()` → `{cookie, "x-xsrf-token", referer}` |
| e2e that touches the site's DB | `tests/e2e/lib/db.js` → `mongo(body)` |

- A spec imports from there; it does not write its own login or its own connection. If the base lacks something that two specs need, it is added to the base.
- Credentials and connections come from the environment (`ITDFW_USER`, `ITDFW_PASSWORD`, `ITDFW_TOKEN`, `BASE_URL`, `ITDFW_MONGO`).
- 🔴 **The values live in `~/.config/itdfw/test.env`** (chmod 600, outside the repo; another path with `ITDFW_ENV_FILE`). `tests/lib/env.js` loads it with `process.loadEnvFile`, and both bases import it: it reaches any session without depending on the shell. What the environment already carries wins. Never a key in a test, a memory or a brief.
- 🔴 **The host**: to work, `http://localhost:<port>` of your own back, as `back-solo.sh start` answers it in `env` (no subdomains: Node does not resolve `*.localhost`). For what the owner is going to look at, and the final test with the SW, the public URL (`https://<site>.<dev-domain>:<port>`).
- 🔴 **A missing variable is an error, not a default nor a skip** (`… is required`).
- `login` enters through `/auth`; if the store does not say `auth`, set the field with `store.commit("auth/setAuthMode", …)`.
- 🔴 **This is internal: it does NOT go in the skills** (they are public).
