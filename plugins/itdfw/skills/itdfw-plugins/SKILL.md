---
name: itdfw-plugins
description: Use when creating, applying, or understanding mongoose plugins in the ITDFW framework — extending a schema with methods/virtuals/statics/hooks, or overriding/injecting behaviour into models. Covers the 3 application modes (global, filtered-by-option, named-by-schema), overwriting an existing field's type, and the "black magic" of pisar anything in any layer. NOT the FWPlugin shell (that only packages keys — see itdfw-fwplugin).
---

# ITDFW Plugin System

## Qué ES (y qué NO)

El **sistema de plugins** es el MOTOR DE EXTENSIÓN del FW: un mongoose-plugin extiende un schema
(methods / virtuals / statics / hooks / paths) corriendo con **`this` = la instancia Schema del FW**.
Es **anterior e independiente** de los FWPlugins.

🔴 **NO confundir con FWPlugin**: el FWPlugin (skill `itdfw-fwplugin`) es SOLO la **cáscara** que empaqueta
keys (`db/types/plugins/schemas/API/libs/vue`) para que el motor las reparta. El sistema de plugins es el
motor real; un FWPlugin, entre otras cosas, puede *aportar* plugins en su key `plugins`. Las magias negras
(pisar/inyectar) viven en el sistema de plugins y funcionan SIN FWPlugins.

**Dónde**: un archivo `.js` en la carpeta `mongoosePlugins/` de la cascada (core `SITE/`, o el `DEFAULT/`/`App/` equivalente).
`loadPlugins()` los **autodescubre por disco** — no hay que registrarlos. Prefijo numérico (`02hasFiles.js`)
ordena la carga alfabética. Export `default` = un **objeto** o una **función factory** — la factory se
invoca **bindeada** (`this` = instancia Schema del FW) con `db` como arg0. Ver "Binding & parámetros" abajo
(NO es un simple `(db) => objeto`).

## 🔴 Las magias son la PUERTA DE ENTRADA — no para el core

El FW está diseñado para magias, pero el **CORE casi no las usa** (0 plugins NAMED, mínimo re-cast por
cobertura) — y eso es **CORRECTO, no carencia**. Con el código a la mano, lo que quieres cambiar lo cambias
**directo** (editas el schema/plugin ahí mismo); un NAMED `schema:"X"` en el core no tiene sentido si el
schema está al lado. Las magias (NAMED push, re-cast por cobertura, pisar virtuals/types) **liberan a quien
EXTIENDE DESDE AFUERA** —un FWPlugin distribuible, un sitio, un deploy, un addOn vendible— que NO tiene (ni
debe tocar) el código del core. Ahí son la única vía; ahí brillan. (Lo más cercano a magia que vivía en el
core era Currency, y se EXTERNALIZÓ.)

**Regla**: ¿tienes el código a la mano? → edita directo. ¿Extiendes desde afuera sin tocar el core? → magia.

## Los 3 modos de aplicación (los decide el motor por las props del objeto)

`#addPluginFromObject` (el motor de schemas) clasifica cada plugin por qué propiedad trae:

| Modo | Property | Cuándo se aplica | Semántica | Ejemplo real |
|------|----------|------------------|-----------|--------------|
| **GLOBAL** | (ninguna) | a TODOS los schemas (`db.plugin`), salvo `noGlobalPlugin` | extensión universal | `framework.js`, `delete.js` |
| **FILTERED** (pull) | `filter: "X"` o `filter: fn` | solo si el modelo **declara la option** (`schema.get("X")` truthy) o `await fn(schema)` | **oferta dormida** — el modelo PIDE la feature declarando su option | `Banco` (`filter:"Banco"`), `hasCurrency` |
| **NAMED** (push) | `schema: "Member"` (string o array) | solo a ESE/ESOS modelos, vía `#applyPlugin` | **inyección dirigida** — el modelo NO se entera ni depende | `requestVariant` (itdfw-duration) |

