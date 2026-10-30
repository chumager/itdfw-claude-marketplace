# Loaders — arquitectura, creación y consumo

## Por qué los loaders son poderosos (y peligrosos)

Los loaders son el **único hook pre-instanciación** del framework. Corren ANTES que Vue construya cualquier instancia del componente, con acceso directo al objeto del componente. Todo lo demás del framework (mixins, watchers, computed, lifecycle hooks) opera DENTRO del contrato de Vue, ya sobre instancias.

Eso significa:
- **Polite** (el 90% del uso): agregar un mixin al array `comp.mixins`. Ejemplos: `$urlSync`, `$validateSelf`, `$emitter`.
- **Agresivo**: borrar props del componente, reescribir `data()`, mutar `methods` existentes, inyectar/sobreescribir lifecycle hooks, redirigir `render()`.
- **Extremo**: transformar el componente en otro completamente distinto (ej: si `$permissions` detecta user sin permiso → swap el `render` por un componente "AccessDenied").

**"Con gran poder viene gran responsabilidad"** — un loader mal escrito rompe componentes invisible. El dev solo ve: "pongo `$xxx: {...}` en options y funciona". No sabe qué pasó abajo. Eso es lo elegante — cero fricción cognitiva, poder infinito. Y también por qué hay que escribirlos con rigor.

**Por qué un dev prefiere un loader vs mixin manual**:
- 1 variable en options vs recordar ruta del mixin/import/localImport
- Zero wiring — el loader hace el wiring por él
- Config declarativa y readable
- Reutilizable cross-projects sin copiar wiring

## Qué es un loader

Un **loader** procesa una opción declarativa en `$options` de un componente (ej: `$validateSelf`, `$vModel`, `$lodash`, `$NUI`, `$emitter`, `$urlSync`) y **construye un mixin inline con los datos del componente**, que se agrega a `comp.mixins`.

**NO es:** un mixin global pegado con goma. Si piensas "mixin con `beforeCreate` que muta `$options.computed`", estás haciendo loader mal.

**Sí es:** una factory que corre al registrar el componente, lee `$options.X`, genera un mixin específico con closures sobre ese config, lo pushea a `comp.mixins`. Patrón idéntico al merge normal de Vue.

## Cuándo crear un loader

- Necesitas que el componente declare comportamiento complejo/async/condicionado con 1 sola variable en options
- Ejemplo: `$urlSync: {scope, keys}` declara qué sincronizar con URL — el loader buildea computeds, methods, props del mixin según ese config
- Si solo necesitas un mixin estático (sin config), es mixin normal — no loader

## API: `addLoader(option, loader, pos, hoist)`

```js
addLoader(
  "$urlSync",                       // nombre de la opción a matchear
  async (comp, value) => {          // factory: recibe el componente + valor de la opción
    // 1. Validar config
    if (!value || !value.keys) return;

    // 2. Build lo que sea (computeds, methods, data) con closures sobre value
    const computed = {};
    Object.entries(value.keys).forEach(([key, cfg]) => {
      computed[key] = { get() {/* usa key, cfg */}, set(v) {/* idem */} };
    });

    // 3. Pushear mixin a comp.mixins (array existente o nuevo)
    comp.mixins = [
      ...(comp.mixins || []),
      { mixinName: "xxxMixin", props: {...}, data() {...}, computed, methods: {...} }
    ];
  },
  undefined,  // pos: 0=first, -1=last, undefined=natural
  false       // hoist: false=solo el componente que declara; true=busca en extends/mixins chain
);
```

## Dónde va el archivo

| Caso | Dónde |
|------|-------|
| Lógica < 30 líneas (trivial) | Inline en init.js junto a `registerEmitter`, `registerLodashLoader` |
| Lógica grande (factory con múltiples closures) | Archivo separado en **root de la lib** (no `src/`), igual que `vModel.js`, `urlSyncLoader.js` |
| Archivo en `src/mixins/` | ❌ **NUNCA** — mixins estáticos sí van ahí, loaders NO |

Pattern del archivo separado:
```js
// libs/itdfw-site-vue-core/xxxLoader.js
export default async function xxxLoader(comp, config) {
  // factory — corre cuando el componente es registrado
}
```

Registro en init.js:
```js
async function registerXxxLoader() {
  addLoader("$xxx", await import("../xxxLoader.js").get("default"), undefined, false);
}
```

**Nota sobre `.get("default")`**: es convención ITDFW via `@chumager/promise-helpers` (extiende `Promise.prototype` con `.get()`). Equivalente JS standard: `(await import(...)).default`. Usar `.get("default")` mantiene coherencia con el resto del codebase (`vModel.js`, `lodashMethod`, etc).

