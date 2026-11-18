# Everything public in the back and in `libs/*` carries JSDoc — at birth or when touched

A function, getter, static, export or public endpoint that is born or modified in `back/itdfw`, `libs/*` or `plugins/*` (back side) → JSDoc in the same change: what it does, `@param`, `@returns`, and the why if it is not obvious. Short and precise.

- Internal comments keep following the pruning (black magic only); JSDoc is not pruned.
- It applies to every agent: the `implementer`'s brief requires it and it is reviewed in its diff.

JSDoc is the source of the back's HTML documentation.
