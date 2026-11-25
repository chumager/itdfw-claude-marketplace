---
name: itdfw-models
description: Use when creating or modifying ITDFW backend business models (mongooseSchema files) — where the file lives (DEFAULT vs app), how the Schema function works (params, bind, async, return), how to define fields and model options, how to verify via MCP, and the specializations: authenticatable models, public registration, multitenant fields, state flows, field conventions.
---

# ITDFW Models — Implementar modelos de negocio

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [after-creating.md](references/after-creating.md) | Un modelo recién creado no es accesible hasta asignarlo a un perfil (`Profile.functions`, MCP `assignFunction`); 403/401 esperado; la ruta de las puntas | el modelo nuevo da 403/404 al llamar sus puntas, o dudas del código antes de asignarlo a un perfil |
| [authenticatable.md](references/authenticatable.md) | Autenticable = clon de User vía `safeClone`; `registrable`; checklist del clon; perfil base con el nombre del modelo; las capacidades son funciones asignables, el dueño arma los perfiles de sus usuarios por la cadena de tenants, otro tipo de usuario es otro clon con su perfil base del mismo nombre; activación en el front | el modelo se LOGUEA, o un TDD/plugin dice quién puede qué (cobrar, revertir): la asignación es configuración, no código |
| [config-driven.md](references/config-driven.md) | Modelo `Config`: `setConfigDefinition` (shape), crear el valor, `getConfig` sync/async, sembrar un docArray desde config en `default()` | un valor o política varía por despliegue/tenant y no debe ir hardcodeado |
| [conventions.md](references/conventions.md) | Idioma (enums en inglés camelCase), campos multitenant (`nationalId` + plugin del tenant), canónico limpio en BD, `hidden`/`readonly`/`disabled`, índices, `deleteMode`+`unique`, nombres reservados, `query` como scope por quién mira | defines campos finos: identificación nacional, formato local, hidden/readonly, índices, nombres de path, o scope automático del modelo |
| [example-authenticatable.js](references/example-authenticatable.js) | Ejemplo mínimo de autenticable: `User.safeClone` con `registrable`, `profiles = []` y la base obligatoria | escribes un modelo autenticable y quieres el esqueleto de referencia |
| [example-model.js](references/example-model.js) | Ejemplo base de un modelo plano completo: dónde vive el archivo, `this.init`, `db.Schema`, campos con `required`/`unique`/`immutable`/`filter`/`pos`/`tablePos` | empiezas un modelo nuevo y quieres la forma mínima completa |
| [field-filters.md](references/field-filters.md) | Familia `filterXXX` (`filterType`, `filterComponent`, `filterDefault`, `filterName`, `betweenType`), `onlyRef` y multiselección derivada | tocas el filtro de un campo: `filterXXX`, `onlyRef`, multiselección, o un ref que se expande al form entero en el filtro |
| [object-types-docarray.md](references/object-types-docarray.md) | Dos ejes ortogonales del docArray: construir con `new db.Schema` (no literal) y poner el arreglo en el `type` (`{type:[X]}`) | declaras un embedded/docArray, o el boot cae con `eachVirtualPath is not a function` |
| [options-catalog.md](references/options-catalog.md) | Catálogo de OPTIONS de `new db.Schema(campos, OPTIONS)`: identidad, CRUD, AAA, ofertas de plugins (namespace abierto), flujo/data, transitivos | necesitas saber qué option existe o cuál usar: `name`/`title`/`description`, `defaultMethods`, plugins declarativos como `Bitacora` |
| [save-flow.md](references/save-flow.md) | Las operaciones de query (`updateOne`, `bulkWrite`, `insertMany`) no disparan hooks de documento: se saltan bitácora, `__history`, multitenant y cast; cuándo es legítimo (p. ej. `previousField`) y mediciones de orden de hooks | escribes sin `save()` o cuelgas algo de un hook de sub-schema |
| [schema-engine.md](references/schema-engine.md) | El motor: `this` = instancia única de Schema, atributos (`db`, `pool`, proxies), orden de carga, esperar dependencias (`init`/`waitFor`), eventos `schema-X`/`model-X`, hook `ITDExecPost`, interconexión por pool (inyección directa vs `shareData`→req) | un modelo debe esperar o reaccionar a otro, o necesitas entender el orden de carga y la interconexión runtime |
| [special-refs.md](references/special-refs.md) | Refs especiales: `ref` directo, `refPath` (polimórfico), `myRef`+`addGetRef` (ref por función, 2º parámetro obligatorio por ofuscación), ref con nombre del pool; descubrimiento vía tableFields; errores → 500 | el field referencia algo no trivial: modelo polimórfico, catálogo custom o fuente de valores por función |
| [state-flows.md](references/state-flows.md) | El estado de negocio nunca es un campo escribible: bitácora de hechos (option `Bitacora`) + transición derivada en pre-validate | el modelo tiene flujo de estados (prospect→member, application→approved) y estás tentado a un `status` editable |

