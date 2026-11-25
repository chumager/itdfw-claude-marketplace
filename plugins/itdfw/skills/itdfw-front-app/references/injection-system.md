# Injection System

## How It Works

When `processComponent(obj, "ItdString", "components")` runs:

1. `customImportArray("ItdString", "injections/components")` — searches ALL cascade levels
2. All found modules merged into `component.mixins`
3. Component gets behavior from injections without modifying original code

## 🔴 Cuándo corre la inyección, y qué alcanza a ver

La inyección **es un mixin de Vue**, no un envoltorio ni un parche posterior. `processComponent` la
**agrega al final** del array de mixins del componente, antes de `applyLoaders`:

```js
comp.mixins = [].concat(comp.mixins ?? [], injections).filter(v => v);
```

De ahí salen las tres respuestas que uno necesita al escribir una:

| Pregunta | Respuesta |
|---|---|
| ¿Mi `created()` corre antes o después del componente? | **Antes.** Vue corre los hooks de los mixins antes que los del componente. |
| ¿Y respecto de los otros mixins del componente? | **Después** de todos ellos: la inyección se appendea al final del array. |
| ¿Mi `created()` ya ve el `data()` del componente? | **Sí.** Vue mergea el `data()` de todos los mixins y del componente ANTES de correr cualquier `created()`, así que el estado ya está completo. |

⟹ Para leer o corregir estado inicial del componente, `created()` en la inyección es el lugar correcto: el
`data` ya existe y el `created()` del componente todavía no corrió. Para pisar algo que el componente
calcula en SU `created()`, la inyección llega temprano: eso va en `mounted()` o en un `watch`.

Y como es un mixin de verdad, valen las reglas de merge de Vue: los `data` se mergean (gana el componente
ante colisión de la misma key), los hooks se **encadenan** (no se pisan) y los `methods` sí se pisan —
el del componente gana sobre el de la inyección.

## Directory Structure

```
src/injections/
  App.js            — auto-loaded when App is processed (base "", see below)
  components/
    ItdString.js    — auto-loaded when ItdString is processed
    ItdNumber.js    — auto-loaded when ItdNumber is processed
  mixins/
    Currency.js     — auto-loaded when Currency mixin is processed
```

## 🔴 The injection path MIRRORS the component's base — including the empty base

`processComponent` builds the path from the `base` it received:

```js
const injectionPath = `injections${base ? `/${base}` : ""}`;   // import.js
```

So the rule is: **wherever the component lives, its injection lives under the same relative path inside
`injections/`.** A component in `components/` → `injections/components/`. A component in `views/` →
`injections/views/`.

**And `App` is the case that breaks the habit.** `App.vue` sits at the root of `src/`, not in
`components/`, so the core loads it with an EMPTY base:

```js
App: () => localImport("App", "")     // index.js
```

⟹ `base = ""` → the injection is looked up at **`injections/App.js`**, NOT
`injections/components/App.js`.

🔴 **The failure mode is SILENT.** `customImportArray` returning nothing is a legitimate result (most
components have no injection), so a misplaced file produces **no error, no warning, nothing in the
console** — the module is never even imported. The symptom is just "my injection does nothing", which
invites suspecting the injection system itself instead of the path.

⟹ Debug rule: put a `console.log` at MODULE scope (not inside a hook) as step one. If it doesn't print,
the file is not where the FW is looking — stop reading the injection code and check the base.

Ejemplo: la inyección que fija el modo de autenticación del site
(`auth/setAuthMode` con `modelAuth: "Member"`) se puso en `injections/components/App.js` por analogía con
los componentes. Cero output, cero error: el síntoma es sospechar de `localImport` y de `processComponent`
cuando el archivo solo está una carpeta más adentro.

## Use Cases

- Add analytics tracking to specific components
- Inject site-specific behavior into framework components
- Override computed/methods without touching original code
- Add mixins to components you don't own

## Gotcha

Injections load EVERY TIME `processComponent` runs for that component. Heavy imports or side effects in injections run repeatedly. Keep injections lightweight.
