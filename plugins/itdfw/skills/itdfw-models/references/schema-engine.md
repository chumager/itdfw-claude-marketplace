# El motor de schemas — instancia, API, eventos, espera y pool

Toda función `Schema()` corre con `this` = **la instancia única del motor** (`class Schema extends
EventEmitter`, una por worker; `pool.Schema` la referencia). De ahí salen `this.db`, `this.init`,
`this.pool`. Entender el motor explica por qué el orden de carga es irrelevante, cómo un modelo espera
o reacciona a otro, y cómo se interconectan en runtime vía el pool.

## Atributos de la instancia (`this`)

| Atributo | Tipo | Qué es |
|---|---|---|
| `this.db` | Conexión | Mongoose extendida: `db.Schema`, `db.model()`, `db.Schema.Types`, types custom, `db.getConfig`… |
| `this.pool` | Object | Canal compartido del proceso (API, libs, config, inyecciones de plugins/modelos). Ver §pool. |
| `this.documentRoot` | String | Raíz de documentos del deploy. |
| `this.schemas` | Object | Schemas registrados por nombre (`{Member: <Schema>}`), incluidos `noModel`. |
| `this.plugins` | Object | Plugins ESPECÍFICOS pendientes por schema (los registra `setPlugin`). |
| `this.pluginOptions` | Object | Opciones de plugins, merge de la config (`mongoosePlugins`). |
| `this.registeredSchemas` | Proxy | Espera-por-acceso de SCHEMAS (ver §espera). GET inexistente → promesa; SET → emite `schema-<name>`. |
| `this.registeredModels` | Proxy | Igual para MODELOS. GET inexistente → promesa; SET → emite `model-<name>`. |
| `this.schemasLoaded` | Promise | `once("schemasLoaded")` — resuelve cuando termina la carga completa. |
| `this.declaredSchemas` | getter→Array | Nombres de schemas ya declarados. |
| `this.declaredModels` | getter→Array | Nombres de modelos ya compilados. |

## API pública (métodos)

| Método | Devuelve | Qué hace | Quién lo usa |
|---|---|---|---|
| `init(name, {schemas?, models?})` | `Promise<{Schemas, Models}>` | Registra `name` como esperado y **espera** los schemas/models declarados (vía proxy). Timeout-warning ~2s si no llegan. | **El modelador** (lo normal). |
| `waitForSchemas(names)` | `Promise<{name: Schema}>` | Espera SCHEMAS crudos por nombre (lo que `init` usa para `schemas`). | Avanzado / interno. |
| `waitForModels(names)` | `Promise<{name: Model}>` | Espera MODELOS por nombre (lo que `init` usa para `models`). | Avanzado / interno. |
| `setPlugin({schema, plugin, options?})` | void | Registra un plugin para aplicarse a schema(s) específicos cuando se procesen. | Plugins. |
| `addSchemaFromFunction(fn, extra?)` | Promise | Ejecuta una función `Schema()` (con `this`=instancia) y procesa lo que retorna. | Interno / dinámico. |
| `addSchemaFromPOJO({schemaName, __set?, ...})` | Promise | Crea un schema desde objeto plano (DBModels dinámicos). | Avanzado. |
| `process()` | Promise | Orquesta TODA la carga (fases abajo). | **Bootstrap** (no el modelador). |
| `loadTypes()` / `loadPlugins()` | Promise | Cargan types/plugins de sus carpetas. | Bootstrap. |
| `on/once/emit(...)` | (EventEmitter) | Suscribirse/emitir los eventos de control (abajo). | Cualquiera con la instancia. |

## Eventos de control (EventEmitter)

| Evento | Args | Se emite cuando… | Uso típico |
|---|---|---|---|
| `schema-<name>` | `(schema)` | se registra ese schema | esperar/usar su definición (lo consume el proxy) |
| `model-<name>` | `(model)` | se compila ese modelo | engancharse a un modelo ajeno a distancia |
| `schema` | `(name)` | cualquier schema se registra | observar todo el flujo |
| `model` | `(model)` | cualquier modelo se compila | idem |
| `schemasLoaded` | `(true)` | terminó la carga completa | trabajo que requiere el universo entero |

```js
// DENTRO de tu función Schema, `this` ES la instancia (EventEmitter) → suscríbete con this.on:
this.on("model-Product", Product => { /* registrarle algo a Product, sin importarlo */ });
// fuera de una función Schema, la misma instancia está en `pool.Schema` (pool.Schema.on(...)).
```

## Espera sin línea de tiempo — el proxy