**Audiencia: un dev SIN acceso al código del FW.** Este skill basta para crear un modelo nuevo con
cero código visible (salvo los ejemplos internos). SKILL.md = la BASE (todo modelo); las
especializaciones viven en `references/`. Hermanos: `itdfw-api-system` (puntas/AAA),
`itdfw-mongoose-types` (types custom), `itdfw-fwplugin` (plugins), `itdfw-db-models` (el modelo
definido en la BD en vez de un archivo — mismo modelado, otra vía de carga).

## 0. 🔴 ANTES de los campos — cuatro preguntas por entidad

Un modelo nace de estas respuestas, no de la tabla de campos. Si se saltan, el dueño de los datos queda mal puesto y
el usuario termina recargando lo mismo en cada ocasión.

| # | Pregunta | Qué decide |
|---|---|---|
| 1 | **¿Existe sola, o no existe sin otra?** (fuerte o débil) | quién es su dueño y qué pasa con ella si el dueño se va: la feria no existe sin su organizador; la viña existe sin ninguna feria |
| 2 | **¿Se crea una vez y se reusa, o se repite en el tiempo?** | qué se carga una sola vez (la viña, su carta) y qué es cada edición (la feria de este año) |
| 3 | **Entre dos entidades, ¿1:N o N:M?** | si es N:M, la asociación es **una entidad propia** con los atributos de la relación, y no es dueña de ninguna de las dos: el stand es feria ↔ viña, con lo que la viña vende en esa feria |
| 4 | **¿A qué nivel pertenece?** | al nivel que contiene todo lo que hace (la regla de `itdfw-aaa` §1, aplicada a los datos): un cliente que va a varias ferias es del sistema |

Las respuestas van escritas en el TDD, en la línea de ALCANCE de cada entidad (`tdd-narrativo` §2b).

## 1. DÓNDE — ubicación del archivo

La raíz NO es una convención: es **`documentRoot`**, definido en la configuración del deploy
(`/etc/itdfw/<deploy>.yaml`, p.ej. `documentRoot: /var/www/<deploy>`). De ahí el FW deriva
`<documentRoot>/DEFAULT/` y `<documentRoot>/<app>/` (la app/site también viene de la config).
Primero verifica el `documentRoot` del deploy donde trabajas.

| El modelo lo usan... | Archivo |
|---|---|
| TODAS las apps del deploy | `<documentRoot>/DEFAULT/mongooseSchema/<Modelo>.js` |
| SOLO una app | `<documentRoot>/<app>/mongooseSchema/<Modelo>.js` |
| (sin archivo) definición dinámica | **la BD** — la definición se crea como DOCUMENTO (por interfaz, API o MCP), el PubSub avisa a todos los workers y la cargan en caliente, y al existir ya es asignable a perfiles. Dos vías: `DBModelRaw` (código, mismo patrón que un archivo) y `DBModel` (formulario guiado, más limitado). 🔴 **Detalle completo: skill `itdfw-db-models`** |

La carga busca primero en la app y cae a DEFAULT (cascada). DEFAULT = lo genérico del deploy;
lo específico va en su app. Misma regla para `mongoosePlugins/`, `mongooseTypes/`, `APP/`.

