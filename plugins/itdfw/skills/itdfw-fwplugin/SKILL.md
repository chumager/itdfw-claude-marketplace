---
name: itdfw-fwplugin
description: Use when creating or understanding an ITDFW FWPlugin — the back-to-front layer that bundles models, mongoose plugins, custom types, API endpoints, shared libs AND its own framework-specific frontend into one cohesive, distributable unit. Covers what a FWPlugin IS, its keys (each delegating to the right skill), the reactivity-framework frontend hook, and load timing.
---

# ITDFW FWPlugins

## Qué ES un FWPlugin (y por qué existe)

Un FWPlugin es una **capa que cruza TODO el stack back→front**. No es "un plugin de backend": es un
objeto declarativo que puede traer **modelos, mongoose-plugins, types custom, endpoints API, libs
compartidas Y su propio frontend** (componentes/vistas por framework), sobreescribiendo o creando lo
que quiera. Un carro de compras completo —o todo el vertical cooperativas— puede ser UN FWPlugin: las
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

🔴 **Es RECOMENDADA, no obligatoria**: salvo la carpeta del front, el motor solo lee las **keys del objeto**
que exportás — podrías poner todo inline y funciona igual. Pero espejar el back es lo que mantiene el FWP
legible y coherente con el resto del FW. Para arrancar bien, **copiá el template** (`assets/fwplugin-template/`),
🔴 **incluido su `package.json`**: trae la whitelist `files` (rule `package-files-whitelist`) con las carpetas del
espejo y `README.md`, y **sin `TDD*.md` ni `test/`**: el README es la cara del paquete, el TDD es la cocina y va en
git pero no en el tarball (jcmunoz 17-sep-2026). Seis plugins nacidos antes de esa decisión declararon `TDD.md` a
mano en `files` porque el template no traía `package.json`; el veto de `itdfw-deps.sh files` los cazó el 18-sep.
Los FWP que viven INLINE en `back/.../FWPlugins/` (Currency.js, PDF.js) están así por **migración desde el
core** (se movieron/mergearon), NO porque sea el patrón a imitar.

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

🔴 **`let exp = {}`, nunca `let exp;`.** El módulo se importa en los dos scopes siempre: un plugin
solo-back que hace `if (inBack) exp = {…}` deja **`undefined` en el front** → `Object.entries(undefined)`
en el loader → **cae el front de todo deploy que lo tenga instalado**. Caso real 2026-08-26
(`plugins/telegram`). Partir de `{}` es la línea que lo evita — el front recibe un objeto vacío y sigue.
Y si el plugin solo-back no quiere que el front cargue sus dependencias (telegraf, libs del back), los
imports van **dentro** de la rama (`await import(...)`), no arriba del archivo.

#### 🔴🔴 El FWPlugin NO recibe `db` por argumento (y confundirlo lo deja MUDO)

Verificado en `back/itdfw/src/SITE/mongooseSchema/index.js` → `#expandPlugins`:

```js
if (typeof plugin === "function") {
  result = await plugin.call(this);   // ← SOLO bindea `this`. NINGÚN argumento.
  if (!result) continue;
}
```

(igual para los FWPlugins descubiertos por archivo: `imported.call(this)`)

**Por qué no lo pasa:** porque `this` **ya lo trae** — `Schema`'s constructor hace `this.db = db`. Bindear
la instancia es entregar `db` (y `pool`, e `init`) de una. Pasarlo aparte sería redundante. Eso es todo.

⟹ Escribir `export default function (db) { if (!db) return {}; ... }` hace que `db` sea **siempre
`undefined`** → retorna `{}` → **el plugin carga y no aporta NADA, sin un solo error en el log**. No hay
modelos, no hay índices, no hay warning: falla en silencio y se pierde media hora dudando del modelo.

**De dónde viene la confusión:** el que SÍ recibe `db` por argumento es el **mongoosePlugin**, en
`#addPluginFromObject` del mismo archivo:

```js
if (res.constructor.name === "AsyncFunction") res = await res.call(this, this.db);
else res = res.call(this, this.db);
```

| Qué | Cómo lo invoca el motor | Cómo obtiene db |
|---|---|---|
| **FWPlugin** (función) | `plugin.call(this)` | `const {db} = this` |
| **mongoosePlugin** (función) | `res.call(this, this.db)` | argumento **o** `this` |

Si el FWPlugin **no necesita lógica** (solo declara keys estáticas) → forma **objeto** directo, sin
función y sin scope que resolver. La función es solo para los que SÍ necesitan runtime.

