# Writing Loaders

## What Loaders Are

Loaders are async functions that modify components DURING `processComponent` (localImport), before Vue sees them. They enable deferred, on-demand processing that plugins (Vue.use) can't do — plugins run at boot, loaders run at component load time.

## Loader Signature

```js
addLoader("$optionName", async (comp, value) => {
  // comp = component object (mutate in-place)
  // value = what the component declared: comp.$optionName
}, pos, hoist);
```

- `pos`: `0` = first, `-1` = last, `undefined` = natural order
- `hoist`: `true` (default) = search extends/mixins chain. `false` = only direct declaration

## How to Inject

**Via mixin** (preferred — clean, no collision):
```js
comp.mixins = [...(comp.mixins || []), myMixin];
```

**Via methods direct** (when you need global + instance):
```js
comp.methods ??= {};
comp.methods[name] = func;
window[name] = func; // global access
```

**Via global side-effect** (no comp modification):
```js
Vue.use(plugin); // BVP pattern
```

## Patterns by Example

### $lodash — Method injection + global (pos: -1, hoist: true)
```js
addLoader("$lodash", async (comp, value) => {
  comp.methods ??= {};
  const func = await lodashMethod(value);
  comp.methods[value] = func;
  window[value] = func;
}, -1);
```
- `$lodash: "isEqual"` or `$lodash: ["isEqual", "cloneDeep"]`
- Runs LAST — other loaders may add values that need lodash
- Idempotent via window check

### $emitter — Mixin with lifecycle (pos: 0, hoist: true)
```js
addLoader("$emitter", async comp => {
  comp.mixins = [...(comp.mixins || []), {
    beforeCreate() {
      const emitter = mitt();
      this.on = emitter.on.bind(emitter);
      // ...
    }
  }];
}, 0, true);
```
- `$emitter: true` — flag only, value unused
- Runs FIRST — other loaders/methods may need on/off/emit
- Lifecycle hooks in mixin for per-instance setup

### $BVP — Global side-effect, no comp modification (front only)
```js
const BVP = new Set();
this.addLoader("$BVP", async (_comp, value) => {
  if (BVP.has(value)) return;
  await import(`./BVP/${value}.js`);
  BVP.add(value);
});
```
- `$BVP: "FormPlugin"` or `$BVP: ["FormPlugin", "LayoutPlugin"]`
- Does NOT touch comp — only loads and registers BV plugin globally
- Set for idempotency
- Defined in FRONT init (not core) — framework-specific

### $validateSelf — Conditional mixin (hoist: FALSE)
```js
addLoader("$validateSelf", async (comp, value) => {
  switch (value) {
    case true:
    case "self":
      comp.mixins = [...(comp.mixins || []), validateMixin];
      break;
    case "form":
      comp.mixins = [...(comp.mixins || []), validateFormMixin];
  }
}, undefined, false);
```
- `$validateSelf: true` or `$validateSelf: "form"`
- Value determines WHICH mixin to inject
- hoist: FALSE — only the declaring component gets it, prevents recursive injection
- Imported from plugin file, not from init

### $vModel — Props + methods via mixin, separate config
```js
addLoader("$vModel", (comp, value) => {
  if (!value) return;
  comp.mixins = [].concat(comp.mixins || [], {
    props: buildProps(comp),  // reads comp.$vModelProp for overrides
    computed: { vModelValue() { ... } },
    methods: { vModelProps() { ... }, vModelListeners() { ... } }
  });
});
```
- `$vModel: true` — activates loader
- `$vModelProp: {type: String}` — separate option for prop configuration
- Pattern: flag option activates, config option configures

## Key Rules

| Rule | Why |
|------|-----|
| Inject via `comp.mixins`, not direct mutation | Avoids collisions, Vue merges correctly |
| Direct mutation only for simple cases ($lodash) | When you need `window[name]` too |
| Use Set for idempotency | Prevent double-loading ($BVP, $lodash) |
| `hoist: false` for mixins with watchers/state | Prevents recursive injection from extends chain |
| `pos: 0` if others depend on you | $emitter provides on/off that others use |
| `pos: -1` if you depend on others | $lodash needs final pass to catch all declarations |
| Flag + config pattern | `$myLoader: true` activates, `$myLoaderProp: {}` configures |