## 2. CÓMO — la función Schema

El archivo exporta UNA función. El FW la invoca con **`this` = instancia Schema del FW**, que provee:
- `this.db` — la conexión Mongoose extendida (`db.Schema`, `db.model()`, types custom).
- `this.init(name, deps?)` — registra el modelo y resuelve dependencias.
- `this.pool` — recursos compartidos del FW (API, libs).

```js
// Modelo SIN dependencias — síncrono, init simple:
function Schema() {
  const {db} = this;
  this.init("Vehicle");
  const Vehicle = new db.Schema({/* campos */}, {/* options */});
  return {Vehicle};
}
export default Schema;
```

**¿Cuándo `async`?** Solo si: (a) esperas un recurso externo — otro **schema** (para clonarlo/
referenciar su definición) o un **modelo** (para usarlo) — vía `this.init`; o (b) tienes awaits
propios. Si no, síncrona.

```js
// Modelo CON dependencias — async + await del init:
async function Schema() {
  const {db} = this;
  const {
    Schemas: {User},          // schema crudo (p.ej. para User.safeClone)
    Models: {PubSub}          // modelo operativo (para consultarlo/usarlo)
  } = await this.init("Member", {schemas: ["User"], models: ["PubSub"]});
  // ...
}
```

## 3. CAMPOS — cómo se define un campo

```js
fieldName: {            // camelCase SIEMPRE; identificadores en inglés
  type: String,          // ← ÚNICO obligatorio. Nativos (String, Number, Date, Boolean, [..]) o
                         //   del catálogo del FW: "Email", "Phone", "Address", "Password", "Url",
                         //   "File", "Html", "Percentage"... → MCP listTypes para verlos TODOS.
                         //   🔴 "Address" (plugin address) persiste un GeoJSON Point pero NO declara
                         //   índice geo: el modelo que pregunte por cercanía declara
                         //   `Schema.index({address: "2dsphere"})` y usa `$geoNear` con `key: "address"`
                         //   (ej. un modelo `Place`). Sin el índice, `$near` revienta.
  name: "Label visible"  // ← en la práctica siempre: es el label del form/grilla (se traduce)
}
```

**Opcionales comunes** (se agregan según necesidad, NUNCA preventivamente):

