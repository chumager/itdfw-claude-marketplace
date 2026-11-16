---
name: itdfw-fwplugin
description: Use when creating or understanding an ITDFW FWPlugin — the back-to-front layer that bundles models, mongoose plugins, custom types, API endpoints, shared libs AND its own framework-specific frontend into one cohesive, distributable unit. Covers what a FWPlugin IS, its keys (each delegating to the right skill), the reactivity-framework frontend hook, and load timing.
---

# ITDFW FWPlugins

## Qué ES un FWPlugin (y por qué existe)

Un FWPlugin es una **capa que cruza TODO el stack back→front**. No es "un plugin de backend": es un
objeto declarativo que puede traer **modelos, mongoose-plugins, types custom, endpoints API, libs
compartidas Y su propio frontend** (componentes/vistas por framework), sobreescribiendo o creando lo
que quiera. Un carro de compras completo —o todo un vertical de negocio— puede ser UN FWPlugin: las
apps lo **importan y heredan todo**, y sobreescriben solo lo que necesiten (cascada normal del FW), sin
copiar nada a su `DEFAULT`.

**Dos motivos para que exista (y solo dos):**
1. **Coherencia estructural** — agrupar piezas heterogéneas que pertenecen juntas. Ej: `Config.js`
   junta `db` + `plugins` + `schemas`; separarlas "donde corresponde" (cada una en su carpeta) las
   dispersaría. El FWPlugin es la "mini definición" que las mantiene como una unidad.
2. **Plugin externo / distribuible** — un módulo instalable que se enchufa al deploy vía config.

🔴 **Este skill NO detalla cada pieza** — solo define DÓNDE va cada cosa y delega:

| Key | Qué aporta | Skill / fuente para el detalle |
|-----|-----------|-------------------------------|
| `schemas` | Modelos de negocio (funciones Schema async) | **`itdfw-models`** (+ `schema-engine.md` para init/eventos/pool) |
| `types` | Types Mongoose custom | **`itdfw-mongoose-types`** |
| `API` | Endpoints/puntas | **`itdfw-api-system`** |
| `plugins` | Mongoose plugins (global/filtered/specific) | leer `mongoosePlugins/` existentes |
| `db` | Utilidades sobre el objeto `db` | leer `mongooseDB/` existentes |
| `libs` | Librerías compartidas → `pool.libs` | abajo (§libs) |
| `auth` | Autenticadores `{name, claims, authenticate, pos?}` o un arreglo: `claims(req)` es **síncrono** y barato; `authenticate(req)` devuelve `{model, user}` o `undefined`, o lanza si la credencial es suya y está mala. No escribe `req.auth`. Orden y `pos`: [references/keys-detail.md](references/keys-detail.md) | **`itdfw-api-system`** → "El acceso paso a paso" |
| `wellKnown` | Aportes a `/.well-known/<nombre>`: `{<nombre>: {type, final?, content}}`, validados en el arranque y mezclados al pedirse. Las reglas: [references/keys-detail.md](references/keys-detail.md) | `wellKnown` (utilidad del core) |
| `captcha` | Proveedores `{name, publicSpec(req, ctx), verify(req, token, ctx), challenge?(req, ctx), external: boolean}` o un arreglo. **El core no trae ninguno.** **Solo se usan** cuando el `formSpecs` de un modelo declara `captcha` para ese tipo. Cuál aplica, los códigos de error y el ejemplo: [references/keys-detail.md](references/keys-detail.md) | `captcha` (utilidad del core) |
| `refs` | Fuentes de opciones de un select con nombre (`"plugin/nombre": (req, query) => [{value, text}]`) → `pool.refs`, que leen `getRef`/`getSimpleName`; el campo las pide con `myRef: "plugin/nombre"` | **`itdfw-models`** → `references/special-refs.md` §4 |
| `vue2`/`vue3`/`react`/`svelte`/`solid`/`lit` | **Frontend** por framework | abajo (§frontend) — lo único exclusivo del FWPlugin |
| `name` | Nombre para logging | — |

## Estructura

Exporta un **objeto**, o una **función que retorna un objeto** (recibe `this` = instancia Schema → `db`,
`pool`, `init`). Para un FWP distribuible, la **estructura de carpetas espeja el back + el front** (ver
"Estructura de carpetas" abajo).

