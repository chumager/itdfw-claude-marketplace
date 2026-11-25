---
name: itdfw-plugins
description: Use when creating, applying, or understanding mongoose plugins in the ITDFW framework — extending a schema with methods/virtuals/statics/hooks, or overriding/injecting behaviour into models. Covers the 3 application modes (global, filtered-by-option, named-by-schema), overwriting an existing field's type, and the "black magic" of pisar anything in any layer. NOT the FWPlugin shell (that only packages keys — see itdfw-fwplugin).
---

# ITDFW Plugin System

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [binding-detail.md](references/binding-detail.md) | Binding de la factory (`.call(schema, db)`) vs la inner `plugin(schema, options)`, error `db is not defined`, filas de errores comunes | Te da `db is not defined` o dudas qué es `this` en factory, plugin y methods |
| [boot-crash.md](references/boot-crash.md) | Sub-schema literal desde un plugin: contamina User y clones, error `eachVirtualPath is not a function` | Todas las puntas dan 500 tras agregar un campo desde un plugin NAMED |
| [code-refs.md](references/code-refs.md) | Referencias del motor de plugins: `#addPluginFromObject`, `setPlugin`, `#filteredPlugins`, `#globalPlugins`, ejemplos por modo | Quieres ver el código del motor o un ejemplo de cada modo |
| [core-capabilities.md](references/core-capabilities.md) | Capacidades del core que ya existen (`_update`, `hidden`, `toInput`, `toXLS`, `__history`, `_zone`, `weakEntity`...) y su catálogo de uso | Antes de escribir lógica nueva en un plugin, para no reinventar algo del core |
| [pnpm-mechanics.md](references/pnpm-mechanics.md) | Versión de mongoose = MAJOR del FW, segunda copia por rango pineado, `pnpm why` y mecánica para subir una dependencia | Subes mongoose u otra dependencia o ves parches del FW que no aplican |
| [read-cuts.md](references/read-cuts.md) | Recortes de lectura: `schema.preSearch`, su par en `pre("aggregate")`, `preAggregate` y `FIRST_STAGES`, y por qué no `post("find")` | Un plugin filtra lecturas (soft-delete, tenant, vencidos) o toca `aggregate` |
| [recast.md](references/recast.md) | Re-cast de un path existente con plugin global: ejemplo `nationalId` → `Rut` con `eachPath` | Promueves el type de un campo sin tocar el modelo |
| [wrap-foreign-endpoint.md](references/wrap-foreign-endpoint.md) | Envolver la punta de un modelo ajeno con un plugin NAMED sobre `options.API` (`GET.json`) | Una pieza ajena pide una punta fija y en tu capa debe salir distinta |

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

El **CORE casi no las usa** (0 plugins NAMED, mínimo re-cast), y eso es **CORRECTO, no carencia**: con el código a la
mano se edita **directo** el schema o el plugin. Las magias (NAMED push, re-cast, pisar virtuals/types) **liberan a quien
EXTIENDE DESDE AFUERA** —un FWPlugin distribuible, un sitio, un deploy, un addOn— que NO tiene (ni debe tocar) el código
del core: ahí son la única vía.

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
- Soporta `async` (se awaitea). Una factory flecha (`db => …`) no recibe `this`: solo `db` como arg0.

⟹ obtén `db` con **`const {db} = this`** (idiomático — el mongoose plugin `FrontEnd`) **o** nombrando el param
**`function (db) {…}`** (estilo `mongooseDB/*.js`) — es el MISMO `db`. Para `pool`/`init`/etc. → SOLO vía `this`.

```js
// idiomático mongoosePlugins/: db sale de this (la factory está bindeada).
function mongoosePlugins(/*db*/) {
  const {db} = this;                 // ⟸ SIN esto, usar db adentro = ReferenceError
  return { plugin(schema) { /* … usa db por closure … */ } };
}
```
El error `db is not defined`: [references/binding-detail.md](references/binding-detail.md).

