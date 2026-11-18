# A design ends with SLICE 1 written — the stopper against the intergalactic rocket

A TDD, plan or design is not finished until it declares **slice 1**: the smallest walkthrough that a real user does this week from end to end, with everything else replaced by something dumb (a document loaded by hand, a single branch, a single issuer).

1. **Every new model, field or endpoint names which slice it is used in.** If it is "later", it goes to a ONE-line list ("Outside slice 1"), with no table or decisions.
2. **The design's "done" is the slice written.** Without a "Slice 1" section it is not sent to be implemented.
3. **The slice is corrected, not enlarged.** "Without that there is no corner" → it is reordered; "that is a plus" → it is taken out.
4. **The complete CONCEPT goes in, not the field.** What stays out are whole concepts; the one that goes in goes in with its complete shape (one or more photos? → an array even if the view shows one). UI and automation are cut, never the shape of the data.

A mandatory section of `tdd-narrativo` and a row of `itdfw-completeness`. Canonical case: `plugins/conviene/TDD.md`.