```js
// FILTERED (pull) — oferta dormida: se activa solo si el schema declaró la option.
export default () => ({
  name: "slugify",
  filter: "hasSlug",                       // ⟸ schema.get("hasSlug") truthy → se aplica
  plugin(schema) {
    schema.checkAndLoadMethod({ slugify(field = "name") { /* ... */ } });
  }
});
// El modelo lo pide: new db.Schema({...}, {hasSlug: true})  ← declarar la option ES pedir la feature

// NAMED (push) — el modelo Member no declara NADA; el plugin se le inyecta.
export default () => ({
  name: "memberDisplayName",
  schema: "Member",                        // ⟸ solo el schema "Member" (o ["A","B"])
  plugin(schema) {
    schema.checkAndLoadVirtual({ displayName() { return `${this.firstName} ${this.lastName}`; } });
  }
});

// GLOBAL — a todos.
export default () => ({
  name: "myGlobal",
  plugin(schema) { schema.checkAndLoadMethod({ /* ... */ }); }
});
```

## Binding & parámetros — cómo el motor invoca tu plugin

🔴 **Dos funciones distintas, dos bindings distintos.** Confundirlos = `ReferenceError: db is not defined`
o `this` undefined.

**1. La FACTORY** (el `export default` del archivo, cuando es función). `#addPluginFromObject` la llama
**`res.call(this, this.db)`** (en el motor de schemas):
- `this` = la **instancia Schema del FW** → expone `db`, `pool`, `init`, `pluginOptions`, `registeredSchemas`/`registeredModels`, `schemasLoaded`…
- `db` también llega como **arg0**.
- Soporta `async` (se awaitea).

⟹ obtén `db` con **`const {db} = this`** (idiomático — el mongoose plugin `FrontEnd`) **o** nombrando el param
**`function (db) {…}`** (estilo `mongooseDB/*.js`) — es el MISMO `db`. Para `pool`/`init`/etc. → SOLO vía `this`.

```js
// idiomático mongoosePlugins/: db sale de this (la factory está bindeada).
function mongoosePlugins(/*db*/) {
  const {db} = this;                 // ⟸ SIN esto, usar db adentro = ReferenceError
  return { plugin(schema) { /* … usa db por closure … */ } };
}
```
🔴 **Falla real (2026-06-28)**: se movió `FWdelete` (usa `db.connection.transaction`) a `delete.js`, cuyo
factory tenía `(/*db*/)` comentado y SIN `const {db}=this` → `db is not defined` en runtime. Fix: agregar
`const {db} = this`. (Asumir `db` global es el error — `db` viene de `this`/arg, no es global.)

**2. La INNER `plugin(schema, options)`** (la prop `plugin` del objeto retornado). La llama **Mongoose** vía
`schema.plugin(fn, opts)` → `fn(schema, opts)`:
- recibe **`(schema, options)`**.
- **`this` NO está bindeado** acá — no lo uses. Opera sobre `schema`; cierra sobre `db`/lo-que-sea del scope de la factory.
- `options` = `this.pluginOptions[name]` (config merge de `mongoosePlugins`), con `name = res.name ?? res.plugin.name`.
- Aplicación por modo: GLOBAL → el motor envuelve para saltar `noGlobalPlugin` y aplica
  con `db.plugin(...)` (`:436`); FILTERED → `plugin(schema, options)` (`:593/597`); NAMED → `plugin(schema, options)` (`:659`).

### 🔴 Cómo llegar a un MODELO (o a `getConfig`) según dónde estás (jcmunoz, 2026-09-20)