## Anti-patterns observados

### 1. Mixin con `beforeCreate` mutando `$options.computed`
**Síntoma:** "creé un mixin global que en `beforeCreate` agrega computeds dinámicos".

**Problema:** ejecuta en CADA instancia, mutación de runtime de `$options`, hacky, ineficiente.

**Fix:** eso es un loader. Usar `addLoader` — la factory corre UNA vez en registro, genera mixin específico con `computed` reales buildeados en closure.

### 2. Usar lodash directo (`_.get`/`_.set`) en el loader
**Síntoma:** `/* global _ */` + `_.get(parsed, [...path, key])`.

**Problema:** lodash directo está prohibido en el framework — agrega peso al bundle, no tree-shake, rompe convención.

**Fix correcto:** `const lodashGet = await lodashMethod("get")` en la factory → captura la ref treeshake en closure → usar localmente sin pollution. `lodashMethod` es global del framework (declarada en init.js).

### 3. Usar `$lodash` loader con nombres genéricos
**Síntoma:** `$lodash: ["get", "set"]` en el mixin.

**Problema:** `$lodash` loader mete las funciones en `window[name]` + `comp.methods[name]`. Con nombres genéricos (`get`, `set`) garantizas colisión con cualquier componente que tenga method llamado así.

**Fix correcto:** `lodashMethod(name)` directo en el factory, sin pollution. `$lodash` loader es para nombres específicos (`debounce`, `throttle`, `cloneDeep`).

### 4. Lógica vanilla cuando hay helper disponible
**Síntoma:** "escribo `getByPath` y `setByPath` loops a mano porque lodash está prohibido".

**Problema:** reinventas lo que el framework ya provee via `lodashMethod(name)`. Tree-shaken, mantenido, idiomático.

**Fix correcto:** `lodashMethod("get")` / `lodashMethod("set")` en closure.

## Reglas de pollution

| Mecanismo | Cuándo usar | Cuándo NO |
|-----------|-------------|-----------|
| `lodashMethod(name)` directo en closure | Scope acotado, nombre genérico (`get`, `set`, `isEqual`) | Nunca "nunca" |
| `$lodash: ["name"]` loader | Nombre específico (`debounce`, `throttle`) usable globalmente | Nombres genéricos (colisión) |
| `import _ from "lodash"` | **NUNCA** | Siempre |

## Flujo de ejecución

```
1. init.js corre registerXxxLoader()
2. addLoader("$xxx", factory, pos, hoist) registra en loaderObject
3. Cuando localImport(comp) carga un componente
4. applyLoaders(comp) itera loaders ordenados
5. Si comp.$xxx existe → await factory(comp, comp.$xxx)
6. factory muta comp.mixins
7. Vue merge normal procesa el mixin
8. Instancias del componente tienen todo aplicado
```

## Propiedades clave

- **factory puede ser async** — `await import(...)`, `await lodashMethod(...)` OK
- **hoist:false** es lo usual — el loader solo aplica al componente que declara la opción
- **hoist:true** solo cuando quieres que componentes que extienden hereden la opción sin re-declararla
- **pos** importa solo cuando hay orden entre loaders (ej: $validateSelf corre primero, $lodash corre último)
- **Factory corre UNA vez por componente** (no por instancia) — closures son seguros

## Red flags

- ¿Usas `beforeCreate` en un loader para mutar `$options.computed`? → **loader mal hecho, reescribir como factory**
- ¿Importas lodash directo (`_`)? → **prohibido**
- ¿Metes `get`/`set`/`has`/`is` via `$lodash`? → **colisión de nombres, usar `lodashMethod` directo**
- ¿Archivo del loader en `src/mixins/`? → **mover a root de la lib**
- ¿Loader declarado como `{mixin: true, func: ...}`? → **no es mixin, es loader; usar `addLoader`**

## Ejemplos de loaders existentes

- **`$lodash`** (init.js:230) — adds lodash method via `lodashMethod` + globalize
- **`$emitter`** (init.js:175) — mitt-based event emitter per instance
- **`$vModel`** (init.js:159, `vModel.js` root) — vModel compat Vue2/Vue3
- **`$validateSelf`** (`plugins/validateSelf.js:399`) — validation mixin
- **`$NUI`** (NUI init.js:10) — Naive UI components loader
- **`$urlSync`** (`urlSyncLoader.js` root) — QS ↔ computed sync
