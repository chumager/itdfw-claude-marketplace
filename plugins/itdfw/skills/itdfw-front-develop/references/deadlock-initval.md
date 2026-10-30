# Rule: initVal + child data/computed = DEADLOCK

GI's `data()` calls `this.initVal(rawValue)` to set the initial `$validateSelfValue`. Vue lifecycle: `props → methods → data → computed → watch`. When a child component's `initVal` depends on data or computed defined in the CHILD's `data()`, those don't exist yet — GI's `data()` runs first (extends merge order).

**Symptom**: `validateSelfRaw` watcher dies silently on first evaluation. Component renders but never emits values. No obvious error unless you have `errorCaptured`.

**Fix**: Override `$validateSelfValue` in the child's `data()`:
```js
data() {
  const dateType = this.input?.dateType ?? "date";  // raw prop, NOT this.dateType
  const rawValue = this.modelValue ?? this.value;
  // compute initial manually using local var, not this.dateType
  const initial = dateType === "year" ? date.getFullYear() : ...;
  return {
    dateType,
    [this.$options.$validateSelfValue]: initial  // overrides GI's broken initial
  };
}
```

**Real-world bug**: ItdDate with `dateType: "year"`. `initVal` used `this.dateType` (computed) → undefined in GI's `data()` → fell to default case → returned `"2024-07-21"` (date format) instead of `2024` (number) → emitter choked → `RangeError: Invalid time value` → watcher died silently → component never emitted. 2h debugging.
