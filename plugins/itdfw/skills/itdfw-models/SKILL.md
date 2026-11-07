---
name: itdfw-models
description: Use when creating or modifying ITDFW backend business models (mongooseSchema files) — where the file lives (DEFAULT vs app), how the Schema function works (params, bind, async, return), how to define fields and model options, how to verify via MCP, and the specializations: authenticatable models, public registration, multitenant fields, state flows, field conventions.
---

# ITDFW Models — Implementar modelos de negocio

**Audiencia: un dev SIN acceso al código del FW.** Este skill basta para crear un modelo nuevo con
cero código visible (salvo los ejemplos internos). SKILL.md = la BASE (todo modelo); las
especializaciones viven en `references/`. Hermanos: `itdfw-api-system` (puntas/AAA),
`itdfw-mongoose-types` (types custom), `itdfw-fwplugin` (plugins), `itdfw-db-models` (el modelo
definido en la BD en vez de un archivo — mismo modelado, otra vía de carga).

## 1. DÓNDE — ubicación del archivo

La raíz NO es una convención: es **`documentRoot`**, definido en la configuración del deploy
(`/etc/itdfw/<deploy>.yaml`, p.ej. `documentRoot: /var/www/cooperativa`). De ahí el FW deriva
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
                         //   (caso conviene/Place, 2026-09-04). Sin el índice, `$near` revienta.
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
| `enum` | values SIEMPRE inglés camelCase: `["draft","approved"]` |
| `ref` / `refPath` / `myRef` | referencia a otro modelo (Select con options dinámicas). `refPath`=modelo polimórfico desde otro campo. `myRef`=ref por FUNCIÓN (getRef custom, no un modelo). Detalle: [special-refs.md](references/special-refs.md) |
| `pos` / `tablePos` | orden en form / grilla. 🔴 **El orden de un form es el de declaración**: si un campo va al final, se declara al final. `pos` es solo para forzar un lugar aunque otro enchufe campos. Si un plugin agrega campos a un modelo ajeno y lo desordena, el orden lo cuida el dev del plugin, no el dueño del modelo (caso: el historial del ticket de helpdesk llevaba `pos: 1000` y quedó declarado al final, `d3fafda0`) |
| `description` | ayuda contextual |
| `aiDescription` | 🔴 **obligatoria en todo campo nuevo**: la descripción para máquinas (la lee un LLM vía MCP o la paleta). Qué guarda, para qué se usa y, si hay un vecino parecido, qué NO es (`updateDate`: "last change to the record, NOT related to sign-ins"). En inglés. Si no sabes con certeza qué guarda, no la inventes: déjala anotada como pendiente (una descripción mala hace que el LLM elija mal, medido) |
| `placeholder` | texto del input vacío. **No hace falta declararlo**: si el campo no lo trae, `toInput` pone el del type (`Phone` trae el suyo) y si no el **genérico por type** del deploy (`genericPlaceholder` en `.itdfw.js`/yaml, skill `itdfw-deploy-config`), y sin nada `"Enter data"`. Se declara solo para cambiarlo (un `ref` que quiera "Buscar" en vez del genérico). Se traduce como cualquier texto (back desde 22-sep-2026) |
| `controller` | comportamiento dinámico del form, p.ej. `"changeOptions"` (ver references) |

**Derivados — NO los declares si no necesitas cambiarlos**: `component` deriva del `type`
(type "Phone" → componente Phone; solo se declara para override), `options` deriva de `enum`,
`label` deriva de `name`, validación/cast vienen del type (NO los dupliques en pre-save).

**Familia `filterXXX` — overrides del campo SOLO en contexto filtro** (el FW construye el form de
filtro derivándolo del de edición; estos atributos lo especializan sin tocar create/update):

| Atributo | Qué hace en el filtro |
|---|---|
| `filterType` | pisa el `type` del input (ej. un campo `text` → `"search"`) |
| `filterComponent` | pisa el `component` (ej. un ref pesado → componente liviano) |
| `filterDefault` | valor inicial del filtro (valor o función `(req)=>val`) |
| `filterName` | pisa el `label` solo en el filtro |
| `filterTag` | pisa el `tag` del input |
| `betweenType` | con `filter:"between"`, el operador del rango (`"="`, etc.) |