**2. La INNER `plugin(schema, options)`** (la prop `plugin` del objeto retornado). La llama **Mongoose** vía
`schema.plugin(fn, opts)` → `fn(schema, opts)`:
- recibe **`(schema, options)`**.
- **`this` NO está bindeado** acá — no lo uses. Opera sobre `schema`; cierra sobre `db`/lo-que-sea del scope de la factory.
- `options` = `this.pluginOptions[name]` (config merge de `mongoosePlugins`), con `name = res.name ?? res.plugin.name`.
- Aplicación por modo: GLOBAL → el motor envuelve para saltar `noGlobalPlugin` y aplica con `db.plugin(...)`; FILTERED
  y NAMED → `plugin(schema, options)` (dónde, en el motor: [references/code-refs.md](references/code-refs.md)).

### 🔴 Cómo llegar a un MODELO (o a `getConfig`) según dónde estás

| Dónde estás | El modelo | Por qué |
|---|---|---|
| en una **punta** o un ref-función (`req` a mano) | `req.db[modelo]` | 🔴 `req.db` **ES `db.models`**, no la conexión: `req.db.getConfig`, `req.db.model()` no existen |
| en la **factory** de un plugin, o donde tengas el singleton Schema (`this`) | `this.db.model(modelo)` | la factory va bindeada al singleton (`res.call(this, this.db)`) |
| en la **función de un FWPlugin** | `this.db.model(modelo)` | también bindeada al singleton (`plugin.call(this)`, skill `itdfw-fwplugin`) |
| **dentro de un schema** que depende de otro | `await this.init(nombre, {models: "Otro"})` | garantiza que el modelo ya exista (`schema-engine.md` en `itdfw-models`) |
| la config de nivel 2 desde un Model | `Model.getConfig()` (static que pone el plugin `config` en todo schema) | dentro de un ref-función `this === Model`; ejemplo: el plugin `typesafe`, el 500 `db.getConfig is not a function` |
| la config de nivel 2 con la conexión a mano | `await this.db.getConfig("X")` | `mongooseDB/config.js` del plugin `config` la cuelga de la conexión, no de `db.models` |

## 🪄 Pisar/inyectar — la libertad extrema (black magic)

Un plugin puede **PISAR o AGREGAR cualquier cosa** de cualquier modelo, en cualquier capa (un FWPlugin /
DEFAULT / App pueden pisar el core), **sin que el pisado se entere**. Casos:

**Cambiar el TYPE (y label, etc.) de un path EXISTENTE** — re-declarar con `schema.add` preservando options
por spread, cambiando solo lo que quieres. Patrón CONFIRMADO y en producción (plugin tenant `NationalId`):

```js
// global: promueve `nationalId: String` al type local Rut sin tocar el modelo (completo: references/recast.md)
plugin(schema) {
  schema.eachPath((path, st) => {
    if (path === "nationalId") schema.add({[path]: {...st.options, type: "Rut", name: "RUT"}}); // conserva required/unique/…
  });
}
```

🔴 **`schema.add` sobre un path existente lo RE-CASTEA** (Mongoose reemplaza el SchemaType) y `...schemaType.options`
preserva el resto: es el mecanismo del multitenant (`nationalId`→`Rut` en un deploy, →`Cuit` en otro). El type se
referencia por **string** (`type: "Rut"`) y debe existir en `db.Schema.Types` (skill `itdfw-mongoose-types`).

**Re-cast MASIVO** (recorrer `eachPath` promoviendo VARIOS paths, no uno puntual por nombre): dos cuidados —
(a) **idempotencia**: guarda por `schemaType.options?.type !== "Phone"`, NO solo por `instance` (un custom suele
heredar de SchemaString → `instance === "String"` y re-matchearía un path ya promovido); (b) **no mutes durante
la iteración**: junta los matches en un array dentro del `eachPath` y haz los `schema.add` DESPUÉS del recorrido.
Para un path puntual por nombre (como `nationalId`) no hace falta — `add` directo dentro del `eachPath`.

