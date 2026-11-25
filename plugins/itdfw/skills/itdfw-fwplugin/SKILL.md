---
name: itdfw-fwplugin
description: Use when creating or understanding an ITDFW FWPlugin — the back-to-front layer that bundles models, mongoose plugins, custom types, API endpoints, shared libs AND its own framework-specific frontend into one cohesive, distributable unit. Covers what a FWPlugin IS, its keys (each delegating to the right skill), the reactivity-framework frontend hook, and load timing.
---

# ITDFW FWPlugins

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [composite-base-twice.md](references/composite-base-twice.md) | Plugin compuesto cuya base entra dos veces: tabla de qué deduplica back/front, `setConfigDefinition` con `canOverride`, guard `enabled` | Dos plugins hijos comparten una base y el arranque cae o duplica registros |
| [existing-plugins.md](references/existing-plugins.md) | Tabla de FWPlugins del core (Currency, Config, PDF, Finance...) con formato, keys y propósito | Buscas un FWPlugin de ejemplo o qué keys usa uno existente |
| [folder-structure.md](references/folder-structure.md) | Template `assets/fwplugin-template/`, su `package.json` con whitelist `files`, FWP inline del core (Currency, PDF) | Arrancas un plugin nuevo o armas su `package.json` y carpetas |
| [front-init.md](references/front-init.md) | Pisar componentes del front por nombre (cascada first-return, warn de rutas) e `init.js` que reescribe el arranque, verificación e2e | Tu plugin sobreescribe un componente o toca el arranque del front |
| [front-mechanism.md](references/front-mechanism.md) | Frameworks soportados (`vue2`, `vue3`, `react`, `svelte`, `solid`, `lit`) y el mecanismo del plugin de Vite con `import.meta.url` y `.itdfw.js` | Declaras el front de un plugin o agregas soporte de un framework |
| [front-mirror.md](references/front-mirror.md) | Asimetría back/front del espejo de carpetas: back declara keys, front se descubre por ubicación | Dudas dónde poner un archivo del front y por qué no se encuentra |
| [front-nav-http.md](references/front-nav-http.md) | Ítems de barras y menú (`app/setNavItem`, `app/setMenu`, `sink`, `position`) y llamar puntas con `this.$http` | Tu plugin agrega ítems de navegación o llama una punta propia desde el front |
| [infra-vs-product.md](references/infra-vs-product.md) | Plugin de infraestructura vs de producto, y la regla de que la funcionalidad nace en el core | Decides dónde vive la lógica y cómo se declara el front de un plugin nuevo |
| [keys-detail.md](references/keys-detail.md) | Filas completas de las keys `auth`, `wellKnown` y `captcha`: forma, orden, `pos`, validación, errores | Implementas autenticadores, aportes a `/.well-known` o proveedores de captcha |
| [libs-timing.md](references/libs-timing.md) | Key `libs` (`Object.assign(pool.libs)`) y orden de carga db → types → plugins → schemas | Dudas cuándo está disponible una lib o en qué fase se aplica cada key |
| [no-db-argument.md](references/no-db-argument.md) | El FWPlugin no recibe `db` por argumento: `#expandPlugins`, `plugin.call(this)`, por qué queda mudo | Tu plugin función no hace nada o `db` llega `undefined` |
| [scope-let-exp.md](references/scope-let-exp.md) | `let exp = {}` y no `let exp;` en plugins solo-back; imports dinámicos dentro de la rama | Escribes un plugin solo-back o solo-front, o cae el front por `Object.entries(undefined)` |
| [where-it-plugs.md](references/where-it-plugs.md) | Front de Currency inline y por qué el front se declara en el `.itdfw.js` y no en la config del back | Tu plugin vive dentro del back y su front no se descubre |

## Qué ES un FWPlugin

Un FWPlugin es una **capa que cruza TODO el stack back→front**: un objeto declarativo que puede traer **modelos,
mongoose-plugins, types custom, endpoints API, libs compartidas Y su propio frontend** por framework. Un vertical de
negocio entero puede ser UN FWPlugin: las apps lo **importan y heredan todo** y sobreescriben solo lo que necesiten
(cascada normal), sin copiar nada a su `DEFAULT`.