| Dónde estás | El modelo | Por qué |
|---|---|---|
| en una **punta** o un ref-función (`req` a mano) | `req.db[modelo]` | 🔴 `req.db` **ES `db.models`**, no la conexión: `req.db.getConfig`, `req.db.model()` no existen |
| en la **factory** de un plugin, o donde tengas el singleton Schema (`this`) | `this.db.model(modelo)` | la factory va bindeada al singleton (`res.call(this, this.db)`) |
| en la **función de un FWPlugin** | `this.db.model(modelo)` | también bindeada al singleton (`plugin.call(this)`, skill `itdfw-fwplugin`) |
| **dentro de un schema** que depende de otro | `await this.init(nombre, {models: "Otro"})` | garantiza que el modelo ya exista (`schema-engine.md` en `itdfw-models`) |
| la config de nivel 2 desde un Model | `Model.getConfig()` (static que pone el plugin `config` en todo schema) | dentro de un ref-función `this === Model`; caso real: el plugin `typesafe`, el 500 `db.getConfig is not a function` |
| la config de nivel 2 con la conexión a mano | `await this.db.getConfig("X")` | `mongooseDB/config.js` del plugin `config` la cuelga de la conexión, no de `db.models` |

Verificado 2026-09-20 contra el AAA (`req.db = pool.db.models`) y el motor de schemas.

## 🪄 Pisar/inyectar — la libertad extrema (black magic)

Un plugin puede **PISAR o AGREGAR cualquier cosa** de cualquier modelo, en cualquier capa (un FWPlugin /
DEFAULT / App pueden pisar el core), **sin que el pisado se entere**. Casos:

**Cambiar el TYPE (y label, etc.) de un path EXISTENTE** — re-declarar con `schema.add` preservando options
por spread, cambiando solo lo que quieres. Patrón CONFIRMADO y en producción (plugin tenant `NationalId`):

```js
// global: promueve el campo genérico `nationalId: String` al type local Rut, sin tocar el modelo.
export default function plugin() {
  return {
    plugin(schema) {
      schema.eachPath((path, schemaType) => {
        if (path === "nationalId") {
          schema.add({
            [path]: {
              ...schemaType.options,   // ⟸ conserva required/unique/immutable/filter/pos/...
              type: "Rut",             // ⟸ String → Rut (cast + validación + component locales)
              name: "RUT"
            }
          });
        }
      });
    }
  };
}
```

🔴 **Sí: `schema.add` sobre un path existente lo RE-CASTEA** (Mongoose reemplaza el SchemaType). Re-pasar
`...schemaType.options` preserva todo lo demás. Esto FUNCIONA — es el mecanismo del multitenant del FW (un
deploncito por país: `nationalId`→`Rut` en .cl, →`Cuit` en .ar). El type custom se referencia por **string**
(`type: "Rut"`); vive en `db.Schema.Types[type]` (debe existir, ver skill `itdfw-mongoose-types`).

**Re-cast MASIVO** (recorrer `eachPath` promoviendo VARIOS paths, no uno puntual por nombre): dos cuidados —
(a) **idempotencia**: guarda por `schemaType.options?.type !== "Phone"`, NO solo por `instance` (un custom suele
heredar de SchemaString → `instance === "String"` y re-matchearía un path ya promovido); (b) **no mutes durante
la iteración**: junta los matches en un array dentro del `eachPath` y haz los `schema.add` DESPUÉS del recorrido.
Para un path puntual por nombre (como `nationalId`) no hace falta — `add` directo dentro del `eachPath`.

```js
plugin(schema) {
  const toPromote = [];
  schema.eachPath((path, st) => {
    if (path === "phone" && st.options?.type !== "Phone") toPromote.push([path, st.options]);
  });
  for (const [path, options] of toPromote) schema.add({[path]: {...options, type: "Phone"}});
}
```

**Inyectar un virtual/método en un modelo ajeno** → modo NAMED (arriba). El modelo no lo declara.
**Pisar un virtual del core** → re-declararlo (`schema.virtual("x").get(...)`) desde un plugin que corra
después. La cascada `core → front → default → app` deja que las capas superiores pisen las inferiores.
**Cambiar lo que responde una punta de un modelo ajeno** (`options.API`), sin tocar su módulo ni el front → plugin
NAMED en la capa que lo necesita, que envuelve el handler y llama al original cuando el caso no es suyo. Caso canónico
y código: [references/wrap-foreign-endpoint.md](references/wrap-foreign-endpoint.md).