El código del recorrido en dos pasos: [references/recast.md](references/recast.md).

**Inyectar un virtual/método en un modelo ajeno** → modo NAMED (arriba). El modelo no lo declara.
**Pisar un virtual del core** → re-declararlo (`schema.virtual("x").get(...)`) desde un plugin que corra
después. La cascada `core → front → default → app` deja que las capas superiores pisen las inferiores.
**Cambiar lo que responde una punta de un modelo ajeno** (`options.API`), sin tocar su módulo ni el front → plugin
NAMED en la capa que lo necesita, que envuelve el handler y llama al original cuando el caso no es suyo. Caso canónico
y código: [references/wrap-foreign-endpoint.md](references/wrap-foreign-endpoint.md).

## 🔴 Dependencias: un plugin NUNCA declara mongoose (y si lo hace, con el MAJOR del FW)

**Un plugin no importa mongoose. Nunca.** Recibe `db` del framework (`db.Schema`, `db.model`, `db.Schema.Types`, los
types custom).

El único uso defendible es un **test unitario** que monta su propia conexión aislada del FW → entonces va
en `devDependencies`, jamás en `dependencies` (si no, arrastras una copia entera de mongoose al deploy).

🔴 **Y la versión NO es la última: es el MAJOR que tiene el FW** (`"mongoose": "^9.0.0"`, no `"^9.9.2"`): un rango por
sobre el del back instala una **segunda copia**, con otro `Schema.prototype` sin los parches del FW (`eachVirtualPath`…),
y los plugins del core que recorren `childSchemas` explotan. Misma regla para `libs/*`.

Para subir sin romper la convención: **`pnpm add <pkg>@latest`** (no `pnpm update <pkg> --latest`, que reescribe el
rango), y verifica con `pnpm why <pkg>` → debe decir **`Found 1 version`**. La tabla: [references/pnpm-mechanics.md](references/pnpm-mechanics.md).

## Detalles que importan

- **Dos funciones, dos bindings (no confundir)** — ver "Binding & parámetros". En methods/virtuals/statics, `this` =
  doc/model en runtime.
- **`checkAndLoadMethod` / `checkAndLoadVirtual` / `checkAndLoadStatic`**: idempotentes (no pisan si ya existe).
  Prefiérelos a `schema.method/virtual/static` directos — respetan la cadena del FW.
- **El orden de los FWPlugins en el `.itdfw.js` NO importa para un NAMED**: `process()` registra TODOS los plugins
  (los del disco y los de cada FWPlugin) antes de cargar cualquier schema, así que un NAMED se aplica aunque su plugin
  vaya antes que el del modelo en el arreglo.
- **Options del plugin**: vienen de `this.pluginOptions[name]` (config merge `mongoosePlugins`), NO del objeto
  exportado. `name` = `res.name ?? res.plugin.name`.
- **`pos`** (solo GLOBAL): `"^"` = primero, `"$"` o `-1` = último, número = orden de inserción. Úsalo cuando tu
  global DEPENDE de carga de otro (ej. `childSchema:"^"` fija topología antes que el resto; `autoPosition` último).
  🔴 NO confíes en el orden alfabético de carpeta para dependencias de carga — declara `pos`.
- **`noGlobalPlugin`**: un schema puede excluirse de TODOS los globales (`schema.get("noGlobalPlugin")`).
- 🔴 **Prefind de ALCANCE (filtrar TODAS las lecturas: soft-delete, tenant, vencidos, `query` del schema) →
  `schema.preSearch(fn)`**, NUNCA el par `pre(/find/)` + `pre(/^count/)` a mano: la lista de qué es una lectura vive UNA
  vez (copiar el par a mano deja lecturas sin cubrir, p. ej. `distinct`). `aggregate` va aparte.
