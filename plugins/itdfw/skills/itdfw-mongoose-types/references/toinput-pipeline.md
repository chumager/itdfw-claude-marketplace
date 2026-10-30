# toInput Pipeline + por qué los types se sobrecargan

🔴 **Un type NO se sobrecarga por gusto**: sus `options` existen porque PLUGINS `toXXX` las consumen.
`toFilter`/`toPDF`/`toXLS` cuelgan de las options del schemaType y operan sobre ellas; el `toInput`
las ensambla para el front. Sin ese cruce (§4) el resto es patrón hueco. El front, además, **nunca
recibe funciones** — el pipeline las ejecuta o las borra antes de enviar.

## 1. El ensamblador `toInput` (plugin `mongoosePlugins/toInput.js`)

Es el ÚNICO que arma el input que viaja al front, por cada path:
1. `input = cloneDeep(schemaType.options)` — las `options:{...}` del type (o lo seteado por
   `Schema.Types.X.set(...)`) son la BASE.
2. Ejecuta tres hooks **en orden**, mergeando sobre `input` (later overrides earlier):
   `toInputBase` (universal) → `toInputNative` (per-type) → `toInput` (per-field override).
   Firma de cada hook: `fn.call(Model, {schemaType, path, input, schema, req, transform, omitAttrs, pickAttrs})`.
3. Normaliza: `label`/`name`/`path`, `value` (de `default`, **ejecutándolo si es función**), `type`
   (`myType ?? instance ?? options.type`), `component ??= type`.
4. Resuelve **atributos contextuales** (§2).
5. `myRef`→`ref`; arma `validate` desde `_validate`/`min`/`max`/`match`/`required`; `enum`→`options`.
6. Aplica `forceAttrs` (§3), luego `transform` (de FrontEnd), `filter`, `omitAttrs`/`pickAttrs`.
7. 🔴 `pure:true` (default) → **borra toda propiedad que sea función** ⟹ al front no viajan funciones.
   `pure:false` solo lo piden consumidores server-side que necesitan ejecutar la función (download/PDF).

### Las 3 etapas (qué hace cada una)

- **toInputBase** (set en `postLoad`, TODOS los types): si hay `ref`/`refPath`/`myRef` o
  `enum`/`options` → `component = "ItdSelect"`; default `toFilter`/`toXLS`.
- **toInputNative** (per-type): config específica. Ej. `Array` arma el `subInput` recursivo y decide
  `ItdSelectMulti` vs `ArrayAdd` según haya fuente de options; `String`/`Number` pasan `enum`→`options`.
- **toInput** (per-field, en el schema): override puntual del campo (`toInput: {component, options...}`).

## 2. ⭐ Atributos contextuales polimórficos (boolean | string | array<string> | función)

Hay **DOS mecanismos distintos** — no confundirlos:

### A) `attrAsFunction` — atributos que, si son FUNCIÓN, se ejecutan SIEMPRE (server-side)
Lista base: **`["options", "readonly", "disabled", "hidden"]`** (extensible por campo declarando
`attrAsFunction: [...]`). Si el atributo es función, el pipeline la ejecuta y la **reemplaza por su
resultado** antes de enviar:
```js
// firma: this = Model; recibe un OBJETO con req (NO el doc, NO viewType)
hidden: function ({path, req, schemaType, input, schema}) {
  return req.user?.level < 3 ? ["update"] : false;   // puede retornar bool | string | array
},
options: async function ({req}) { return await req.db.model("X").distinct("y"); }  // caso ItdSelect dinámico
```
Punto del pipeline: tras normalizar type/component/value, ANTES de validate/forceAttrs/transform. El
valor llega al front ya resuelto a su tipo final.

#### `requiredForm` también es `attrAsFunction` (2026-08-27)

Está en la lista base junto a options/readonly/disabled/hidden, así que puede ser **función de
contexto** y se resuelve antes de que `toInput` lo consuma (`validate.required = requiredForm || …`).
Recibe lo mismo que las otras: `{path, req, schemaType, input, schema}` — `req`, NO el doc.

🔴 Para saber DÓNDE está parada, la función lee **`req.contextType`**: lo dejan los generics de
`FrontEnd.js` con `??=` (**gana la punta**, el anidado no pisa) — `tableFields`→`view`,
`tableFieldsDetail`→`detail`, `formGeneric`→último string de `activateAttrsArray`
(`create`/`update`/`register`/`profile`; el default `[true]` no setea nada),
`formSpecsGeneric`/`pickInput`/`FWcreateG`/`FWupdateG`→su `type`.

Su espacio de valores es `true | texto (mensaje) | false` — **NO verbos**. Por eso NO va en el riel del
sift (`activateAttrs`, mecanismo B): ahí un string se interpretaría como contexto, no como mensaje.