## 🔴 Dependencias: un plugin NUNCA declara mongoose (y si lo hace, con el MAJOR del FW)

**Un plugin no tiene por qué importar mongoose. Nunca.** Recibe `db` del framework — ahí está `db.Schema`,
`db.model`, `db.Schema.Types` y los types custom. No existe caso legítimo que necesite el paquete.
Verificado 2026-08-15: **ningún plugin del monorepo lo importa** en su código.

El único uso defendible es un **test unitario** que monta su propia conexión aislada del FW → entonces va
en `devDependencies`, jamás en `dependencies` (si no, arrastras una copia entera de mongoose al deploy).

🔴 **Y la versión NO es la última: es el MAJOR que tiene el FW** (`"mongoose": "^9.0.0"`, no `"^9.9.2"`).
Un rango pineado por sobre el del back hace que pnpm instale una **segunda copia** en el proceso. Con dos
copias, `Schema.prototype` son dos objetos distintos: los parches que el FW instala (`eachVirtualPath`…)
existen en una y **no** en la otra, y cualquier plugin del core que recorra `childSchemas` explota. Misma
regla para `libs/*`.

Mecánica de pnpm que hay que conocer (aprendida a golpes, 2026-08-15):

| Comando | Rango declarado | Resolución (lock) |
|---|---|---|
| `pnpm add <pkg>` | intacto | intacta si el rango ya se satisface — **no mueve nada** |
| `pnpm add <pkg>@latest` | **intacto** | sube ✅ **este es el que quieres** |
| `pnpm update <pkg> --latest` | **lo REESCRIBE** al resuelto ❌ | sube |
| `pnpm install` | intacto | solo obedece al lock |

⟹ Para subir sin romper la convención: **`pnpm add <pkg>@latest`**. Y ojo: con rango amplio y una
resolución vieja congelada en el lock, `install` te deja pegado en la versión antigua para siempre
(caso real: `^9.0.0` clavado en 9.6.2 mientras el back iba en 9.9.2). Verifica con `pnpm why <pkg>` →
debe decir **`Found 1 version`**.

## Detalles que importan

- **Dos funciones, dos bindings (no confundir)** — ver "Binding & parámetros": la **factory** (`export
  default` función) se llama `.call(schemaInstance, db)` → `this` = instancia Schema del FW (db/pool/init/…);
  la **inner `plugin(schema, options)`** la llama Mongoose → recibe `(schema, options)` y **`this` NO está
  bindeado** (opera sobre `schema`, cierra sobre `db` del scope de la factory). En methods/virtuals/statics,
  `this` = doc/model en runtime.
- **`checkAndLoadMethod` / `checkAndLoadVirtual` / `checkAndLoadStatic`**: idempotentes (no pisan si ya existe).
  Prefiérelos a `schema.method/virtual/static` directos — respetan la cadena del FW.
- **El orden de los FWPlugins en el `.itdfw.js` NO importa para un NAMED**: `process()` registra TODOS los plugins
  (los del disco y los de cada FWPlugin, `plugins.plugins`) antes de cargar cualquier schema (`#loadSchemas` y
  `plugins.schemas` vienen después). Un NAMED `schema: "Conversation"` de `ai` se aplica aunque `ai` esté antes que
  `conversation` en el arreglo (`mongooseSchema/index.js`, `process`; verificado 20-oct-2026).
- **Options del plugin**: vienen de `this.pluginOptions[name]` (config merge `mongoosePlugins`), NO del objeto
  exportado. `name` = `res.name ?? res.plugin.name`.
- **`pos`** (solo GLOBAL): `"^"` = primero, `"$"` o `-1` = último, número = orden de inserción. Úsalo cuando tu
  global DEPENDE de carga de otro (ej. `childSchema:"^"` fija topología antes que el resto; `autoPosition` último).
  🔴 NO confíes en el orden alfabético de carpeta para dependencias de carga — declara `pos`.