| Atributo | Qué hace |
|---|---|
| `required` | `true` o string (mensaje de error). Back+front. |
| `filter` | `true` filtrable (FW genera el índice solo) · `"between"` rangos · `"$lte"`/`"$gte"`… operador Mongo · objeto `{...}` query fija · función `(input)=>query` filtro calculado. Ver familia filterXXX abajo. 🔴 Sin `filter` el front no ofrece el filtro, pero la punta lo acepta igual (así funcionan los links), salvo que el type traiga `filter: false` por omisión (`Password`, `Object`). **`filter: false` es imperativo**: el back lo saca de todo filtro, aunque llegue por punta o a través de un ref, en silencio. Va en todo secreto guardado como campo (una llave, un token); los types de secreto (`Password`) ya lo traen por omisión. Un filtro nunca ejecuta código: un path que el modelo no tiene se descarta, y cada valor pasa por el `toFilter` de su type. Para recortar lo que un campo acepta como condición: `filter: false`, o un `toFilter` propio en el campo o en el type. |
| `hidden` | `true` global, por contexto (`["view","create","update","register","profile"]`) o **función** del `req`. 🔴 Es una puerta de seguridad que se resuelve en el back: un campo oculto no se entrega ni se acepta al guardar, es como si no existiera para ese scope (solo `send` saca datos). Por eso un `hidden` función de lo contratado da capacidades distintas por cliente sobre el mismo modelo, sin partirlo. `hiddenDetail` lo saca también del detalle. Detalle: `itdfw-mongoose-types` → `toinput-pipeline.md` §C |
| `readonly` / `disabled` | por contexto igual que hidden (`["profile"]`) |
| `unique` | índice unique (el FW agrega multitenant + soft-delete partial solo) |
| `immutable` | se escribe una vez, nadie lo cambia (identidades) |
| `default` | valor o función |
| `toInput: {default}` | el valor que **propone el form** sin guardarse en el schema (el `toInput` del campo se mezcla en el input y su `default` pasa a `value`, `toInput.js:91-109`). 🔴 Un `default` del schema se escribe en cada documento nuevo: en un campo que un plugin agrega a un modelo ajeno lo ensucia (un tamaño de botella 750 por omisión terminaba guardado en todos los productos del modelo, también en los que no son vino) |
| `enum` | values SIEMPRE inglés camelCase: `["draft","approved"]`. 🔴 **Solo para estados en que el código decide por dónde sigue.** Un catálogo que el negocio puede agrandar (monedas, tamaños, tipos de producto) es dato: va al Config ([config-driven.md](references/config-driven.md)) o a un modelo, y el campo valida contra él. Lo mismo vale para fijar un valor que ya da la config (un precio con `currency: "CLP"` fijo cuando las monedas vienen del Config). Litmus: *si aparece un valor nuevo, ¿hay que sacar un release?* (rule `ambiguedad-se-deja-configurable`) |
| `ref` / `refPath` / `myRef` | referencia a otro modelo (Select con options dinámicas). `refPath`=modelo polimórfico desde otro campo. `myRef`=ref por FUNCIÓN (getRef custom, no un modelo). Detalle: [special-refs.md](references/special-refs.md) |
| `minMatchingChars` | en un `ref`/`myRef`, cuántas letras hay que escribir antes de pedir opciones (por omisión 3). **`0`** = una lista corta que se muestra entera al abrir el select, sin escribir (`GenericInput.jsx:1051-1066`) |
| `pos` / `tablePos` | orden en form / grilla. 🔴 **El orden de un form es el de declaración**: si un campo va al final, se declara al final. `pos` es solo para forzar un lugar aunque otro enchufe campos. Si un plugin agrega campos a un modelo ajeno y lo desordena, el orden lo cuida el dev del plugin, no el dueño del modelo (caso: el historial del ticket de helpdesk llevaba `pos: 1000` y quedó declarado al final, `d3fafda0`) |
| `description` | ayuda contextual |
| `aiDescription` | 🔴 **obligatoria en todo campo nuevo**: la descripción para máquinas (la lee un LLM vía MCP o la paleta). Qué guarda, para qué se usa y, si hay un vecino parecido, qué NO es (`updateDate`: "last change to the record, NOT related to sign-ins"). En inglés. Si no sabes con certeza qué guarda, no la inventes: déjala anotada como pendiente (una descripción mala hace que el LLM elija mal, medido) |
| `placeholder` | texto del input vacío. **No hace falta declararlo**: si el campo no lo trae, `toInput` pone el del type (`Phone` trae el suyo) y si no el **genérico por type** del deploy (`genericPlaceholder` en `.itdfw.js`/yaml, skill `itdfw-deploy-config`), y sin nada `"Enter data"`. Se declara solo para cambiarlo (un `ref` que quiera "Buscar" en vez del genérico). Se traduce como cualquier texto (back desde 22-sep-2026) |
| `controller` | comportamiento dinámico del form, p.ej. `"changeOptions"` (ver references) |

**Derivados — NO los declares si no necesitas cambiarlos**: `component` deriva del `type`
(type "Phone" → componente Phone; solo se declara para override), `options` deriva de `enum`,
`label` deriva de `name`, validación/cast vienen del type (NO los dupliques en pre-save).

**Familia `filterXXX` — overrides del campo SOLO en contexto filtro**: `filterType`, `filterComponent`, `filterDefault` (valor o `(req)=>val`), `filterName`, `filterTag` y `betweenType` (con `filter:"between"`, el operador del rango). 🔴 Un `ref` en el filtro se expande al FORM del modelo referenciado (Embedded en un drawer) salvo **`onlyRef: true`**, que lo deja como select typeahead sobre `getRef`. 🔴 **La multiselección del filtro se DERIVA, no se declara** (referencias y arreglos llevan `multiple: true`); el único valor de `filter` que altera la forma del input es `"between"`. Opciones de schema, raras: `cacheFilter`, `tableFieldsFilter`. Tabla completa y casos: [references/field-filters.md](references/field-filters.md).


