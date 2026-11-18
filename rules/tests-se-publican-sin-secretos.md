# Tests are PUBLISHED: nothing in a test that cannot be read outside

Each plugin's, front's or lib's `test/` folder travels in its package (a site runs the suites of what it has installed). Everything that is in a test is read by anyone who installs it.

| Forbidden in a test | Instead |
|---|---|
| credentials: password, token, API key, Mongo URL with user, cookie, secret | from the environment (`ITDFW_USER`, `ITDFW_PASSWORD`, `ITDFW_TOKEN`, `ITDFW_MONGO`…); if missing, error |
| own hosts and infrastructure: `*.<own-domain>`, IPs, internal ports, machine paths | `BASE_URL` and environment variables, with no defaults carrying our paths |
| real data of people or customers | invented, recognizable fixtures (`e2e …`, a generated test RUT) |
| a customer's internal business logic | generic data: the module's test tests the module |
| comments with internal context (sessions, customers, findings, who asked for what) | the technical why; the context goes to the TDD log |

- It applies to every agent that writes a test: the brief says so and the diff is reviewed like the contract.
- `~/bin/itdfw-deps.sh files` (commit and publish gate) makes it automatic.