- **`noGlobalPlugin`**: un schema puede excluirse de TODOS los globales (`schema.get("noGlobalPlugin")`).
- 🔴 **Prefind de ALCANCE (filtrar TODAS las lecturas: soft-delete, tenant, vencidos, `query` del schema) →
  `schema.preSearch(fn)`** (`mongooseDB/preSearch.js`, 2026-09-04), NUNCA el par `pre(/find/)` + `pre(/^count/)` a
  mano. La lista de qué es una lectura vive UNA vez (`[/find/, /^count/, "distinct"]`); escribirla por plugin es como
  nació #173: cuatro copias y a las cuatro les faltó `distinct` (en `zones` eso cruza tenants). `aggregate` va aparte
  (su `this` es un Aggregate, `pipeline().unshift`). Los cuatro (`delete`, `expire`, `zones`, `queryFilter`) ya lo usan; regresión en las pruebas `presearch*` de back.
- 🔴 **Todo recorte de `find` (`preSearch`) TIENE su par en `pre("aggregate")`** (jcmunoz 9-oct-2026). Un plugin que
  recorta lecturas y no recorta el aggregate deja ese camino abierto: el `$search` elige ids con `$limit` sin ese
  recorte y el `find` final (que sí lo tiene) devuelve vacío o incompleto, o un aggregate de reporte muestra lo que el
  `find` esconde. El hook va al inicio del pipeline (`unshift({$match: …})`) sin pensar en etapas primeras: el plugin
  global del core **`preAggregate`** (`mongoosePlugins/preAggregate.js`, `pos: "$"`, corre último) pone primera TODA
  etapa que Mongo exige primera (`FIRST_STAGES`, medida en mongod 9.0.2: `$search`, `$searchMeta`, `$vectorSearch`,
  `$rankFusion`, `$scoreFusion`, `$geoNear`, `$changeStream`, `$collStats`, `$indexStats`, `$planCacheStats`,
  `$listSearchIndexes`, y el `$match` con `$text`). **La posición separa lo de los plugins de lo del dev**: nadie
  puede escribir antes de una etapa primera, así que lo que está antes son los recortes y lo que está después es del
  dev. Tres casos: `EXCLUSIVE` (devuelven metadatos o eventos: `$searchMeta`, `$collStats`, `$indexStats`,
  `$planCacheStats`, `$listSearchIndexes`, `$changeStream`) → los recortes se **descartan** (su `$match` filtraría la
  salida) y la cola del dev queda; `$geoNear` y el `$match` con `$text` → los recortes se **funden** dentro
  (`$geoNear.query`, el `$and` del `$match`; con índices parciales sobre `active`, sin el filtro adentro `$geoNear` no
  encuentra índice); el resto (`$search`, `$vectorSearch`, `$rankFusion`…) → la etapa sube y los recortes quedan
  detrás. 🔴 **Contrato estricto**: un RECORTE entra con `unshift`; lo que un plugin agregue con `push` cae en la cola
  del dev y debe ser inocuo sobre metadatos (un `$unset` sí, un `$match` no). Los cuatro (`zones`, `queryFilter`,
  `delete`, `expire`) cumplen el par; regresión en la prueba de back `aggregateCuts` (D1-D4, E1). Un aggregate que
  lea `req` en un hook necesita `aggregate.localData = {req}` (así lo hace `ITDSearch`).
  **Todos los `pre("aggregate")` del core** (los `mongoosePlugins/` del core): `allowDiskUse` (solo la opción, no
  toca el pipeline), los cuatro recortes (`zones`, `queryFilter` —async, lee el `req` de `localData`—, `delete`,
  `expire`) y `preAggregate` al final. Corren en el orden en que se aplican los plugins; entre los recortes el orden da
  lo mismo (cada uno antepone un `$match` y el resultado es su AND), lo único que importa es que `preAggregate` corra
  último, y eso lo asegura su `pos: "$"`.