## 3b. 🔴🔴 DOS ejes ORTOGONALES que se cruzan en el docArray (y por eso se confunden)

| Eje | La pregunta | ✅ | ❌ |
|---|---|---|---|
| **1. Cómo se CONSTRUYE el objeto** | ¿pasó por la fábrica del FW? | `new db.Schema({...})` | literal `{a: …, b: …}` |
| **2. Dónde va el ARREGLO** | ¿en el type o en el campo? | `{type: [X], ...options}` | `campo: [ … ]` |

- 🔴🔴 **Eje 1 — TODO tipo objeto se construye con `db.Schema`, sin excepción** (embedded y docArray por igual): `const Line = new db.Schema({...}, {_id: false})` y `{type: Line}` / `{type: [Line]}`. Un literal (`{type: [{a: String}]}`) **REVIENTA EL BOOT COMPLETO**: mongoose lo acepta y el hijo nace crudo, sin las extensiones del FW, y cae el servicio, no solo el modelo. 🔴 **`eachVirtualPath is not a function` = alguien declaró un sub-schema con literal**: busca el docArray/embedded más reciente (revisa los plugins primero). Un plugin que agrega campos anidados necesita `db`: decláralo como función, `db => ({name, plugin(schema){…}})`.
- 🔴🔴 **Eje 2 — el ARREGLO va en el `type`, NUNCA en el campo**: `files: {type: ["File"], name: "Files", cols: 3}` ✅; `files: [{type: "File", name: "Files"}]` ❌ (tus options se vuelven PATHS y pierdes label/filtro **en silencio**; con un type custom revienta el boot). El único atajo inocuo es `campo: [SubSchema]` con un `db.Schema` y sin ninguna option: no lo uses de patrón.
- Son **independientes**: `{type: [{a, b}]}` tiene el arreglo bien puesto y explota igual por el eje 1.

El ejemplo completo y la causa raíz: [references/object-types-docarray.md](references/object-types-docarray.md).


## 4. OPTIONS — el segundo argumento de `new db.Schema(campos, options)`