🔴 El orden ENTRE schemas NO está garantizado (carga paralela desde 3 carpetas: FW → DEFAULT → App).
El motor lo resuelve con **espera-por-acceso**: `registeredSchemas`/`registeredModels` son Proxy cuyo
GET de algo aún inexistente devuelve una **promesa** que resuelve cuando el SET lo registra (emite el
evento). Sin polling, sin saber CUÁNDO llega. `init`/`waitFor*` son la API encima de esto:

```js
async function Schema() {
  const {db} = this;
  const {Schemas: {User}, Models: {PubSub}} = await this.init("Member", {
    schemas: ["User"],   // SCHEMA crudo (clonar/referenciar definición → safeClone)
    models:  ["PubSub"]  // MODELO operativo (consultarlo/usarlo)
  });
}
```

## Post-setup del modelo — cómo correr código tras compilarlo (e inyectar al pool)

Al compilar un modelo, el motor llama `model.ITDExecPost(instanciaSchema)`. `ITDExecPost` NO lo
escribes tú: lo provee un plugin global del FW (`mongooseDB/addPost.js`) y hace dos cosas — ejecuta las
`postFunctions` acumuladas (recursivo a sub-schemas) y luego llama tu `ITDPostModel`. Tú enganchas tu
post-setup por una de dos vías:

```js
// (1) ITDPostModel — static del schema; recibe la INSTANCIA Schema (acceso a pool/db). Una por modelo.
schema.static({
  ITDPostModel(Schema) {            // Schema = instancia del motor
    const {pool} = Schema;
    pool.priceCalc = priceCalc;     // (a) inyección directa al pool
    pool.shareData.push("priceCalc"); // (b) además, viaja al req (ver §pool: tener ≠ compartir)
  }
});

// (2) schema.addPost(fn) — acumulativa (varias), corre dentro de ITDExecPost. fn recibe (db, model, ...).
schema.addPost((db, model) => { /* setup tras crear el modelo */ });
```
Es el lugar para setup que requiere el modelo YA creado + acceso a la instancia (y al `pool`). Config
lo usa para `pool.Config = this.assignConfig()` + `shareData`.

## El pool — interconexión en runtime

`pool` es el objeto compartido del worker (`pool.Schema = this`). **Cualquier modelo** (no solo un
FWPlugin) puede aportar al pool desde su `post`/`ITDExecPost`. Dos flujos **distintos**:

**(a) Inyección DIRECTA** — *enchufar en el pool*:
```js
pool.X = valor | fn;        // p.ej. pool.Config = ...,  pool.broadcast = hub.broadcast.bind(hub)
```

**(b) Compartir al `req` — `pool.shareData`**: es un **ARRAY de definiciones**. Un
middleware (`shareData(req,res,next)`, enchufado en el server) lo recorre en CADA request y
puebla `req`. Tres formas de entrada:

| Entrada en `pool.shareData` | Efecto por request |
|---|---|
| `"X"` (string) | `req.X = pool.X` (copia directa del pool) |
| `["reqKey", "poolKey"]` | `req.reqKey = pool.poolKey` (alias: distinto nombre en req vs pool) |
| `["reqKey", () => valor]` | `req.reqKey = fn()` (valor **computado por request** — ej. `configGet`, no necesariamente del pool) |

🔴 **Tener ≠ compartir**: inyectar `pool.X` (a) lo hace disponible en el proceso; agregarlo a
`pool.shareData` (b) lo propaga al `req`. Se puede inyectar sin compartir (uso server-side interno) y
NO se puede compartir del pool algo que no se inyectó. Son interdependientes pero separados.

Ejemplos reales en `pool.shareData`: `"API"` (copia directa), `["DB","db"]` (alias req.DB←pool.db),
`["Locale", () => configGet("Locale") || "es-CL"]` (computado). PubSub/Mutex/Config inyectan lo suyo
(`pool.sub`/`hub`/`broadcast`/`lock`/`Config`) y lo agregan a shareData según necesiten en el req.

**Acceso síncrono al pool desde un modelo**: captúralo del closure (`const {db, pool} = this`), NO desde
`this` en un getter/`default` (ahí `this` es el doc/query). Para config en `default` sync ver
[config-driven.md](config-driven.md).

## Orden de carga (`process`) y completitud

Fases, cada una con cascada FW → DEFAULT → App: **DB extras** (`mongooseDB/`) → **types**
(`mongooseTypes/`) → **plugins** (`mongoosePlugins/`) → **schemas** (`mongooseSchema/`). Los
**FWPlugins** se expanden ANTES y reparten sus keys (`db`/`types`/`plugins`/`schemas`/`API`/`libs`) a
cada fase. El motor cuenta schemas **esperados** (vía `init` + los que generan modelo) vs
**declarados**, y emite `schemasLoaded` al completar. `noModel:true` = schema helper sin modelo (cuenta
como schema, no como modelo).