*(Corregido 2026-08-14: el skill documentaba `function (db)` con detección por ausencia del argumento —
le atribuía al FWPlugin la firma del mongoosePlugin. Cazado cuando `plugins/conversation` cargó mudo.)*

## 🪄 Frontend — el hook de framework de reactividad (lo ultra-power)

Lo que hace a un FWPlugin una capa COMPLETA: además de back, declara su **frontend por framework**. Una
key por framework de reactividad soportado, cada una mapea nombres lógicos → rutas de los componentes:

```js
// índice del plugin (o key del FWPlugin) — self-declara sus paths con import.meta.url
export default {
  vue2:   { currency: new URL('./vue2',   import.meta.url).pathname },
  vue3:   { currency: new URL('./vue3',   import.meta.url).pathname },
  react:  { currency: new URL('./react',  import.meta.url).pathname },
  svelte: { currency: new URL('./svelte', import.meta.url).pathname },
  solid:  { currency: new URL('./solid',  import.meta.url).pathname },
  lit:    { currency: new URL('./lit',    import.meta.url).pathname }
};
```

**Frameworks soportados out-of-the-box**: `vue2`, `vue3`, `react`, `svelte`, `solid`, `lit`
(extensible — se pueden agregar/override pasando un mapa de detección al plugin de Vite). El **valor de
cada nombre lógico es un PATH a un DIRECTORIO** (ej. `./vue2`), no a archivos sueltos — el FW resuelve
los componentes dentro de esa carpeta vía la cascada de `customImport`. El front por framework asume que
existe una **front-library** montada para ese framework (cómo se arma un front nuevo → skill
`itdfw-front-creation`); este skill solo cubre cómo el plugin la declara/enchufa.

**Mecanismo** (`@chumager/itdfw-vite-plugin` + `.itdfw.js` del sitio):
1. Vite detecta el framework activo desde sus propios plugins (el framework va primero en `plugins[]`).
2. El plugin ITDFW extrae los aliases del framework detectado desde los plugins mergeados (`configArray('plugins')`).
3. Genera el módulo virtual `virtual:itdfw-custom-import` con búsqueda en **cascada**:
   `@/<comp>` (app) → `default/<comp>` (sitio) → `currency/<comp>` (plugins) → `itdfw/<comp>` (front, NUI) →
   `core/<comp>` (`libs/itdfw-vite-plugin/index.js`, `basePaths` de `customImport`). **La app y el default mandan
   siempre**; un plugin pisa al front y al core, nunca al site. Los merges (`init.js`, store) recorren al revés (core
   primero) para que la app gane igual; `public/` se copia de abajo hacia arriba por lo mismo.
4. El front consume agnóstico: `const C = await customImport('ItdCurrency')` — el mismo código corre en
   cualquier framework; el plugin resuelve al binario correcto.

⟹ un FWPlugin enchufa UI en el front sin que la app sepa nada, y framework-agnóstico. Es la pieza que
permite que el plugin sea de verdad back2front.

### 🔴🔴 En el FRONT el espejo es IMPERATIVO — la ubicación ES la declaración

Acá está la **asimetría** con el back, y es de naturaleza, no de estilo:

| | **Back** | **Front** |
|---|---|---|
| Cómo llega al motor | **DECLARAS** las keys del objeto (`schemas`, `types`, `plugins`, `API`) | **NO declaras nada**: se descubre por **ubicación** |
| El espejo de carpetas | por **coherencia y orden** — recomendado, no obligatorio | **imperativo**: la carpeta ES el contrato |
| Si te sales del molde | funciona igual (el motor lee las keys) | **no existe**: nadie lo va a encontrar |

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

