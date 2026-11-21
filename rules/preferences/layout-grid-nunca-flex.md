# Layout → grid by preference, flex only where grid does not serve

The opposite of the usual habit: grid unless it does not serve, then flex. Flex used by default ends up biting and gets migrated to grid anyway.

| Case | Layout |
|---|---|
| almost every layout (pages, forms, cards, bars, columns) | **grid** |
| boxes of variable width that flow in a line and wrap (tags, chips, a toolbar of uneven buttons), where a grid would be a table | flex |
| a mosaic of mixed heights (Pinterest-like) | `display: grid-lanes` as a progressive enhancement under `@supports`, falling back to a normal grid: it is not Baseline (caniuse, 21-nov-2026: only Safari 26.4+ without a flag, ~11 % global). Check support again before relying on it (`capacidad-del-browser-se-coteja`) |

Flex goes with its reason in one line next to it. Detail: memory `feedback_no-flex-for-layout.md`.
