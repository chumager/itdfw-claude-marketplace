---
name: itdfw-core-init
description: Use when working with the ITDFW bootstrap system, pack proxy, init.js cascade, module loading (global, vueGlobal, plugin, mixin, component), addLoader, or debugging initialization order issues. Also use when adding new modules to the pack or modifying init blocks.
---

# ITDFW Core Init & Pack System

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [assign-flags.md](references/assign-flags.md) | Tipos de ítem de bloque, flags de registro (`global`, etc.), flujo de ejecución y `addLoader` | Necesitas todas las flags de registro o el flujo de ejecución |
| [pack-proxy.md](references/pack-proxy.md) | Estructura del pack en bloques y sus cuatro operaciones por nombre; un nombre se declara una sola vez | Navegar o manipular el pack, o dudas de estructura |
| [writing-loaders.md](references/writing-loaders.md) | Cómo escribir loaders (`addLoader`): firma, inyección, `pos`/`hoist`, 5 ejemplos built-in (`$lodash`, `$emitter`, `$BVP`, `$validateSelf`, `$vModel`) y reglas | Escribes un loader: patrones, inyección, hoist, pos |

## Overview

The bootstrap loads the Vue app through a **Pack** — a Proxy array of blocks. Sequential between blocks, parallel within. Each layer (core → plugins → front → site) pushes blocks via `init.js`.

## Architecture

```
index.js (run)
  ├→ import Vue 2/3
  ├→ store + router factories
  ├→ customImportArray("init.js") — cascade discovers all inits
  ├→ applyPack(vars) — processes all blocks
  └→ loadFormFactories() — GI, GF, GFMin globals
```

Before all of it: the `index.html` that wins the cascade (site → DEFAULT → front → core; today the core's) loads
`/src/main.js` from its own level, so whoever ships an `index.html` ships its `src/main.js` next to it. While the
bootstrap runs, the core's `index.html` paints a pure-CSS splash (`#app:empty`, `#app` with nothing inside, not even
whitespace). The build logs the winner: `[itdfw] index: <root>`. Detail: `itdfw-front-app` → `references/vite-setup.md`.

## Init.js Pattern

Each init exports `async function(pack)`. Use `pack.push([...])` to add blocks:

```js
export default async function(pack) {
  pack.push([
    { name: "myModule", global: true, func: () => import("my-module") },
    function setup() { this.base.mixin(someMixin); }  // this = vars
  ]);
}
```

Later inits modify earlier blocks by name: `pack.search(name)` (the block), `pack.before/after(name, [items])` (a new
block), `pack.replace(name, obj)`, `pack.delete(name)`. 🔴 A name is declared once: `applyPack` throws on a repeat.
Detail: [pack-proxy.md](references/pack-proxy.md).

## Quick Reference

| Need to... | Do this |
|------------|---------|
| Add global module | `{name, global: true, func}` |
| Add Vue prototype method | `{name, inner: true, func}` |
| Register component | `{name, component: true, func}` |
| Install plugin | `{name, plugin: true, func, options}` |
| Add mixin | `{name, mixin: true, func}` |
| Run post-processing | Add `post: (result, raw) => {}` |
| Pass options to func | Add `options: {}` or `options: async function() {}` (this=vars) |
| Tree-shake import | Wrapper in `lib/` with named imports, not `import("whole-lib")` |
| Deferred component processing | `addLoader("$option", async (comp, value) => {...})` |

## Loaders — The Holy Grail

Loaders are async functions that modify components DURING localImport, BEFORE Vue sees them. They enable deferred processing that plugins (Vue.use) can't do — plugins run at boot, loaders run at component load time.

```js
addLoader("$myOption", async (comp, value) => { ... }, pos, hoist);
```

Built-in: `$lodash` (methods+global, pos:-1), `$emitter` (mitt pubsub, pos:0), `$BVP` (BV plugins, front only), `$validateSelf` (validation mixin, hoist:false), `$vModel` (v-model agnostic Vue 2/3), `$log` (computed `this.log` = Proxy condicional sobre `log.getLogger`; no-op si el activador off — `$options.$logDebug ?? this.debug ?? "debug" in $attrs`. Los `this.log.*` quedan SIEMPRE en el código; solo se apaga el activador).

Full patterns + examples: [writing-loaders.md](references/writing-loaders.md)

## Common Mistakes

| WRONG | RIGHT | Why |
|-------|-------|-----|
| Redeclare a name to override it | `pack.replace(name, obj)`, or a block after it that rewrites `this.name` | a repeated name throws at `applyPack` |
| Modify pack after applyPack | Modify in init.js | the pack is only handed to init.js |
| `import` with loaders needed | `localImport` | Direct import bypasses $BVP etc |
| Assume vars.X in same block | Use `post` or later block | Parallel — no order within block |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