Dos cosas del front de un plugin que no se adivinan (gap #42, 2026-09-20): **un ítem en las barras** se agrega
desde el `vue/init.js` del plugin con `this.store.commit("app/setNavItem", {key, component, sink, position:
"first" | "center" | "last", pos, when})`, donde `sink` es `"nav"`, `"side"`, `"drawer"`, un arreglo o una función
del ancho; y la fuente del menú se enchufa con `commit("app/setMenu", {ref})` (modelo completo: skill `itdfw-nui` §5;
ejemplo vivo: `plugins/typesafe-palette/vue/init.js`). Un plugin que no deja elegir el sink de lo que agrega le quita
la libertad al site. Y **una punta propia se llama** con `this.$http.get/post/put(url, body, {params})`, nunca con
`fetch` ni `axios` importados.

🔴 **Pisar es SILENCIOSO y es la gracia, no el bug**: la cascada es *first-return* con la app en la punta
más alta, así que un plugin puede sobreescribir un componente del core solo por **nombrarlo igual**. Es la
misma libertad que los mongoose-plugins tienen en el back (§"pisar/inyectar"). El único aviso es en
rutas: si dos niveles declaran el mismo `name`, el loader emite un `console.warn`
(*"[Router] X ya existe, interceptado por …"*) — pero igual gana el último.

### 🔴 `init.js` — el plugin no solo APORTA: puede REESCRIBIR el arranque

El bootstrap descubre los `init.js` por la MISMA cascada (`customImportArray("init.js")`), así que el del
plugin corre como un nivel más. Y un init recibe el **pack** (Proxy de bloques), lo que le permite:

- **agregar** bloques: globals, mixins, componentes, plugins de Vue, métodos al prototype;
- **registrar loaders** con `addLoader("$opcion", fn, pos, hoist)` — que modifican componentes **durante
  el localImport, antes de que Vue los vea** (lo que un plugin de Vue no puede hacer);
- 🔴 **modificar lo que registraron OTROS**, por nombre: `pack.before/after("nombre", [items])` (un bloque nuevo
  antes o después del de ese nombre), `pack.replace("nombre", obj)` y `pack.delete("nombre")` (ese ítem, no el
  bloque). Un nombre se declara **una vez**: redeclararlo para pisarlo hace caer el arranque; se usa `replace`, o un
  bloque después que reescribe `this.nombre` (skill `itdfw-core-init`, `pack-proxy.md`).

⟹ Es la contraparte front de la "black magic" de los mongoose-plugins, y `delete` está ahí **porque hace
falta**: si un nivel de abajo registra algo que impone una restricción que no necesitas o que rompe tu
código, sacarlo es la única salida. No es una función "por completitud" — es la que evita que quedes
atrapado por lo que decidió otro. Se usa sabiendo lo que se hace.

⟹ **`loaders/` queda fuera de la cascada de carpetas a propósito**: se registran por función desde un
init, y así **nadie te los pisa** por el solo hecho de nombrar un archivo igual.

Detalle del pack, flags de registro y cómo escribir loaders → skill **`itdfw-core-init`**.

⟹ Un plugin puede traer **un vertical de front completo** (rutas + vistas + componentes + store + init)
sin que la app toque una línea, y sin declarar más que la carpeta.

*(Verificado e2e el 2026-08-15: `plugins/conversation/vue/router.js` + `vue/views/Chat.jsx` → la ruta
`/Chat` renderizó la vista del plugin sin tocar el site.)*

## Dónde vive y cómo se enchufa

**FWPlugin del FW propio / del deploy**: archivo en `FWPlugins/` (cascada `back/itdfw/src/SITE/FWPlugins/`
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

🔴 El `{ vue: { currency: <path> } }` de cooperativa es la forma (2) como **parche temporal** (no por
diseño): Currency todavía vive DENTRO del back → Vite no puede descubrir su front → se declara a mano.
Al externalizar Currency será un import directo como (1). No es "una forma de front" — es inline por
decisión, que acá resuelve un front no-externalizado.

**Por qué el front se declara acá y no en la config del back**: la config del back y la del default/app
son **dos instancias distintas** de lo mismo (no se sobrecargan entre sí). El front de un plugin que
vive en el back no puede inyectarse vía la config del back → se declara en el `.itdfw.js` del front.

### 🔴 Plugin de INFRAESTRUCTURA vs plugin de PRODUCTO: la regla del core vale para el primero

| Plugin | Ejemplos | Front |
|---|---|---|
| **de infraestructura** (lo usa cualquier site, con cualquier front) | translate, address, currency, chat | la regla de abajo: la funcionalidad nace en el core y el front cambia la piel |
| **de producto** (una suite vendible que declara su front) | `restaurant` | se elige el front (NUI) y el render usa sus componentes: primero el **wrapper del FW** si existe (`ItdModal`, `ItdButton`, `Icon`…, revisar con el MCP `inventory`), y el componente pelado de NUI (`n-card`, `n-ellipsis`, `n-tag`…) solo si no hay wrapper; la **lógica de negocio** queda aparte, en un mixin o en una base Vue sin componentes |

En un producto no se arma un render "core" con nativos para pisarlo después en NUI: es una semana de trabajo para
tener un card pelado, y se pierde lo que NUI resuelve (expandir, modal, carrusel, tema). La lógica separada cubre el
caso raro de cambiar de framework (jcmunoz 24-oct-2026: *"si vamos a usar nui hay que usar los providers que nos da
nui, si no, ¿pa qué tenemos nui? ¿pa armar un card pelao?"*).

### 🔴 La funcionalidad nace en el CORE; un front solo le cambia la piel (jcmunoz 5-oct-2026) — plugins de infraestructura

- Lo que un plugin necesita del front (un modal, un switch, un color por estado) lo provee el **core**, aunque sea
  feo: componente y lógica funcionan sin ningún front. Si el core no lo tiene, el plugin lo **declara como
  necesidad** (gap); usar un componente de NUI u otro front en directo es la excepción declarada, no la vía.
- Si NUI aporta algo especial, su versión **hereda** la del core y cambia la piel, no la lógica.
- En un plugin con suite (`vue` + `nui`), la carpeta `nui` **hereda** de la de `vue` (o ambas comparten un mixin): la
  lógica se escribe una vez. Una `nui` que reimplementa la lógica son dos plugins pegados, y es lock-in corrido.

### Plugin COMPUESTO — un arreglo de plugins

Un FWPlugin puede exportar un **arreglo** de otros plugins: el back (`#expandPlugins`) y el front
(`itdfw-vite-plugin`) aplanan a cualquier profundidad, así que cada uno se procesa como si se importara solo. Es
una lista, no un merge. Casos vivos: `financial` (`[duration, currency, finance]`) y `xumon` (la edición premium:
los transversales en un import). El orden importa: primero los que aportan types que usan los de después.

🔴 **Un plugin que DEPENDE de otro trae la base dentro de su export** (`export default [Base, lo propio]`) y la declara
en su `package.json`: el site pone solo el hijo y no tiene por qué saber que la base existe (jcmunoz 27-sep-2026).

| Con dos hijos de la misma base, la base entra DOS veces | Qué pasa |
|---|---|
| back | **no deduplica**: todo lo que la base registra se registra dos veces, y lo que no tolera la repetición tumba el arranque |
| `setConfigDefinition(name, schema, level, canOverride)` | lanza `redefining X is not allowed` si la primera fue sin `canOverride` ⟹ **la base registra su Config con `canOverride: true`** |
| `libs`, `API`, un NAMED reaplicado | sobreviven la repetición |
| front | sí deduplica: la carpeta de framework de la base entra con el mismo nombre y una inyección suya se pinta una vez |

Y la base expone un **guard** (`enabled`, con un interruptor `enabled` en su Config; no `active`, que es nombre
reservado) para que un hijo apagado o sin configurar responda como flujo (`[]`) y no con un 5XX que termina en correo
al admin. Medido 27-sep-2026 en el site `jev` con `plugins/typesafe` + `plugins/typesafe-icon`.

## libs — interconexión runtime

`libs: { helper, ...lib }` → el motor hace `Object.assign(pool.libs, value)`. Quedan disponibles vía
`pool.libs` para cualquier modelo/plugin del proceso. Es uno de los flujos de inyección al pool (el
detalle del pool + `shareData`→req vive en `itdfw-models` → `schema-engine.md`).

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

`Schema.process()` → `#expandPlugins()` reparte las keys del FWPlugin a cada fase del motor: **db →
types → plugins → schemas** (cada una cascada FW→DEFAULT→App). `pool.API`/`pool.libs` se mergean sobre
la misma referencia. El detalle del motor (fases, espera por proxy, eventos, completitud) →
`itdfw-models` → `schema-engine.md`.

## Plugins existentes (referencia)

| File | Formato | Keys | Propósito |
|------|---------|------|-----------|
| Currency.js | objeto | types, plugins, vue2 | type Currency + `hasCurrency` + formato + front Vue2 |
| Config.js | función | db, plugins, schemas | modelo Config + getConfig + PubSub |
| PDF.js | objeto | types, db, plugins, schemas | `db.createPDF` + schema Font + plugin toPDF |
| Finance | función | libs, plugins | schemas de Fee (simple/dated/operational), IRR, gastos |
| MCP.js | objeto | API | endpoint protocolo MCP (dev-only) |

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
| 🔴 `export default function (db)` en un FWPlugin | El motor lo llama `plugin.call(this)` **sin argumentos** → `db` es `undefined`, el plugin retorna vacío y **falla MUDO**. Se saca de `this` y el scope se decide con `inFront`/`inBack` |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