```js
// Objeto (simple): Currency.js, PDF.js
export default { name: "My Plugin", API: {...}, types: [...] };

// Función (necesita runtime): Config.js, Finance
export default function () {
  const { db, pool } = this;            // this = instancia Schema (ver schema-engine.md en itdfw-models)
  return { name: "My Plugin", plugins: [...], schemas: [...] };
};
```

### 🔴 Estructura de carpetas — un FWP ESPEJA el back + el front, con `lib/` común

Un FWP distribuible **espeja la estructura del back (`SITE/`) y del front**, con `lib/` para lo **isomorphic**
(lo que usan AMBOS: Value Objects, helpers puros). El `index.js` solo ENSAMBLA, importando de esas carpetas:

```
<plugin>/
  index.js            → ensambla (name + keys types/plugins/schemas/API/db/db + <framework>)
  lib/                → COMPARTIDO back↔front (el VO, helpers isomorphic) — por eso el VO vive acá
  mongooseTypes/      → types custom        (espeja SITE/mongooseTypes/)
  mongoosePlugins/    → mongoose-plugins    (espeja SITE/mongoosePlugins/)
  mongooseSchema/     → schemas de negocio  (espeja SITE/mongooseSchema/)
  mongooseDB/         → utilidades db       (espeja SITE/mongooseDB/)
  APP/                → endpoints/puntas    (espeja SITE/APP/)
  vue/ | vue2/ | vue3/ | react/ …  → front por framework
  test/               → tests (el FWP viaja con su suite → itdfw-completeness)
```

🔴 **`vue` vs `vue2`/`vue3`**: la carpeta se llama **`vue`** cuando el front sirve para **AMBOS** (vue2 y
vue3); **`vue2`**/**`vue3`** solo cuando es específico de una versión (mismo criterio para los otros
frameworks). El index apunta la key del framework a la carpeta:
`vue: { <comp>: new URL('./vue', import.meta.url).pathname }`.

🔴 **Es RECOMENDADA, no obligatoria**: salvo la carpeta del front, el motor solo lee las **keys del objeto** que
exportás. Para arrancar bien, **copiá el template** (`assets/fwplugin-template/`), 🔴 **incluido su `package.json`**:
trae la whitelist `files` (rule `package-files-whitelist`) con las carpetas del espejo y `README.md`, y **sin `TDD*.md`
ni `test/`**: el README es la cara del paquete, el TDD va en git pero no en el tarball. El caso que lo destapó y por qué
Currency y PDF viven inline en el core: [references/folder-structure.md](references/folder-structure.md).

### 🔴 El scope se decide con `inFront`/`inBack` — NUNCA por el argumento

El MISMO módulo se evalúa en **dos scopes** y lo que exporta cambia. La discriminación se hace con los
**globales `inFront` / `inBack`**, decidiendo QUÉ SE EXPORTA:

- **`inFront`** → exporta **la ESTRUCTURA (objeto)** con las keys de framework (`vue`/`vue3`/`react`/…).
  Vite lee las keys directo, sin ejecutar nada.
- **`inBack`** → puede exportar una **FUNCIÓN**, que el FW invoca **bindeada** (`this` = instancia
  Schema → `this.db`, `this.pool`, `this.init`).

```js
/* global inFront, inBack */
let exp;

if (inFront) exp = {vue: {miComp: new URL("./vue", import.meta.url).pathname}};

// FUNCIÓN acá y objeto allá: el back necesita el bindeo para alcanzar this.db/this.pool; el front no ejecuta.
if (inBack)
  exp = async function () {
    const {db, pool} = this;          // ← por BINDEO, jamás por parámetro
    return {name: "My Plugin", types: [...], API: {...}, schemas: [...]};
  };