- 🔴 **Todo recorte de `find` (`preSearch`) TIENE su par en `pre("aggregate")`**, al inicio del
  pipeline con `unshift({$match: …})`. El plugin global del core **`preAggregate`** (`pos: "$"`, corre último) pone
  primera toda etapa que Mongo exige primera. **Contrato estricto**: un RECORTE entra con `unshift`; lo que un plugin
  agregue con `push` cae en la cola del dev y debe ser inocuo sobre metadatos. Las etapas primeras, los tres casos y
  `localData`: [references/read-cuts.md](references/read-cuts.md).
- 🔴 **Un plugin NO cuelga un `post("find")`**: lo que corre después de leer asume los campos que
  decide quien consulta, y falla en silencio con la primera proyección. Lo que un plugin agrega a una salida se engancha
  en quien la produce, envolviéndola (ejemplo: `zones` envuelve `formOptions`); los recortes van antes. Detalle, y el `_id`
  al rehidratar un `aggregate`: [references/read-cuts.md](references/read-cuts.md).
- 🔴 **Extender las QUERIES → `schema.query.X = function () {…}`, NUNCA `Query.prototype`/`db.Query.prototype`.**
  `Query` es un singleton de Mongoose compartido por todas las conexiones del proceso: mutarlo contamina a todos los
  sites. `schema.query` son los query helpers de Mongoose, por schema y aislados por instancia (ejemplos: `zones`
  `fetchAllZones`, `expire` `fetchAll`, `Locals` `setReq`/`setLocal`).
- **Gateo interno vs FILTERED**: muchos GLOBAL se auto-gatean con `schema.get("<option>")` adentro del plugin
  (corren en todos pero no hacen nada salvo opt-in). Es válido; FILTERED es lo mismo a nivel loader (más limpio
  si la feature es pesada o claramente opcional).

## Cuándo cada modo (criterio)

- **GLOBAL**: la extensión aplica conceptualmente a todo modelo (auditoría, soft-delete, toInput).
- **FILTERED (pull)**: feature OPCIONAL que el modelo elige declarando una option (cuenta bancaria, currency,
  bitácora). El modelo PIDE.
- **NAMED (push)**: comportamiento específico de UN modelo que NO quieres que el modelo conozca/declare, o que
  vive en otro módulo (un plugin/addOn que inyecta en un modelo del core). Desacople: el modelo agnóstico, el
  plugin lo enchufa. (Ejemplo `requestVariant`: itdfw-duration inyecta el color de fila en Request sin que Request
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

🔴 **Peor desde un plugin que desde un modelo**: un NAMED sobre `User` contamina a User **y a todo lo que lo clona** →
cae la autenticación → **todas las puntas dan 500**, y el error (`eachVirtualPath is not a function` en `02hasFiles`)
**no menciona tu plugin ni tu campo**. Detalle: [references/boot-crash.md](references/boot-crash.md).

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
| Confundir FWPlugin (cáscara) con el sistema de plugins | FWPlugin empaqueta keys; el plugin extiende el schema. Ver `itdfw-fwplugin`. |
| Cambiar el type de un path con mutación cruda | `schema.add({path: {...schemaType.options, type:"X"}})` — preserva options, re-castea. |
| Crear dependencia core→plugin (el modelo importa/usa el plugin) | Invierte: plugin NAMED hace push al modelo; el modelo no sabe. |
| Asumir orden de carga entre GLOBALes | `pos` explícito; el alfabético no es contrato. |
| `schema.method` directo y pisar la cadena | `checkAndLoadMethod` (idempotente). |
| Referenciar un type custom inexistente (`type:"Phone"` sin el type) | Registrar el type primero (`itdfw-mongoose-types`). |

## Capacidades del core que ya puedes USAR (no reinventes)

Antes de escribir lógica, mira qué PROVEE ya el core: virtuals `_update`/`_delete`/`_selectable`/`docLink`, `hidden`
por contexto, `toInput`/`toFilter`/`toXLS`/`toPDF`, auditoría (`__history`), soft-delete (`active`), multitenant
(`_zone`), `weakEntity`, `autoincrement`, `pos`… La lista y su catálogo de uso:
[references/core-capabilities.md](references/core-capabilities.md).

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.

