# `localX` Pattern — One Computed per Prop, No Cascades

When a prop or data `x` needs transformation, create ONE computed named `local + Pascal(x)` that holds **all** the transformations.

## Rule

- Transformations are pure methods.
- A single `localX` computed composes them.
- Render/template consumes `localX` directly.

## Wrong vs Right

```js
// ❌ WRONG — cascade of computeds, duplicated cache + tracking
computed: {
  localFields() { return this.fields.filter(f => f.visible); },
  tableColumns() { return this.buildColumns(this.localFields); }
}
// <n-data-table columns={this.tableColumns} />

// ✅ RIGHT — single computed, pure methods compose
methods: {
  filterFields(fields) { return fields.filter(f => f.visible); },
  buildColumns(fields) { /* ... */ }
},
computed: {
  localFields() { return this.buildColumns(this.filterFields(this.fields)); }
}
// <n-data-table columns={this.localFields} />
```

## Why

A computed is justified only when its result is consumed from multiple independent places (shared cache). Chaining `localX → processedX → renderX` duplicates cache and dependency tracking for no benefit — internal steps are pure transformations, not shared outputs.

## When a second computed IS justified

The intermediate value is consumed by multiple independent consumers.

Example from `ItdView.jsx`: `localSpecs` composes props (striped/bordered/singleLine) + backend (`this.specs`) and is independent of `localFields`. Two separate reactive inputs → two computeds.

## Red Flags

| Rationalization | Reality |
|-----------------|---------|
| "this one is for render, the other for logic" | Same chain — merge into `localX` |
| "already referenced in 3 places" | Change the 3 references to `localX` |
| "keeping both for clarity" | Reactivity waste — one computed is clearer |
| "the render uses `tableColumns`, not `localFields`" | Rename. Don't add a parallel computed. |