export default exp;
```

🔴 **`let exp = {}`, nunca `let exp;`**: el módulo se importa en los dos scopes, y un plugin solo-back que deja
`undefined` en el front hace caer el front de todo deploy que lo tenga (`Object.entries(undefined)` en el loader; caso
real: el plugin `telegram`). Los imports solo-back van **dentro** de la rama (`await import(...)`). El caso:
[references/scope-let-exp.md](references/scope-let-exp.md).

#### 🔴🔴 El FWPlugin NO recibe `db` por argumento (y confundirlo lo deja MUDO)

El motor invoca un FWPlugin función con `plugin.call(this)`, **sin argumentos**: `db`, `pool` e `init` salen de
`this` (`const {db} = this`). Escribir `export default function (db) { if (!db) return {}; ... }` deja `db` **siempre
`undefined`** → retorna `{}` → **el plugin carga y no aporta NADA, sin un solo error en el log**. La confusión viene
del **mongoosePlugin**, que sí recibe `db` por argumento:

| Qué | Cómo lo invoca el motor | Cómo obtiene db |
|---|---|---|
| **FWPlugin** (función) | `plugin.call(this)` | `const {db} = this` |
| **mongoosePlugin** (función) | `res.call(this, this.db)` | argumento **o** `this` |

Si el FWPlugin **no necesita lógica** → forma **objeto**. El código del motor, por qué no lo pasa y el caso que lo
destapó: [references/no-db-argument.md](references/no-db-argument.md).

## 🪄 Frontend — el hook de framework de reactividad (lo ultra-power)

Lo que hace a un FWPlugin una capa COMPLETA: además de back, declara su **frontend por framework**. Una
key por framework de reactividad soportado, cada una mapea nombres lógicos → rutas de los componentes:

```js
// self-declara sus paths con import.meta.url; los seis frameworks: references/front-mechanism.md
export default {
  vue2: { currency: new URL('./vue2', import.meta.url).pathname },
  react: { currency: new URL('./react', import.meta.url).pathname }
};
```

**Frameworks soportados**: `vue2`, `vue3`, `react`, `svelte`, `solid`, `lit` (extensible desde el plugin de Vite). El
valor de cada nombre lógico es un **PATH a un DIRECTORIO**, no a archivos sueltos, y asume una **front-library** montada
para ese framework (skill `itdfw-front-creation`).

La cascada de `customImport`: `@/<comp>` (app) → `default/<comp>` (sitio) → `<plugin>/<comp>` → `itdfw/<comp>` (front,
NUI) → `core/<comp>`. **La app y el default mandan siempre**; un plugin pisa al front y al core, nunca al site. El front
consume agnóstico (`const C = await customImport('ItdCurrency')`). El mecanismo de Vite paso a paso:
[references/front-mechanism.md](references/front-mechanism.md).

### 🔴🔴 En el FRONT el espejo es IMPERATIVO — la ubicación ES la declaración

En el back **declarás** las keys del objeto y el espejo de carpetas es orden: recomendado, funciona igual si te
salís. En el front **no declarás nada**: se descubre por **ubicación**, la carpeta ES el contrato, y lo que se sale del
molde **no existe**. La tabla: [references/front-mirror.md](references/front-mirror.md).

Una vez que el plugin declara su carpeta de framework (`vue: {miPlugin: <path a ./vue>}`), esa carpeta
**entra a la cascada como un nivel más**, exactamente igual que el core, el DEFAULT o la app. Y de ahí
en adelante **el sistema absorbe lo que encuentre, por convención de ruta**:

| Ponés esto en tu carpeta | Qué pasa |
|---|---|
| `router.js` (raíz) | **sus rutas se agregan al router**, sin registrar nada (`import.meta.glob("<base>/router.js")`) |
| `store/modules/*.js` | se mergean a los módulos del store |
| `store/plugins/*.js` | se agregan como plugins del store |
| `components/X.jsx` | resuelve cuando alguien pide `X`… **y si ya existía, lo PISA** |
| `views/X.jsx` | ídem para vistas (`component: "X"` en una ruta) |
| `mixins/`, `controllers/`, `injections/` | ídem — `customImport(nombre, base)` recorre la cascada por carpeta |
| **`init.js`** (raíz) | 🔴 **entra al BOOTSTRAP** — ver abajo, es la puerta más ancha de todas |

🔴 **`loaders/` NO está en esta lista, y es a propósito**: los loaders se cargan **por función**, no por
cascada de carpeta — se dejaron fuera justamente para que **nadie te los pise**.

Desde el `vue/init.js` del plugin, **un ítem en las barras** se agrega con `this.store.commit("app/setNavItem", {key,
component, sink, position, pos, when})` y la fuente del menú con `commit("app/setMenu", {ref})`; un plugin deja elegir
el `sink` al site. **Una punta propia se llama** con `this.$http.get/post/put(url, body, {params})`, nunca con `fetch` ni
`axios` importados. Los valores y el ejemplo vivo: [references/front-nav-http.md](references/front-nav-http.md).

🔴 **Pisar es SILENCIOSO y es la gracia, no el bug**: la cascada es *first-return* con la app en la punta más alta,
así que un plugin pisa un componente del core solo por **nombrarlo igual**. El único aviso es un `console.warn` en rutas
con el mismo `name`, y gana el último.

### 🔴 `init.js` — el plugin no solo APORTA: puede REESCRIBIR el arranque

El `init.js` del plugin corre en el bootstrap como un nivel más de la cascada y recibe el **pack**: **agrega** bloques,
**registra loaders** con `addLoader("$opcion", fn, pos, hoist)` y **modifica lo que registraron OTROS**, por nombre:
`pack.before/after("nombre", [items])`, `pack.replace("nombre", obj)` y `pack.delete("nombre")`. Un nombre se declara
**una vez**: redeclararlo para pisarlo hace caer el arranque; se usa `replace`. Así un plugin trae **un vertical de front
completo** (rutas + vistas + componentes + store + init) sin que la app toque una línea. Detalle, por qué existe
`delete` y la verificación e2e: [references/front-init.md](references/front-init.md). El pack y los loaders → skill
**`itdfw-core-init`**.

## Dónde vive y cómo se enchufa

**FWPlugin del FW propio / del deploy**: archivo en `FWPlugins/` (cascada: `SITE/FWPlugins/`
→ `<deploy>/DEFAULT/FWPlugins/` → app). El motor los descubre solo (`#getFiles("FWPlugins")`) — no hay
que registrarlos.

**FWPlugin externo / distribuible**: se enchufa en el **`.itdfw.js`** del sitio (raíz del deploy/app),
en el array `plugins`. Un FWPlugin es SOLO una estructura (objeto), así que hay **dos formas
equivalentes** de ponerlo — y elegir una u otra es **decisión del dev**, no una regla:
```js
import MCP from "@chumager/itdfw-mcp/plugin";
export default {
  plugins: [
    MCP,                                              // (1) importar un plugin que ya es módulo
    { vue: { currency: "/abs/path/FWPlugins/Currency/vue2" } } // (2) definir la estructura inline
  ]
};
```
- **(1) importar** un plugin existente (`import X; plugins:[X]`) — lo normal cuando ya es un módulo.
  Trae su back y su front; las apps que comparten el `.itdfw.js` lo heredan (override por cascada,
  **sin copiar a DEFAULT**).
- **(2) inline** — escribir la estructura literal directo en el array. Válido por sí mismo: p.ej. el
  dev necesita algo del scope local del `.itdfw.js`, o una pieza aún no se externalizó como módulo.

🔴 El `{ vue: { currency: <path> } }` de un deploy con moneda es la forma (2) como **parche temporal**, no por diseño.
Por qué, y por qué el front se declara en el `.itdfw.js` y no en la config del back:
[references/where-it-plugs.md](references/where-it-plugs.md). Los FWPlugins del core, con formato, keys y propósito:
[references/existing-plugins.md](references/existing-plugins.md).

### 🔴 Plugin de INFRAESTRUCTURA vs plugin de PRODUCTO: la regla del core vale para el primero

| Plugin | Ejemplos | Front |
|---|---|---|
| **de infraestructura** (lo usa cualquier site, con cualquier front) | translate, address, currency, chat | la regla de abajo: la funcionalidad nace en el core y el front cambia la piel |
| **de producto** (una suite vendible que declara su front) | `restaurant` | se elige el front (NUI): primero el **wrapper del FW** si existe (`ItdModal`, `ItdButton`…), el componente pelado de NUI solo si no hay wrapper; la **lógica de negocio** aparte (mixin o base Vue sin componentes) |

En un producto no se arma un render "core" con nativos para pisarlo después en NUI. En uno de infraestructura,
**la funcionalidad nace en el CORE y un front solo le cambia la piel** (jcmunoz 5-oct-2026): lo que el plugin necesita
del front lo provee el core, o lo declara como necesidad (gap); la versión NUI **hereda** la del core, y en un plugin con
suite la carpeta `nui` hereda de la de `vue`. Las reglas completas y su porqué:
[references/infra-vs-product.md](references/infra-vs-product.md).

### Plugin COMPUESTO — un arreglo de plugins

Un FWPlugin puede exportar un **arreglo** de otros plugins: el back (`#expandPlugins`) y el front
(`itdfw-vite-plugin`) aplanan a cualquier profundidad, así que cada uno se procesa como si se importara solo. Es
una lista, no un merge. Casos vivos: `financial` (`[duration, currency, finance]`) y `xumon` (la edición premium:
los transversales en un import). El orden importa: primero los que aportan types que usan los de después.

🔴 **Un plugin que DEPENDE de otro trae la base dentro de su export** (`export default [Base, lo propio]`) y la declara
en su `package.json`: el site pone solo el hijo y no tiene por qué saber que la base existe (jcmunoz 27-sep-2026).

Con **dos hijos de la misma base**, la base entra dos veces: el back **no deduplica** (lo que no tolera la repetición
tumba el arranque; por eso **la base registra su Config con `canOverride: true`**), `libs`, `API` y un NAMED sobreviven,
y el front sí deduplica. La base expone un **guard** (`enabled`) para que un hijo apagado o sin Config responda como
flujo (`[]`) y no con un 5XX. La tabla y la medición: [references/composite-base-twice.md](references/composite-base-twice.md).

## libs — interconexión runtime

`libs: { helper, ...lib }` → `Object.assign(pool.libs, value)`: disponibles vía `pool.libs` para cualquier modelo o
plugin del proceso (el pool y `shareData`→req: `itdfw-models` → `schema-engine.md`).

## API — solo lo propio del canal (detalle en itdfw-api-system)

Key = ruta bajo `/APP/` (sin prefijo `APP/`): `API: { rpc: { POST(req,res){...}, isAnonymous, hidden,
defaultMethods:["POST"] } }` → `/APP/rpc.json`. El motor hace `Object.assign(pool.API, value)` (misma
referencia, no la pisa). Dos gotchas que viven acá:
- **CSRF en POST**: `skipCSRF.push(req => req.path.includes("/rpc."))` (`/*global skipCSRF*/`).
- **Dev-only**: el archivo se hace cargo de su existencia, no el `index.js`. Una punta por archivo escapa en la
  raíz (`export default onDev ? {...} : {}`); un schema, en la primera línea de su función
  (`if (!onDev) return {};` antes del `init`). Deshabilitado = `{}`, nunca `null`. Detalle:
  `itdfw-completeness` → `references/test-discipline.md` §"El archivo se hace cargo".

Propiedades del endpoint (verbos, `isAnonymous`, `hidden`, `defaultMethods`, `noProfile`, metadata) y
el resto del sistema de puntas → **`itdfw-api-system`**.

## Timing / orden de carga

`Schema.process()` → `#expandPlugins()` reparte las keys a cada fase: **db → types → plugins → schemas** (cada una
cascada FW→DEFAULT→App); `pool.API`/`pool.libs` se mergean sobre la misma referencia. Detalle del motor → `itdfw-models`
→ `schema-engine.md` ([original](references/libs-timing.md)).

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Detallar schemas/types/API en este skill | Es solo coherencia + dónde va cada cosa — **refiere** al skill de cada key |
| Prefijar key API con `APP/` | El router agrega `/APP/` — usa `rpc`, no `APP/rpc` |
| Olvidar CSRF skip en POST | `skipCSRF.push(req => ...)` |
| Arrow fn en virtual de Mongoose | Virtuals necesitan `function()` para bindear `this` |
| Olvidar `this.init()` para deps de schema | Schemas que dependen de otros DEBEN await init (ver schema-engine.md) |
| `export default null` para deshabilitar | Usa `{}` — `null` rompe `Object.entries` |
| Pensar que un FWPlugin es "solo backend" | Puede traer su front completo por framework (§frontend) y ser un vertical entero distribuible |
| 🔴 `export default function (db)` en un FWPlugin | `db` llega `undefined` y el plugin falla **MUDO**: se saca de `this`, y el scope se decide con `inFront`/`inBack` |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.