| Option | Qué es |
|---|---|
| `name` | Nombre visible del ADMINISTRADOR del modelo ("Vehicle Administration") — título de la interfaz |
| `modelName` | Nombre plural/colección ("Vehicles") |
| `nameField` | El campo que nombra al documento (default `"name"`): es lo que muestran un select que apunta al modelo, el `getSimpleName`, el `htmlName` y la respuesta de guardar. 🔴 **Es un campo GUARDADO**: el select lo busca y lo ordena en la BD y solo trae ese campo (`formOptions` hace `select`). Si el nombre es calculado (nombre + apellido, código + glosa), se calcula en `pre("validate")` sobre un campo real. Un virtual no se busca, obliga a traer el documento entero y lo que lea (la zona, otro modelo) queda fuera de la consulta: **un virtual solo vale para referencias inversas** (`SimpleRef`). Un modelo nombrado por un virtual está mal y lo corrige su dueño |
| `description` | Descripción del modelo (UI admin, ayuda) |
| `aiDescription` | 🔴 **Obligatoria en todo modelo nuevo.** Descripción técnica para máquinas, al lado de la `description` corta para personas: qué es y qué guarda, en una o dos frases, para que un LLM externo entienda el sistema sin leer código. Nadie la pinta. Viaja sola por las puntas: la función del modelo en `checkLogin` y las tools del plugin `mcp`. Va también en una punta (`API`), en un campo y en `type.options` (default que el campo pisa). Test: `tests/back/aiDescription.test.js` |
| `icon` | Ícono del menú/admin |
| `defaultMethods` | Verbos habilitados: `["GET","POST","PUT","DELETE"]` — define qué CRUD existe |
| `userData` | (autenticables) campos que viajan en la sesión al front |
| `deleteMode` | `"soft"` (default — borrar = `active:false`, unique pasa a parcial), `"hard"`, `"none"`. 🔴 **`active` es nombre RESERVADO**: lo inyecta el FW en todo modelo raíz con soft delete, el prefind filtra `active:true` y el nombre simple agrega " (borrado)" si es `false`. Un campo propio `active` con otro significado choca con eso: se llama distinto (caso demo, 14-sep-2026) |
| `noCreate` / `noUpdate` / `noCRUD` | apagar operaciones del administrador |
| `registrable` | (autenticables) habilita registro público externo — ver references |
| `Bitacora` | historial de hechos embebido — ver references |
| `API` / `route` | puntas y rutas propias del modelo — skill `itdfw-api-system` |
| `cache` | política de cache de las puntas del modelo: `{maxAge, swr, public, noStore}` (sin `Vary`: el SW indexa por URL; lo que cambia el contenido va en la URL) o `(req) => política` decidiendo por punta con `req.params.ext`; `undefined` cede al default del deploy (`cache:` en la config, un mapa por ext: la estructura fija, los datos SWR) y sin nada es `private, max-age=0` (se guarda, se revalida siempre: 304 barato; back ≥ 7.4.1). Un modelo normal no declara nada. Canónico: `cache: req => ({tableData: {maxAge: 0, swr: 60}, tableFields: {maxAge: 300}})[req.params.ext]` (la estructura es fija, los datos son SWR). Valores y reglas: `itdfw-api-system` §atributo `cache` |
| `group` + `formSpecs: {grouped: true}` | **el formulario en SECCIONES (cards)**: `group: [{name: "identification", title: "Identificación"}, …]` en las options, y en cada campo `group: "identification"`. El front arma un bloque por grupo con sus campos; los campos sin `group` (o con uno inexistente) van a un bloque implícito **primero**, así un campo nuevo aparece arriba y nunca desaparece. Es un card envolvente, no un acordeón: para eso está el sub-schema embebido (`nested`, collapse), que es otra cosa (un sub-documento). Caso vivo: el modelo de socios de un deploy financiero. Solo por modelo en archivo o `DBModelRaw`: el `DBModel` guiado no tiene `group`. 🔴 **Requiere back ≥ 7.3.9** (el que manda `groups`/`grouped` en `formSpecs`); el front lo soporta desde `site-vue-core` 7.0.4. Con un back anterior el formulario sale plano sin error |

🔴 **El namespace de options es ABIERTO**: las de arriba son el núcleo común, pero el canal lo usan
TODOS los plugins — cada plugin es una OFERTA dormida que se activa cuando el modelo declara SU
option (enchufe pull: declarar la option ES pedir la funcionalidad). El inventario completo por
familias (identidad/CRUD/AAA/ofertas/flujo) + los transitivos que NO son API del modelador:
[options-catalog.md](references/options-catalog.md). Un clon puede sobreescribirlas (safeClone
resetea/reemplaza).

## 4b. CLONAR un modelo existente — `safeClone` (mecanismo general)

Cualquier schema se puede clonar para **heredar su estructura Y su lógica de negocio** y especializarla:
```js
const MySupport = Request.safeClone({name: "...", modelName: "...", ...});  // opciones FLAT
```
Ejemplo: el modelo `Request` (requerimientos de la plataforma) se clona para requerimientos de un
dominio propio — mismos campos/flujo, otro contexto. El clon resetea name/description/methods/API y
sobreescribe las options que le pases; después se le agregan/ajustan campos como a cualquier schema.
**Corolario**: clonar `User` replica la lógica de autenticación completa → así se hacen los modelos
autenticables (ver references/authenticatable.md). Requiere pedir el schema base vía
`await this.init("X", {schemas: ["Request"]})` (función async).

## 4c. 🔴 Escribir con `save()` = estar en el flujo. Saltárselo se puede, pero te haces cargo.

```js
// ✅ el flujo del FW
doc.campo = valor;
doc.hijos.push({...});
await doc.save();

// ❌ se salta TODO el framework, en silencio
await Model.updateOne({_id}, {$push: {hijos: {...}}});
await Model.findOneAndUpdate(query, {$setOnInsert: {...}}, {upsert: true});
```