- 🔴 **Un plugin NO cuelga un `post("find")`** (jcmunoz 22-oct-2026). Lo que corre después de leer asume qué campos
  trajo la consulta, y el que consulta decide eso: `formOptions` trae solo el campo del nombre (`select`), un reporte
  trae otros, un `aggregate` no pasa por ahí. Un `post("find")` que completa, renombra o agrega datos a los documentos
  falla en silencio con la primera proyección, y además corre sobre TODA lectura del modelo. Lo que un plugin agrega
  a una salida se engancha en quien la produce, envolviéndola por la salida (caso: `zones` envuelve `formOptions` y
  agrega la zona con una sola consulta sobre los `value`; ver el TDD de zones-refs). Los recortes de lectura
  van antes (`preSearch` + su par en `pre("aggregate")`), nunca después. Al proyectar un `aggregate` y rehidratar,
  la proyección nombra `_id: 1`: `Model.hydrate(doc, {campo: 1})` deja `_id` en `undefined` (mongoose 9.11, medido
  22-oct-2026), aunque Mongo sí lo haya devuelto.
- 🔴 **Extender las QUERIES → `schema.query.X = function () {…}`, NUNCA `Query.prototype`/`db.Query.prototype`.**
  `Query` es un singleton de Mongoose compartido por todas las conexiones del proceso: mutarlo contamina a todos los
  sites (la cicatriz que forzó 1 site = 1 worker). `schema.query` son los query helpers de Mongoose, por schema y
  aislados por instancia; es la vía que hace posible el multisitio en un proceso (`TODOs/ideas/01-multisite-monoprocess.md`).
  Casos vivos: `zones` (`fetchAllZones`), `expire` (`fetchAll`), `autoPopulate`, `Locals` (`setReq`/`setLocal`).
- **Gateo interno vs FILTERED**: muchos GLOBAL se auto-gatean con `schema.get("<option>")` adentro del plugin
  (corren en todos pero no hacen nada salvo opt-in). Es válido; FILTERED es lo mismo a nivel loader (más limpio
  si la feature es pesada o claramente opcional).

## Cuándo cada modo (criterio)

- **GLOBAL**: la extensión aplica conceptualmente a todo modelo (auditoría, soft-delete, toInput).
- **FILTERED (pull)**: feature OPCIONAL que el modelo elige declarando una option (cuenta bancaria, currency,
  bitácora). El modelo PIDE.
- **NAMED (push)**: comportamiento específico de UN modelo que NO quieres que el modelo conozca/declare, o que
  vive en otro módulo (un plugin/addOn que inyecta en un modelo del core). Desacople: el modelo agnóstico, el
  plugin lo enchufa. (Caso `requestVariant`: itdfw-duration inyecta el color de fila en Request sin que Request
  dependa de Duration.)

## 🔴🔴 Un `schema.add` con sub-schema LITERAL desde un plugin = BOOT CAÍDO

Si tu plugin agrega un campo anidado (embedded/docArray), el sub-schema va **con `db.Schema`**, nunca
con objeto literal. Un plugin que declara el literal **no rompe su modelo: rompe el arranque del
servicio**, y el error no lo nombra.

```js
// ❌ el plugin como OBJETO plano no tiene db → tienta a poner el literal → BOOM
export default {name: "x", schema: "User", plugin(schema) {
  schema.add({lines: {type: [{a: {type: String}}]}});          // sub-schema CRUDO de mongoose
}};

// ✅ FACTORY para tener db, y el sub-schema construido con la fábrica del FW
export default db => ({name: "x", schema: "User", plugin(schema) {
  const Line = new db.Schema({a: {type: String}}, {_id: false});
  schema.add({lines: {type: [Line]}});
}});
```

Un sub-schema literal nace **sin las extensiones que el FW instala en `db.Schema.prototype`**
(`eachVirtualPath`…), y cualquier plugin del core que recorra `childSchemas` explota.