🔴 **Un `ref` en el filtro se expande al FORM del modelo referenciado (Embedded en un drawer) salvo `onlyRef: true`**,
que lo deja como select typeahead sobre `getRef` (`FrontEnd.js`: `hasRef(input) && !input.onlyRef` → Embedded). Es lo
que usa `creationUser` del plugin `Accounting`, y lo que un modelo declara cuando quiere filtrar por "quién" y no por
los campos del otro modelo. (Gap #46, 21-sep-2026, `Sample.owner` del banco de smart-fetch.)

🔴 **La multiselección del filtro se DERIVA, no se declara.** El FW pone `multiple: true` sobre el input
del filtro cuando el campo lo justifica: referencias (`ref`/`myRef` → `ItdSelect` unificado) y arreglos
(un arreglo viaja SIEMPRE con `multiple: true`). El único valor de `filter` que altera la forma del input
es `"between"`.

⟹ Si un campo necesita filtrarse por varios valores y no lo hace solo, el ajuste va por la familia
`filterXXX` (abajo), que opera sobre el input.

A nivel de **options del schema** (2 más, raras): `cacheFilter:true` cachea el form de filtro
(modelos con filtro pesado y estable); `tableFieldsFilter: (req, inputs)=>inputs` post-filtra los
campos de la grilla por request. Todo esto lo consume el static `formFilter`.

## 3b. 🔴🔴 DOS ejes ORTOGONALES que se cruzan en el docArray (y por eso se confunden)

Casi todo el mundo los mezcla porque el caso donde más aparecen es el mismo. **Pero cada uno rompe por su
cuenta, con síntomas distintos**:

| Eje | La pregunta | ✅ | ❌ |
|---|---|---|---|
| **1. Cómo se CONSTRUYE el objeto** | ¿pasó por la fábrica del FW? | `new db.Schema({...})` | literal `{a: …, b: …}` |
| **2. Dónde va el ARREGLO** | ¿en el type o en el campo? | `{type: [X], ...options}` | `campo: [ … ]` |

**La prueba de que son independientes** (el caso que engaña): pones el arreglo donde corresponde… y
explota igual, porque el elemento sigue siendo literal.

```js
files: {type: [{a: String, b: String}], name: "Files"}   // ❌ eje 2 BIEN, eje 1 MAL → BOOM
```

---

### Eje 1 — TODO tipo objeto se construye con `db.Schema`. Sin excepción.

🔴 **Esto NO es cosa de docArrays**: aplica a **cualquier** campo de tipo objeto. Un **embedded simple**
declarado como literal cae exactamente igual — para el rastreador del FW, embedded y docArray son lo mismo:
una entrada en `childSchemas` con su `.schema`.

```js
const Line = new db.Schema({channel: {type: String}, externalId: {type: String}}, {_id: false});

// ✅
schema.add({detail: {type: Line, name: "Detail"}});          // embedded
schema.add({lines:  {type: [Line], name: "Lines"}});         // docArray

// ❌ REVIENTA EL BOOT — las dos, por la misma razón
schema.add({detail: {type: {a: String, b: String}, name: "Detail"}});
schema.add({lines:  {type: [{a: String, b: String}], name: "Lines"}});
```

**Mongoose acepta el literal sin chistar** —crea un schema implícito— y por eso el error aparece lejos y
tarde. Pero ese hijo **NO pasa por `db.Schema`**, así que nace **crudo**: sin las extensiones que el FW
instala en el prototipo (`eachVirtualPath`, entre otras). Cualquier plugin del framework que recorra
`childSchemas` se lo encuentra y explota.

🔴 **El costo real (caso 2026-08-14, media hora de caza a ciegas)**: un plugin declaró un docArray con
literal sobre `User`. Resultado:

- **Cayó el boot ENTERO** — no el plugin, no el modelo: el servicio.
- Se llevó puestos a **User, Member y DelegatedUser** (todo lo que clona User).
- El error —`currentSchema.eachVirtualPath is not a function` en `02hasFiles`— **no nombra ni el plugin,
  ni el modelo, ni el campo culpable**. Apunta a un archivo del core que no tiene nada que ver.
- Al caer `User`, cae la autenticación → **todas las puntas responden 500**, y el síntoma parece de red o
  de sesión, no de un schema.

⟹ Regla de lectura: **`eachVirtualPath is not a function` = alguien declaró un sub-schema con literal.**
Busca el docArray/embedded más reciente que se haya agregado (revisa los plugins primero: un
`schema.add` desde un plugin lo inyecta en modelos que ni sabes que lo tienen).

Corolario para plugins: si tu plugin agrega campos anidados **necesita `db`** para construirlos. Un plugin
declarado como objeto plano no lo tiene → decláralo como función (`db => ({name, plugin(schema){…}})`).

### Eje 2 — el ARREGLO va en el `type`, NUNCA en el campo

```js
// ✅ el arreglo es del TYPE — el campo sigue siendo un descriptor con sus options
files: {type: ["File"], name: "Files", cols: 3}
lines: {type: [Line], name: "Lines"}

// ❌ el arreglo es del CAMPO — mongoose lee el objeto como DEFINICIÓN DE SUB-SCHEMA
files: [{type: "File", name: "Files", cols: 3}]
```

**Dos daños distintos, según qué type lleve adentro:**

1. **Tus options se vuelven PATHS.** Mongoose entiende que el objeto describe **los campos del
   subdocumento**, así que `name`, `cols`, `filter`, `required`… dejan de ser options: terminas con un
   docArray cuyos elementos tienen un campo llamado `name` y otro llamado `cols`, y tu campo pierde label,
   filtro y ancho **en silencio**.
2. **Con un type CUSTOM, revienta el boot** (hallazgo #98, causa raíz verificada): mongoose resuelve el
   elemento por **dos fuentes de Types distintas** según la forma. `{type:[X]}` lee de
   `db.Schema.Types` —la copia de instancia donde el FW registra los custom— y funciona; `[{type:X}]` cae
   en `SchemaArray`, que lee del **módulo core estático**, donde los custom NO están →
   `Cannot set properties of undefined (setting '_arrayPath')`. Con types built-in (String/Number) las dos
   formas andan, y por eso el error solo aparece cuando alguien usa un type propio.

⟹ La forma canónica es **siempre** `{type: <lo que sea>, ...options}`. El arreglo es parte del TYPE.

Único caso donde el atajo `campo: [SubSchema]` es inocuo: cuando `SubSchema` **ya es un `db.Schema`** y el
campo **no lleva ninguna option**. Funciona, pero no lo uses como patrón — el día que alguien le agregue un
`name` se convierte en el caso malo sin que nada avise.

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
| `cache` | política de cache de las puntas del modelo: `{maxAge, swr, public, noStore}` (sin `Vary`: el SW indexa por URL; lo que cambia el contenido va en la URL) o `(req) => política` decidiendo por punta con `req.params.ext`; `undefined` cede al default del deploy (`cache:` en la config, un mapa por ext: la estructura fija, los datos SWR) y sin nada es `private, max-age=0` (se guarda, se revalida siempre: 304 barato; back ≥ 7.4.1, gap #44). Un modelo normal no declara nada. Canónico: `cache: req => ({tableData: {maxAge: 0, swr: 60}, tableFields: {maxAge: 300}})[req.params.ext]` (la estructura es fija, los datos son SWR). Valores y reglas: `itdfw-api-system` §atributo `cache` |
| `group` + `formSpecs: {grouped: true}` | **el formulario en SECCIONES (cards)**: `group: [{name: "identification", title: "Identificación"}, …]` en las options, y en cada campo `group: "identification"`. El front arma un bloque por grupo con sus campos; los campos sin `group` (o con uno inexistente) van a un bloque implícito **primero**, así un campo nuevo aparece arriba y nunca desaparece. Es un card envolvente, no un acordeón: para eso está el sub-schema embebido (`nested`, collapse), que es otra cosa (un sub-documento). Caso vivo: `Member.js` de cooperativas. Solo por modelo en archivo o `DBModelRaw`: el `DBModel` guiado no tiene `group` (gap #25, 17-sep-2026). 🔴 **Requiere back ≥ 7.3.9** (el que manda `groups`/`grouped` en `formSpecs`); el front lo soporta desde `site-vue-core` 7.0.4. Con un back anterior el formulario sale plano sin error |

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
Caso real: el modelo `Request` (requerimientos de la plataforma) se clona para requerimientos de un
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

**El FW no hace magia: usa las herramientas de los módulos que usa.** Todo lo suyo cuelga de **plugins
de mongoose**, y esos plugins enganchan los **hooks de documento** (`pre`/`post` de `validate` y `save`).
Las operaciones de query (`updateOne`, `updateMany`, `findOneAndUpdate`, `bulkWrite`, `insertMany`)
**no pasan por los hooks de documento** — es una decisión de mongoose y el FW no puede compensarla.

⟹ Escribir por esa vía **se come el flujo**: bitácora, `__history`, `updateUser`/`updateDate`,
multitenant, cast de types custom, validación, y cualquier plugin que un tercero enganche mañana.
**Y no avisa**: la operación responde OK y el dato queda escrito a medias respecto del contrato.

🔴 **Verificado empíricamente (2026-08-15, sonda contra el FW real)**: `Model.updateOne(..., {$push})`
sobre un docArray → **CERO hooks disparados**, ni del root ni del subdocumento.

### 🔴 La regla NO es "no se puede" — es "si no usas `save()`, eres responsable de lo que haces"

Saltarse el flujo es **legítimo y a veces obligatorio**. El propio FW lo hace: un plugin que escribe con
`save()` se dispara a sí mismo → **recursión infinita**. Por eso `previousField` (denormalización de
campos hacia los hijos) escribe así:

```js
await Model.model("Mutex").lock({          // ⟵ coordina entre procesos
  async fn() {
    await Model.updateMany(query, update, {strict: false, updatePipeline: true});
  }
});
```

Se salta el flujo **porque debe** (masivo, N documentos, y con `save()` se auto-invocaría), y a cambio
**asume los recaudos**: mutex, chequeo de vista, solo el primer proceso. Ese es el trato completo.

⟹ El criterio: **¿quiero el flujo del FW?** → `save()`. **¿Necesito saltármelo?** → adelante, pero
entonces son tuyos los hooks que no corrieron, la coordinación entre procesos y la consistencia. Lo que
NO vale es saltárselo **sin saber que lo hiciste** — que es el caso de "usé `updateOne` porque era más
directo".

### Efecto colateral que sí hay que conocer: los hooks del docArray corren para TODOS

Con `save()`, los `pre`/`post` del **sub-schema** de un docArray corren sobre **todos los subdocumentos**,
no solo el que cambió — y también cuando solo se modificó un campo del root. Medido:

| Operación | Qué dispara |
|---|---|
| crear con 3 subdocs | 3 `pre` + 3 `post` del sub, 1 `post` del root |
| agregar **1** subdoc a 3 existentes | **4** `pre` + **4** `post` del sub |
| modificar SOLO un campo del root | **4** `pre` + **4** `post` del sub (¡sin tocar el array!) |
| `updateOne` con `$push` | **nada** |

Además: el `post` del **root** corre **antes** que los `post` de los subdocumentos, el orden entre
subdocumentos **no es determinista**, y `modifiedPaths()` discrimina cuál cambió **solo en el `pre`** (en
el `post` ya viene vacío para todos).

⟹ **No cuelgues de un `post("save")` de sub-schema una acción con efecto externo** (emitir un evento,
mandar un correo, llamar una API): se dispara para todos los subdocumentos y hasta cuando nadie los tocó.
Esa acción va donde se sabe QUÉ cambió — la punta o el static que hizo el cambio.

## 4d. 🔴 Rechazos de regla desde el modelo: `HTTPError`, no `Error` (gap #16)

Desde `pre("validate")` / `pre("save")` se tira `HTTPError` (global de `server.js`, no se importa) y **llega al
cliente con su status y su texto**: `throw new HTTPError("El plan ya está cerrado", 409, {planId})`. Un `throw new
Error(...)` pelado llega como **500 UNCONTROLLED** y le manda un correo al admin. Firma y extras: skill
`itdfw-api-system` §Flujo de errores.

## 4e. 🔴 Al guardar, los campos ajenos se omiten en SILENCIO (gap #19)

Un campo `readonly`, `disabled`, `hidden` para ese contexto o inexistente en el schema **se descarta sin error**, a
propósito (no dar pistas). Solo vuelven los fallos de lógica, permisos u operación. "Guardé y no pasó nada" NO es
el modelo callándose un error: es esa regla, y el problema real está en otro lado (tamaño del cuerpo, permiso, una
regla que tira `Error` pelado).

## 4f. Archivos: `File`, y el ARCHIVO-FUNCIÓN (gap #20)

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

Que el modelo cargue **no** lo hace visible ni llamable. Recién creado no es accesible **para nadie**:
hay que **asignarlo a un perfil** (`Profile.functions`) con los verbos que corresponda. Un **401** al
llamar sus puntas justo después de crearlo es el sistema de perfiles funcionando, **no un error** —
y no hay nada que arreglar en el modelo.

⟹ Antes de dudar del código: **¿está asignado a un perfil?** Es el paso que más se olvida, porque el
modelo compila, arranca y hasta crea su colección en la BD sin él.

### 🔴 La ruta de las puntas (y por qué el 404 miente)

```
APP/AAA/<Modelo>.<func>      ✅   ej: APP/AAA/Vehicle.formCreate
APP/AAA/<Modelo>.<func>.json ❌   → 404 "endpoint not found"
```

**La FUNCIÓN ocupa el lugar de la extensión**, no va después. Con `.json` al final recibes
**404 `endpoint not found`**, que es **indistinguible de "el modelo no existe"** → invita a parchar un
modelo sano. Quítale el `.json` y el mismo llamado responde **401** (o el dato).

> Regla de lectura: **404 = la punta no está registrada** · **401 = existe pero tu perfil no la tiene**.
> Si el modelo aparece en `listModels`, el modelo NO es el problema — revisa la URL y el perfil antes
> de tocar código.

(Mismo comportamiento y misma trampa que en los modelos definidos en la BD → `itdfw-db-models`.)

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

## References (cuándo leer)

| Reference | Leer cuando... |
|---|---|
| [authenticatable.md](references/authenticatable.md) | el modelo se LOGUEA (clon de User, registrable, perfil forzado) |
| [special-refs.md](references/special-refs.md) | el field referencia algo no-trivial: `refPath` (modelo polimórfico), `myRef`+`addGetRef` (ref por función — catálogo custom, 2º param obligatorio por ofuscación), descubrimiento vía tableFields, errores → 500 |
| [options-catalog.md](references/options-catalog.md) | el inventario de OPTIONS por familias (estrictas vs ofertas de plugins, transitivos, virtuales de fila) |
| [conventions.md](references/conventions.md) | convenciones finas de campos: hidden global-vs-contexto, multitenant, canónico limpio, índices, decisiones del cliente |
| [state-flows.md](references/state-flows.md) | el modelo tiene flujo de estados de negocio (prospect→member, application→approved) |
| [config-driven.md](references/config-driven.md) | valores/políticas por despliegue: definir shape (`setConfigDefinition`), crear el valor (modelo Config), leer (`getConfig` sync/async), sembrar un docArray desde config en `default()` |
| [schema-engine.md](references/schema-engine.md) | el motor: qué es `this` (instancia Schema), orden de carga, esperar dependencias sin línea de tiempo (proxy + `init`/`waitFor`), eventos de control (`on schema-X`/`model-X`), hook `ITDExecPost`, interconexión runtime vía pool (inyección directa vs `shareData`→req) |
| [example-model.js](references/example-model.js) | ejemplo BASE: modelo plano completo |
| [example-authenticatable.js](references/example-authenticatable.js) | ejemplo del autenticable mínimo |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