**Dos motivos para que exista:**
1. **Coherencia estructural** — piezas heterogéneas que van juntas (`Config.js` junta `db` + `plugins` + `schemas`).
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
| `auth` | Autenticadores `{name, claims, authenticate, pos?}` o un arreglo: `claims(req)` **síncrono** y barato; `authenticate(req)` → `{model, user}`, `undefined` o lanza si la credencial es suya y está mala; no escribe `req.auth`. Orden y `pos`: [keys-detail](references/keys-detail.md) | **`itdfw-api-system`** → "El acceso paso a paso" |
| `wellKnown` | Aportes a `/.well-known/<nombre>`: `{<nombre>: {type, final?, content}}`, validados en el arranque y mezclados al pedirse ([keys-detail](references/keys-detail.md)) | `wellKnown` (utilidad del core) |
| `captcha` | Proveedores `{name, publicSpec(req, ctx), verify(req, token, ctx), challenge?(req, ctx), external: boolean}` o un arreglo. **El core no trae ninguno.** **Solo se usan** si el `formSpecs` de un modelo declara `captcha` para ese tipo. Cuál aplica y los errores: [keys-detail](references/keys-detail.md) | `captcha` (utilidad del core) |
| `refs` | Fuentes de opciones de un select con nombre (`"plugin/nombre": (req, query) => [{value, text}]`) → `pool.refs`, que leen `getRef`/`getSimpleName`; el campo las pide con `myRef: "plugin/nombre"` | **`itdfw-models`** → `references/special-refs.md` §4 |
| `vue2`/`vue3`/`react`/`svelte`/`solid`/`lit` | **Frontend** por framework | abajo (§frontend) — lo único exclusivo del FWPlugin |
| `name` | Nombre para logging | — |

## Estructura

Exporta un **objeto** (simple: `Currency.js`, `PDF.js`) o una **función que retorna un objeto** (necesita runtime:
`Config.js`, Finance; `this` = instancia Schema → `db`, `pool`, `init`, ver `schema-engine.md` en `itdfw-models`). Los
dos se escriben con el molde de §scope de abajo.

### 🔴 Estructura de carpetas — un FWP ESPEJA el back + el front, con `lib/` común

`lib/` guarda lo **isomorphic** (Value Objects, helpers puros); el `index.js` solo ENSAMBLA, importando de las carpetas:

```
<plugin>/
  index.js            → ensambla (name + keys types/plugins/schemas/API/db + <framework>)
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

🔴 **Es RECOMENDADA, no obligatoria**: salvo la carpeta del front, el motor solo lee las **keys del objeto**. Se arranca
**copiando el template** (`assets/fwplugin-template/`), 🔴 **incluido su `package.json`**: whitelist `files` (rule
`package-files-whitelist`) con las carpetas del espejo y `README.md`, **sin `TDD*.md` ni `test/`** (el TDD va en git, no
en el tarball). FWP inline del core: [references/folder-structure.md](references/folder-structure.md).

### 🔴 El scope se decide con `inFront`/`inBack` — NUNCA por el argumento

El MISMO módulo se evalúa en **dos scopes**; los **globales `inFront` / `inBack`** deciden QUÉ SE EXPORTA:

- **`inFront`** → exporta **la ESTRUCTURA (objeto)** con las keys de framework (`vue`/`vue3`/`react`/…).
  Vite lee las keys directo, sin ejecutar nada.
- **`inBack`** → puede exportar una **FUNCIÓN**, que el FW invoca **bindeada** (`this` = instancia
  Schema → `this.db`, `this.pool`, `this.init`).

```js
/* global inFront, inBack */
let exp = {};                         // nunca `let exp;` (ver abajo)

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
`undefined` en el front hace caer el front de todo deploy que lo tenga (`Object.entries(undefined)` en el loader). Los
imports solo-back van **dentro** de la rama (`await import(...)`). El porqué: [references/scope-let-exp.md](references/scope-let-exp.md).

#### 🔴🔴 El FWPlugin NO recibe `db` por argumento (y confundirlo lo deja MUDO)

El motor invoca un FWPlugin función con `plugin.call(this)`, **sin argumentos**: `db`, `pool` e `init` salen de
`this`. `export default function (db) { if (!db) return {}; ... }` deja `db` **siempre `undefined`** → retorna `{}` →
**el plugin carga y no aporta NADA, sin error en el log**. La confusión viene del **mongoosePlugin**, que sí lo recibe:

| Qué | Cómo lo invoca el motor | Cómo obtiene db |
|---|---|---|
| **FWPlugin** (función) | `plugin.call(this)` | `const {db} = this` |
| **mongoosePlugin** (función) | `res.call(this, this.db)` | argumento **o** `this` |

