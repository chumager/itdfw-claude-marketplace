# Assign Function — Module Registration Flags

## Block Item Types

**Function**: Executed with `this` = vars. No name needed. For side effects.

**Object**: Module declaration with metadata:

```js
{
  name: "moduleName",      // REQUIRED
  func: () => import(...), // REQUIRED — returns the module
  // Registration flags (can combine):
  global: true,            // window[name] = result
  vueGlobal: true,         // Vue.prototype[name] (v2) / globalProperties[name] (v3)
  method: true,            // Vue.mixin({methods: {[name]: result}})
  plugin: true,            // Vue.use(result, options)
  mixin: true,             // Vue.mixin(result) — auto wrapMixin
  component: true,         // Vue.component(name, result)
  component: "alias",      // Vue.component("alias", result)
  directive: true,         // Vue.directive(name, result)
  filter: true,            // Vue.filter (Vue 2 only)
  // Lifecycle:
  options: {},             // Passed to func(options). Can be async function (this=vars)
  post: (result, raw) => {} // Runs AFTER registration. this=vars
}
```

## Execution Flow

1. `options` resolved (if function, `this=vars`)
2. `func.call(vars, options)` executed
3. `result.default ?? result` extracted
4. Registration flags applied
5. `post.call(vars, func, result)` runs
6. `vars[name] = func` stored

## addLoader

```js
this.addLoader("$myOption", async (comp, value) => {
  // comp = component object, value = comp.$myOption
});
```

Built-in: `$BVP`, `$lodash`, `$emitter`, `$validateSelf`.
Only fires through `localImport`/`processComponent`. Direct `import` bypasses.