**El FW no hace magia: sus plugins enganchan los hooks de documento** (`pre`/`post` de `validate` y `save`). Las operaciones de query (`updateOne`, `updateMany`, `findOneAndUpdate`, `bulkWrite`, `insertMany`) **no pasan por ellos**: escribir así se come bitácora, `__history`, `updateUser`/`updateDate`, multitenant, cast de types custom, validación y cualquier plugin futuro, **y no avisa**.

🔴 **La regla NO es "no se puede": si no usas `save()`, eres responsable de lo que haces.** Saltárselo es legítimo y a veces obligatorio (un plugin que escribe con `save()` se dispara a sí mismo; `previousField` usa `updateMany` dentro de un `Mutex.lock`); entonces son tuyos los hooks que no corrieron, la coordinación entre procesos y la consistencia. Lo que NO vale es saltárselo **sin saberlo**.

🔴 **Efecto colateral**: con `save()`, los `pre`/`post` del **sub-schema** de un docArray corren sobre **todos los subdocumentos**, también cuando solo cambió un campo del root. **No cuelgues de un `post("save")` de sub-schema una acción con efecto externo** (evento, correo, API): va donde se sabe QUÉ cambió (la punta o el static que hizo el cambio). Las mediciones, el orden de los hooks y la sonda: [references/save-flow.md](references/save-flow.md).


## 4d. 🔴 Rechazos de regla desde el modelo: `HTTPError`, no `Error`

Desde `pre("validate")` / `pre("save")` se tira `HTTPError` (global de `server.js`, no se importa) y **llega al
cliente con su status y su texto**: `throw new HTTPError("El plan ya está cerrado", 409, {planId})`. Un `throw new
Error(...)` pelado llega como **500 UNCONTROLLED** y le manda un correo al admin. Firma y extras: skill
`itdfw-api-system` §Flujo de errores.

## 4e. 🔴 Al guardar, los campos ajenos se omiten en SILENCIO

Un campo `readonly`, `disabled`, `hidden` para ese contexto o inexistente en el schema **se descarta sin error**, a
propósito (no dar pistas). Solo vuelven los fallos de lógica, permisos u operación. "Guardé y no pasó nada" NO es
el modelo callándose un error: es esa regla, y el problema real está en otro lado (tamaño del cuerpo, permiso, una
regla que tira `Error` pelado).

## 4f. Archivos: `File`, y el ARCHIVO-FUNCIÓN

`File` (core, GridFS) guarda bytes… salvo cuando **`metadata.method`** está presente: entonces no hay bytes, el
documento guarda `{ownerModel, ownerId, method, params}` y `stream()` **llama al método del documento dueño para
generar el archivo al vuelo**, con `Cache-Control: no-store` (`File.js`: `const isFunc = !!localFile.metadata?.method`;
almacenar un stream en uno de estos tira `HTTPError` 500 a propósito). Las llaves de `metadata` (`ownerId`,
`ownerModel`, `isFunction`, `method`, `args`) están comentadas en `File.js`.

Principio de diseño detrás: **el back compone el JSON y el documento se genera en el front** (pdfMake sobre una
DocDefinition en `ItdFile`), para no gastar procesamiento del servidor en lo que el cliente puede hacer. ⟹ Antes
de generar un Excel/PDF y guardar sus bytes en GridFS: ¿el archivo es evidencia que hay que conservar (sí: bytes) o
una vista de datos que se puede regenerar (archivo-función)?

Subida: el front manda multipart con el path del campo como `fieldname` y el JSON en `__data`; la punta custom
declara `hasFiles`; `file.originalname` llega en UTF-8 desde back 7.3.6 (`itdfw-api-system` §Archivos).

## 5. RETORNO — qué devuelve la función

Un **objeto con los schemas definidos**: `return {Vehicle}` o varios `return {Vehicle, VehicleType}`.
La KEY es el nombre con que el modelo se registra (`db.model("Vehicle")`, MCP, puntas). El archivo
exporta la función: `export default Schema;`.

## 6. PRUEBAS — cómo verifico que quedó bien (MCP itdfw)