Si el FWPlugin **no necesita lógica** → forma **objeto**. El código del motor, por qué no lo pasa: [references/no-db-argument.md](references/no-db-argument.md).

## 🪄 Frontend — el hook de framework de reactividad

Una key por framework de reactividad; cada una mapea nombres lógicos → rutas de los componentes:

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

La carpeta de framework declarada **entra a la cascada como un nivel más** (igual que el core, el DEFAULT o la app) y el
sistema **absorbe lo que encuentre, por convención de ruta**:

| Ponés esto en tu carpeta | Qué pasa |
|---|---|
| `router.js` (raíz) | **sus rutas se agregan al router**, sin registrar nada (`import.meta.glob("<base>/router.js")`) |
| `store/modules/*.js` | se mergean a los módulos del store |
| `store/plugins/*.js` | se agregan como plugins del store |
| `components/X.jsx` | resuelve cuando alguien pide `X`… **y si ya existía, lo PISA** |
| `views/X.jsx` | ídem para vistas (`component: "X"` en una ruta) |
| `mixins/`, `controllers/`, `injections/` | ídem — `customImport(nombre, base)` recorre la cascada por carpeta |
| **`init.js`** (raíz) | 🔴 **entra al BOOTSTRAP** — ver abajo, es la puerta más ancha de todas |

🔴 **`loaders/` NO está en la lista, a propósito**: los loaders se cargan **por función**, así **nadie te los pisa**.

Desde el `vue/init.js` del plugin, **un ítem en las barras** se agrega con `this.store.commit("app/setNavItem", {key,
component, sink, position, pos, when})` y la fuente del menú con `commit("app/setMenu", {ref})`; un plugin deja elegir
el `sink` al site. **Una punta propia se llama** con `this.$http.get/post/put(url, body, {params})`, nunca con `fetch` ni
`axios` importados. Los valores y el ejemplo vivo: [references/front-nav-http.md](references/front-nav-http.md).

🔴 **Pisar es SILENCIOSO y es la gracia, no el bug**: la cascada es *first-return*, así que un plugin pisa un componente
del core solo por **nombrarlo igual**. El único aviso: un `console.warn` en rutas con el mismo `name` (gana el último).

### 🔴 `init.js` — el plugin no solo APORTA: puede REESCRIBIR el arranque

El `init.js` del plugin corre en el bootstrap y recibe el **pack**: **agrega** bloques,
**registra loaders** con `addLoader("$opcion", fn, pos, hoist)` y **modifica lo que registraron OTROS**, por nombre:
`pack.before/after("nombre", [items])`, `pack.replace("nombre", obj)` y `pack.delete("nombre")`. Un nombre se declara
**una vez**: redeclararlo para pisarlo hace caer el arranque; se usa `replace`. Así un plugin trae un vertical de front
completo sin que la app toque una línea. Detalle, `delete` y la verificación e2e: [references/front-init.md](references/front-init.md). El pack y los loaders → skill
**`itdfw-core-init`**.

## Dónde vive y cómo se enchufa

**FWPlugin del FW propio / del deploy**: archivo en `FWPlugins/` (cascada `SITE/` → `<deploy>/DEFAULT/` → app); el motor
los descubre solo (`#getFiles("FWPlugins")`), sin registrarlos.

**FWPlugin externo / distribuible**: en el array `plugins` del **`.itdfw.js`** del sitio, de **dos formas equivalentes**
(elegir es decisión del dev, no una regla):
```js
import MCP from "@chumager/itdfw-mcp/plugin";
export default {
  plugins: [
    MCP,                                              // (1) importar un plugin que ya es módulo
    { vue: { currency: "/abs/path/FWPlugins/Currency/vue2" } } // (2) definir la estructura inline
  ]
};
```
- **(1) importar** un módulo (`import X; plugins:[X]`): trae su back y su front, y las apps que comparten el `.itdfw.js`
  lo heredan (override por cascada, **sin copiar a DEFAULT**).
- **(2) inline**: la estructura literal en el array (scope local del `.itdfw.js`, o pieza no externalizada). La ruta a
  `vue2` del ejemplo es el caso inline real (una carpeta por versión); `vue` sin versión sirve a las dos.