🔴 **Peor desde un plugin que desde un modelo**: un NAMED sobre `User` contamina a User **y a todo lo que
lo clona** (Member, DelegatedUser…) → cae la autenticación → **todas las puntas dan 500**. El error
(`eachVirtualPath is not a function` en `02hasFiles`) apunta a un archivo del core y **no menciona tu
plugin ni tu campo**. Caso real 2026-08-14: media hora de bisección sacando modelos uno a uno.

⟹ Si ves ese error, sospecha del último `schema.add` con campo anidado, **empezando por los plugins**.
Detalle completo: `itdfw-models` §3b.

## 🔴 Si el plugin ESCRIBE: `save()` o te haces cargo

Escribir con `updateOne`/`findOneAndUpdate`/`bulkWrite`/`updateMany` **se salta todos los hooks de
documento** — o sea el resto de los plugins del FW. A veces es **obligatorio**: un plugin que escribe con
`save()` dispara sus propios hooks → **recursión infinita** (por eso `previousField` usa `updateMany`
dentro de un `Mutex.lock`). Pero entonces son tuyos los hooks que no corrieron y la coordinación entre
procesos.

⟹ Regla completa, medición de qué dispara cada operación, y el efecto de los hooks de sub-schema en un
docArray: **`itdfw-models` §4c**.

## Common mistakes

| Error | Fix |
|-------|-----|
| **Sub-schema literal en un `schema.add`** | `new db.Schema(...)` — el literal tumba el boot (arriba) |
| Confundir FWPlugin (cáscara) con el sistema de plugins | FWPlugin empaqueta keys; el plugin extiende el schema. Ver `itdfw-fwplugin`. |
| Cambiar el type de un path con mutación cruda | `schema.add({path: {...schemaType.options, type:"X"}})` — preserva options, re-castea. |
| Crear dependencia core→plugin (el modelo importa/usa el plugin) | Invierte: plugin NAMED hace push al modelo; el modelo no sabe. |
| Asumir orden de carga entre GLOBALes | `pos` explícito; el alfabético no es contrato. |
| `schema.method` directo y pisar la cadena | `checkAndLoadMethod` (idempotente). |
| Referenciar un type custom inexistente (`type:"Phone"` sin el type) | Registrar el type primero (`itdfw-mongoose-types`). |
| Usar `db` en la factory sin capturarlo (`db is not defined`) | `const {db} = this` (la factory está bindeada) o nombrar el param `function (db){}`. Ver "Binding & parámetros". |
| Asumir `this` = schema en la inner `plugin()` | La inner recibe `(schema, options)`, `this` NO bindeado. El `this`=Schema-instance es de la FACTORY. |

## Capacidades del core que ya puedes USAR (no reinventes)

Antes de escribir lógica, mira qué PROVEE ya el core: virtuals `_update`/`_delete`/`_selectable`/`docLink`,
`hidden` por contexto, `toInput`/`toFilter`/`toXLS`/`toPDF`, `getSchemaType`, `getLink`/`ITDName`,
`isRoot`/`isChild`, `lean`/`autopopulate`/`fetchAll`, auditoría (`__history`), soft-delete (`active`),
multitenant (`_zone`), `weakEntity`, `autoincrement`, `pos`… Estas capacidades son las que permiten moldear
sin sobre-ingeniería — ya están hechas. **Catálogo de USO** (quieres Z → opción exacta → ejemplo → quién la
provee, con citas archivo:línea): el catálogo de capacidades de plugins («plugin-capabilities-catalog»). 🌫️ La mayoría son del
**FW en general** (las consume también quien escribe un MODELO, ver `itdfw-models`), no solo de plugins.

## Referencias de código

Motor: el de schemas del core — `#addPluginFromObject` (clasifica),
`setPlugin` + `#applyPlugin` (NAMED), `#filteredPlugins` + `#addSchemaFromObject` (FILTERED),
`#globalPlugins` + `db.plugin` (GLOBAL). Ejemplos: el mongoose plugin `Banco` (filtered),
el plugin `duration`, `requestVariant` (named), `NationalId.js` del sitio (global re-cast).

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
