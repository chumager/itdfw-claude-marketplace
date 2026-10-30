# Init.js Pattern

## Structure

Each layer's `init.js` exports a single async function receiving `pack`:

```js
export default async function(pack) {
  // A block right after the one that declares addLoader (the four operations: pack-proxy.md in itdfw-core-init)
  pack.after("addLoader", [function() {
    this.addLoader("$myOption", async (comp, value) => { ... });
  }]);

  // Add new blocks
  pack.push([
    { name: "MyModule", global: true, func: () => import("my-module") },
    function setup() { this.store.commit("Config/setConf", myConfig); }
  ]);
}
```

## `this` Context

In pack functions, `this` = vars object with:
- `this.base` — Vue instance/app
- `this.store` — Vuex store
- `this.router` — Vue Router
- `this.localImport` — cascade importer
- `this.addLoader` — register custom loader
- `this.customImport`, `this.customImportArray`, `this.customImportMerge`

## Execution Order

`customImportArray("init.js")` discovers ALL init.js in cascade:
```
@ (app) → default → plugins → itdfw (front) → core
```

**IMPORTANT**: Core runs LAST. If app init uses something from core init, it won't exist yet. Use the pack operations to modify, not to read.

🔴 **Pero el pack se PROCESA en el orden del array (bloques del core primero), y `assign` PISA `options` con su valor
resuelto** (medido 20-sep-2026, banco de smart-fetch): cuando la `options()` de un bloque del site corre, la
`options` del bloque `$http` del core **ya no es una función sino el objeto** resuelto
(`val.options = await val.options.call(vars)`). Un bloque que quiera reusar las options de otro
(`pack.search("$http").find(item => item.name === "$http").options`) tiene que aceptar las dos formas: función (aún
no procesado) u objeto (ya procesado). Si el orden de los `init.js` y el del procesamiento parecen contradecirse, es
esto: son dos fases.

## BVP Loader Example (Front init)

```js
pack.after("addLoader", [function() {
  const BVP = new Set();
  this.addLoader("$BVP", async (_comp, value) => {
    if (BVP.has(value)) return;
    await import(`./BVP/${value}.js`);
    BVP.add(value);
  });
}]);
```

Components declare `$BVP: "FormPlugin"` → loader imports BV plugin on first use. Idempotent via Set.

## Overriding Core Behavior

```js
// Override deleteAllCookies with BV modal instead of native confirm
window.actions.deleteAllCookies = async function(response) {
  const confirmed = await this.appComponent.$bvModal.msgBoxConfirm(response?.data?.message);
  if (confirmed) { /* ... */ }
};
```
