# A piece of OURS is not wrapped: its signature is changed

When something of ours (helper, factory, module, component) does not fit, its signature is changed. A wrapper, an adapter, a literal that copies getters, `Object.defineProperty`, `{...obj, method: other}` or an `owner` that reimplements the piece are the same decision: treating a piece of ours as fixed. The local minimum ends up as three more pieces, each one explaining the previous.

1. **Writing a wrapper over something of ours → STOP.** *Whose signature is it?* If it is ours, it is changed (and the TDD if needed). Only what is foreign is wrapped (axios, Vue, express).
2. **An agent's report is read against the contract**, not by the green number: N/N with patches inside is still patches.

Complements `diseno-nuevo-no-se-parcha` and `cierre-es-la-suite-completa-contra-lo-real`.
