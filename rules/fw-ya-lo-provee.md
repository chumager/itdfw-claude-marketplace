# The FW ALREADY provides it — verify BEFORE implementing

ITDFW transfers the complexity to the framework: the piece almost always exists. Before writing a line, assume it EXISTS and look for it.

## Where to look, in order

0. 🔴 **`mcp__itdfw-graph__find`, always first**, with TECHNICAL TERMS, never prose:
   ```
   "que dos procesos no hagan lo mismo a la vez"      → garbage   (prose: "so that two processes don't do the same thing at once")
   "mutex lock semáforo exclusión mutua distribuida"  → Mutex.waitLock()/semaphore()  ✅   (terms: mutex lock semaphore distributed mutual exclusion)
   ```
   If you do not know the term, throw them all in together (synonyms, English and Spanish).
1. The lib/module code (`libs/*`, `back/itdfw/src/`). NOT `claude-context/` (legacy).
2. What is injected in the `req`: user, config, `db` (which IS `db.models`), `hub`.
3. The model's options and the FWPlugins.
4. The area's skill (if it does not have it, it is a gap: it gets closed).
5. Ask the owner.

## Red flag

- Writing infrastructure (pubsub, lock, SSE client, schema cloner, cursor, parser) → STOP: it exists (`libs/sse`, `libs/mongoose-mutex`, `safeClone`…). If it did not exist, creating it is not my decision.
- 🔴 **The UI is infrastructure too**: a modal with inputs and a Save button IS a `GenericForm` with its inputs definition and controller. Using `renderGI`/`ItdString` inside a hand-built modal is still hand-crafted. Before a brief with two or more inputs, the first line is which FW piece is the container.
- If the solution requires replicating the internals of a dependency, the problem is badly posed.

Complements `skills-first-and-close-gaps`.