El MCP es los OJOS sobre el FW corriendo — sin leer código:

| Verificar | Tool MCP |
|---|---|
| El modelo existe y registró | `listModels` |
| Paths, types (¿promovió el tenant?), labels | `modelFields <Modelo>` |
| El form que verá el usuario (create/update) | `schemaToForm <Modelo>` |
| La grilla (columnas) | `schemaToTable <Modelo>` |
| Datos reales / el CRUD opera | `query <Modelo>` |
| Cualquier punta (p.ej. registro) | `callEndpoint GET APP/register.json?model=X` |
| Catálogo de types disponibles | `listTypes` |

Regla: **NO declarar "listo" sin verificar vía MCP.**

### 🔴 Un modelo recién creado NO es accesible hasta ASIGNARLO A UN PERFIL

Que el modelo cargue **no** lo hace visible ni llamable: un **403** al llamar sus puntas justo después de crearlo (un **401** sin identidad) es el sistema de perfiles funcionando, **no un error**. Antes de dudar del código: **¿está asignado a un perfil?** (`Profile.functions`, con los verbos que corresponda: el formulario del perfil o el MCP `assignFunction {profile, path, defaultMethods?}`, idempotente). Ningún mecanismo agrega funciones a un perfil que ya existe; un plugin solo siembra perfiles propios nuevos.

### 🔴 La ruta de las puntas (y por qué el 404 miente)

`APP/AAA/<Modelo>.<func>` ✅ (ej. `APP/AAA/Vehicle.formCreate`) · `APP/AAA/<Modelo>.<func>.json` ❌ → 404 `endpoint not found`: la FUNCIÓN ocupa el lugar de la extensión. **404 = la punta no está registrada · 403 = existe y tu perfil no la tiene · 401 = no hay identidad.** Si el modelo aparece en `listModels`, el modelo NO es el problema.

Las dos vías de asignación con su detalle y la trampa del 404: [references/after-creating.md](references/after-creating.md).

## Red flags — si te ves haciendo esto, PARA

- 🔴🔴 **Tipo objeto con LITERAL en vez de `new db.Schema(...)` — REVIENTA EL BOOT COMPLETO.** Aplica a
  embedded Y docArray por igual (no es cosa de arreglos). Es el error más caro del skill: no falla tu
  modelo, **cae el servicio**. Ver §3b eje 1.
- 🔴🔴 **El arreglo declarado en el CAMPO (`campo: [{...}]`) en vez de en el TYPE
  (`campo: {type: [X], ...}`)** — tus options se vuelven PATHS (pierdes label/filtro **en silencio**), y
  con un type custom revienta el boot. Ver §3b eje 2.
- 🔴 **Creer que son el mismo error.** Son ORTOGONALES: `{type: [{a,b}]}` tiene el arreglo bien puesto y
  explota igual. Se cruzan en el docArray, nada más.
- 🔴 Escribir con `updateOne`/`findOneAndUpdate`/`bulkWrite` "porque es más directo" → te saltaste TODOS los plugins del FW sin darte cuenta. Saltárselo se puede; **hacerlo sin saberlo, no** (§4c).
- 🔴 Colgar un efecto externo (emitir, mandar correo, llamar API) de un `post("save")` de **sub-schema** → corre para todos los subdocumentos, y hasta cuando nadie los tocó (§4c).
- Dudar del modelo / tocar código porque "no aparece" **sin haberlo asignado a un perfil** primero.
- Implementar login/password/hash/recovery a mano → es clon de User (references/authenticatable.md).
- Enum en español o snake_case → inglés camelCase, sin excepción.
- `String` para teléfono/dirección/email → catálogo de types (`listTypes`).
- `state`/`status` de negocio como campo editable → bitácora de hechos (references/state-flows.md).
- Type local (Rut/Cuit) declarado EN el modelo → plugin de tenant (references/conventions.md).
- Declarar `component`/validaciones que el type ya deriva → redundancia.
- Copiar nombres de otros proyectos sin verificar vía MCP (`profileName`, no `profile_name`).

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.