### B) Resolución por VERBO (`sift` en el `transform` de FrontEnd)
Los valores **declarativos** string/array de `disabled`/`readonly` se colapsan a boolean según el
contexto del verbo activo (`formCreate`→`[true,"create"]`, `formUpdate`→`[true,"update"]`, genérico
`[true]`). `activateAttrs = ["disabled","readonly"]`. Ej: `disabled: "update"` → en `formUpdate` se
resuelve a `true`; en create queda `false`. (No ejecuta funciones; eso ya lo hizo el mecanismo A.)

### C) `hidden` — puerta de inclusión/seguridad (NO se resuelve a boolean)
`hidden` (bool | string | array de contextos `view/create/update/register/profile`) se usa como
**filtro**: si su valor matchea el verbo, el campo NO entra al form ni al `_.pick` del guardado
(`pickCreate`/`pickUpdate`/`pickRegister`/`pickProfile`/`pickView`). Es la **puerta front↔back**: un
campo `hidden` para un contexto no se puede colar en el guardado de ese contexto (fix de seguridad).

### `hidden` ⊥ `send` — INFRA vs DATO (ortogonal)
`hidden` controla la **infra** (¿se renderiza el input/componente?); `send` controla el **dato**
(¿viaja el valor al front?). Son **ejes independientes** — las 4 combinaciones tienen sentido:

| `hidden` | `send` | Infra (input visible) | Dato (valor viaja) | Caso real |
|---|---|---|---|---|
| falsy | true (default) | sí | sí | campo normal |
| **true** | **true** | NO | **sí** | `creationUserModel` (plugin): nunca se muestra, pero el dato viaja → su hermano `creationUser` (refPath) SABE a qué modelo pedir, aunque el modelo nunca se renderice |
| falsy | **false** | sí | **NO** | `password` (User): se manda el INPUT (para escribir uno nuevo) pero NO el valor actual |
| true | false | NO | NO | ni infra ni dato |

🔴 No confundir: ocultar el input (`hidden`) ≠ no mandar el dato (`send:false`). Un refPath/discriminador
suele ir `hidden:true + send:true` (dato necesario para resolver, UI innecesaria).

**`keepOnEmpty`** (complementa `send:false`): si el front NO manda el dato, el back se queda con
`undefined` en vez de `null` → **no borra** el valor existente. Caso `password`: dejar el input vacío
no borra el password guardado (sin esto, vacío→null lo borraría).

> **`required` NO es de la familia contextual**: se mueve a `input.validate.required` y el `required`
> plano se borra. Su condicionalidad va por `requiredForm` o por el filtrado de `hidden` por verbo.

## 3. `forceAttrs` — qué option del type SOBREVIVE al recorte

`forceAttrs` es un array de nombres de atributos que deben llegar al front **aunque** el contexto los
recortaría con `omitAttrs`/`pickAttrs`. Mecánica: el pipeline (1) captura esos atributos ANTES de
filtrar, (2) aplica omit/pick, (3) los **re-inyecta DESPUÉS** (de ahí "force"). El array `forceAttrs`
mismo no viaja. Se acumula: `toInputBase` agrega `noExtraInfo`/`detail` si hay ref; `Array.toInputNative`
agrega `subInput`/`multiple`/`stacked`/`allowDuplication` + propaga los del embedded.

Ejemplos: `Date.forceAttrs:["dateType"]`, `Number/Percentage:["scale","precision"]`,
`Url:["baseURL","protocols"]`, `Code:["language","minLines"]`, `Object:["language","lockLines"]`,
`Model:["options","modelFilter"]`. Sin `forceAttrs`, esos atributos de config del type se perderían en
el recorte y el componente del front no sabría renderizarse.

## 4. El cruce type-option → plugin consumidor (la realidad de para-qué)

| Option del type | La consume | Para qué |
|---|---|---|
| `toInputBase`/`toInputNative` | **toInput** (`mongoosePlugins/toInput.js`) | armar el input del front |
| `forceAttrs` | toInput | forzar atributos de config al front |
| `toFilter` | **toFilter** (`mongoosePlugins/toFilter.js`) | el static maneja ref/array/between/$text y al final **delega a `options.toFilter(val,obj,path,Model)`** del type |
| `toPDF` | **plugin PDF** (`FWPlugins/PDF/`) — `toPDF.call(this,path,style,val)` | exportar a PDF. 🔴 el `toPDF` por type vive en el FWPlugin PDF, NO en z99base (ahí está comentado) — cargar PDF.js habilita el cruce |
| `toXLS` | **download** (`mongoosePlugins/download.js`) — `toXLS.call(doc,path,input)` | exportar a XLSX (corre con `pure:false` para ejecutar la función server-side) |
| `ref`/`refPath`/`myRef`, `onlyRef`, `noOptions` | toInput / toFilter / download / PDF | resolver el valor de referencia (populate, `.name`) |
| `hidden`, `filterType`/`filterComponent`/`filterDefault`, `tableComponent`, `pos`/`tablePos` | **FrontEnd** (`formGeneric`/`tableFields`/pickers) | el "sobreuso" que ENSAMBLA lo que los otros le traspasan + filtra por verbo |

