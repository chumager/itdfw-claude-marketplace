# Changes to the CORE are requested by message to the `core` session — nobody else touches them

Any session that needs a change in the core does not make it: it asks `core` for it with `SendMessage({to: "core"})`. `core` is the owner of, and responsible for, the decisions of the three base products.

Core = `back/itdfw`, `libs/*` (site-vue-core, config-loader, request-strategy, sse, mutex, pubsub…). NUI (`fronts/itdfw-naiveui`) has belonged to `designer` since he exists, and requests for it go to him; until then, to `core`. Plugins and sites belong to whoever works on them. One single owner = one single place to ask what changed, with a test and a validated bump.

## The request
1. What it needs: the symptom or the capability, in domain terms. Not the solution.
2. In which site it tests it: public URL (`https://<site>.<dev-domain>:<port>`).
3. What has to be brought up: only the back, or also re-transpile the front.

## The response
What changed (code), the test that proves it, the bump with `itdfw-deps.sh drift` in view, and "tested in <site>".

Symmetric: the owner of the core does not get into another session's work either; he notifies it.
