# A UI delivery is LOOKED AT: QA's suite takes design screenshots and QA critiques them before "done"

A green spec does not say whether it looks good. Every change that is visible carries design screenshots, and the one who critiques them is `QA` with the image `Read`, not whoever implemented it.

- The spec takes them (`page.screenshot`), never a browser MCP.
- At least **360 and 1280 px, light and dark**, in the state that changed. They go to `test-results/design/<spec>/` (outside git and the package).
- With the screen STILL: the response that matters has already arrived (the locator or `waitForResponse`) and then `settle(page)` from `tests/e2e/lib/signals.js`; never `networkidle`, which with SSE never settles (`e2e-mas-rapido-que-una-persona`).
- QA reports what feels off even if nobody asks: alignment, breathing room, hierarchy, what cannot be read, two things that look like one, uneven areas. It goes to the owner (the PMO or `designer`) and is fixed before "done".
- Whoever implements may take their own screenshots as a check before delivering; they do not replace QA's.

Complements `sombrero-de-usuario` and `verificado-es-la-propiedad`.
