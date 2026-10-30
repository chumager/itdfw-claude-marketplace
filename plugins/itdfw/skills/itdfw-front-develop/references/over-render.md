# Over-render Strategy

**Linear flow, not circular**: Data flows in one direction — parent prop down → render → user edits → updateValue → emit up. Never circular. The component is reactive to EXTERNAL values (parent prop via `resolvedValue`) but IMPERATIVE internally (`validateSelfValue` controlled via `updateValue`, never in render).

**Value in render = `initVal(resolvedValue)`**: When a component overrides `renderInput()`, the value binding MUST use `this.initVal(this.resolvedValue)` (parent's prop), NEVER `this.validateSelfValue` (internal state). Using internal state in render creates a circular dependency: we mutate → render fires → we re-render ourselves. Using the parent's prop keeps reactivity one-directional: parent changes → we re-render (correct), we change → emit up only (no self re-render).

**NEVER move value to mounted() to "avoid reactivity"**: That kills reactivity to the parent entirely. The component must remain reactive to external changes — only internal reactivity must be eliminated.

**Local sobre-render is OK** — e.g., Range's `localLeft` showing the current value causes an extra render of the prepend, but it's contained to the component itself.

**Cascading sobre-render is the real problem** — an over-render in a parent form propagates to ALL child inputs. The lazy/validateSelfRaw optimizations exist to prevent cascade, not to eliminate every single re-render in leaf components.