**Regla de oro para documentar/crear un type**: cada option que pongas en un type **tiene un plugin que
la lee**. Si agregas `toPDF` a un type, lo consume el plugin PDF; si agregas `toFilter`, el static
toFilter; si agregas `forceAttrs`, el toInput lo fuerza al front. Definir una option sin consumidor no
hace nada. Para rastrear el comportamiento real de un type, mira los DOS lados: el type que define +
el plugin `toXXX` que usa.

## 5. 🔴 RESTRICTIVO vs LAXO por contexto — DE DÓNDE un componente lee su config

El recorte del paso §1.6 (`omitAttrs`/`pickAttrs`) NO es uniforme: depende del ENDPOINT que arma el
input (`FrontEnd.js`). Dos regímenes opuestos:

| Contexto / endpoint | Régimen | Mecánica | Qué llega |
|---|---|---|---|
| **`tableFields`** (grilla) | **RESTRICTIVO** | `pickAttrs` = **whitelist cerrada** (~26: label, name, tablePos, component, type, key, ref, options, **`attrs`**, fixed…) | SOLO los whitelisted. Lo demás se **recorta** → un atributo de config del type que la grilla necesite hay que **forzarlo con `forceAttrs`** (§3). |
| **`tableForm` / `formCreate` / `formUpdate` / `formProfile` / `formRegister`** (forms) | **LAXO** | `omitAttrs` = **blacklist** (hidden, filterType, filter, filterDefault, send, above, hiddenDetail, readonly según verbo…) | **TODO salvo** la blacklist. Los atributos custom del campo pasan tal cual. |

⟹ **Conclusión operativa (de dónde lee un componente su config declarada en el back):**
- Un componente que opera en **modo input (FORM)** recibe los atributos custom del campo **laxos, en
  `localInput` directo** (props del campo: `localInput.miConfig`). NO están en la blacklist → llegan
  siempre. Es el lugar natural para leer config declarativa (`front-pure-receiver`).
- Para que esa config llegue **también a la grilla** (`tableFields`), hay que declararla en el
  `forceAttrs` del type (sino el pick la recorta).
- 🔴 **NO usar `localInput.attrs` para config del componente**: `attrs` se spreadea al **control interno**
  (n-input, GI:388 `this.attrs = {...localInput.attrs}`). Que `attrs` aparezca en el `pickAttrs` de la
  grilla NO lo habilita como canal de config — es para props del HTML renderizado. Config del componente
  = props del campo en `localInput`, NO en `.attrs`.
  - El uso LEGÍTIMO de `attrs` es justamente atributos HTML del control: `File` acepta
    `attrs: {accept: "image/*", capture: "environment"}` y llegan al `<input type=file>` (abre la cámara
    directo en Chrome Android y en el WebView de Capacitor; probado 2026-09-04 en `MemberCompletionAdult`).
    🔴 Solo pasan los que el control interno DECLARA como prop: el trigger de `ItdFile` tiene `inheritAttrs:
    false` y su root es un `<span>`, así que un atributo no declarado no cae en el input — se agrega la prop
    (`accept`, `capture` hoy; `multiple` NO: el handler toma `files[0]`).

Código: `pickAttrs` en `FrontEnd.js:~236` (tableFields); `omitAttrs` en `~350` (tableForm), `~422`
(formCreate), `~434` (formUpdate).

## 🔴 El sub-schema se pasa como ARGUMENTO, nunca por `req.schema` (2026-09-03, #172)

`toInputs({req, filter, schema})` acepta `schema` explícito, y toda la familia `pick*` de FrontEnd.js lo recibe
como último parámetro opcional: `pickGeneric(filter, req, schema)`, `pickInput(type, req, schema)`,
`pickCreate/Update/Register/Profile/View/Detail(req, schema)`, `pickData(ctx, req, schema)`. Sin `schema` se usa
`this.schema` (el modelo). Así lo usan `setData` anidado (sub-schema del docArray) y `Profile.allFuncs` (`Func`).

Por qué: `req.isAuth`, `req.model`, `getUser` son getters **no enumerables** (`server.js:1402`); mutar `req.schema`
hace carrera en la recursión paralela de docArrays, y copiarlo con `{...req}` pierde los getters → dentro del picker
todo `hidden`/`readonly`/`disabled` FUNCIÓN ve un anónimo y el campo se DESCARTA al grabar, sin error. `req` es
identidad + contexto: se pasa tal cual; el schema va aparte.