Por qué el front se declara en el `.itdfw.js` y no en la config del back, y el front de moneda inline como ejemplo:
[references/where-it-plugs.md](references/where-it-plugs.md). Los FWPlugins del core: [references/existing-plugins.md](references/existing-plugins.md).

### 🔴 Plugin de INFRAESTRUCTURA vs plugin de PRODUCTO: la regla del core vale para el primero

| Plugin | Ejemplos | Front |
|---|---|---|
| **de infraestructura** (lo usa cualquier site, con cualquier front) | translate, address, currency, chat | la regla de abajo: la funcionalidad nace en el core y el front cambia la piel |
| **de producto** (una suite vendible que declara su front) | `restaurant` | se elige el front (NUI): primero el **wrapper del FW** si existe (`ItdModal`, `ItdButton`…), el componente pelado de NUI solo si no hay wrapper; la **lógica de negocio** aparte (mixin o base Vue sin componentes) |

En un producto no se arma un render "core" con nativos para pisarlo después en NUI. En uno de infraestructura,
**la funcionalidad nace en el CORE y un front solo le cambia la piel**: lo que el plugin necesita del front lo provee el
core, o lo declara como necesidad (gap); la versión NUI **hereda** la del core, y en un plugin con suite la carpeta `nui`
hereda de la de `vue`. Reglas y porqué: [references/infra-vs-product.md](references/infra-vs-product.md).

### Plugin COMPUESTO — un arreglo de plugins

Un FWPlugin puede exportar un **arreglo** de otros plugins: el back (`#expandPlugins`) y el front
(`itdfw-vite-plugin`) aplanan a cualquier profundidad, así que cada uno se procesa como si se importara solo. Es
una lista, no un merge. El orden importa: primero los que aportan types que usan los de después.

🔴 **Un plugin que DEPENDE de otro trae la base dentro de su export** (`export default [Base, lo propio]`) y la declara
en su `package.json`: el site pone solo el hijo y no tiene por qué saber que la base existe.

Con **dos hijos de la misma base**, la base entra dos veces: el back **no deduplica** (lo que no tolera la repetición
tumba el arranque; por eso **la base registra su Config con `canOverride: true`**), `libs`, `API` y un NAMED sobreviven,
y el front sí deduplica. La base expone un **guard** (`enabled`) para que un hijo apagado o sin Config responda como
flujo (`[]`) y no con un 5XX. La tabla y la medición: [references/composite-base-twice.md](references/composite-base-twice.md).

## libs — interconexión runtime

`libs: { helper, ...lib }` → `Object.assign(pool.libs, value)`: disponibles vía `pool.libs` para cualquier modelo o
plugin del proceso (el pool y `shareData`→req: `itdfw-models` → `schema-engine.md`).

## API — lo propio del canal

Key = ruta bajo `/APP/` (sin prefijo `APP/`): `API: { rpc: { POST(req,res){...}, isAnonymous, hidden,
defaultMethods:["POST"] } }` → `/APP/rpc.json`. El motor hace `Object.assign(pool.API, value)` (misma
referencia, no la pisa). Dos gotchas:
- **CSRF en POST**: `skipCSRF.push(req => req.path.includes("/rpc."))` (`/*global skipCSRF*/`).
- **Dev-only**: el archivo se hace cargo de su existencia, no el `index.js`. Una punta por archivo escapa en la
  raíz (`export default onDev ? {...} : {}`); un schema, en la primera línea de su función
  (`if (!onDev) return {};` antes del `init`). Deshabilitado = `{}`, nunca `null`. Detalle:
  `itdfw-completeness` → `references/test-discipline.md` §"El archivo se hace cargo".

Propiedades del endpoint (`isAnonymous`, `hidden`, `defaultMethods`, `noProfile`…) → **`itdfw-api-system`**.

## Timing / orden de carga

`Schema.process()` → `#expandPlugins()` reparte las keys a cada fase: **db → types → plugins → schemas** (cada una
cascada FW→DEFAULT→App); `pool.API`/`pool.libs` se mergean sobre la misma referencia. Detalle del motor → `itdfw-models`
→ `schema-engine.md` ([original](references/libs-timing.md)).

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Prefijar key API con `APP/` | El router agrega `/APP/` — usa `rpc`, no `APP/rpc` |
| Arrow fn en virtual de Mongoose | Virtuals necesitan `function()` para bindear `this` |
| Olvidar `this.init()` para deps de schema | Si depende de otro schema, `await this.init` (schema-engine.md) |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.

