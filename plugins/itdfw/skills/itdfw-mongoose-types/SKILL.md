---
name: itdfw-mongoose-types
description: Use when working with ITDFW Mongoose custom types (z99base.js, TimeFrame.js, Color.js, etc.), configuring type defaults via Schema.Types.X.set(), understanding the toInput pipeline (toInputBase → toInputNative → toInput), forceAttrs, validators on types, or creating new custom Mongoose types for the framework.
---

# ITDFW Mongoose Types System

## Overview

ITDFW extends Mongoose types with custom types and a configuration layer via `Schema.Types.X.set()`. Each type defines casting, component, filtering, export, and validation defaults.

## 🔴 ¿Cuándo se justifica un custom type? (antes de crear uno)

Un custom type NO es la respuesta por defecto — es la respuesta para UN caso específico. Antes de crear uno, descartá los otros dos caminos:

| Lo que necesitás | La respuesta NO es un custom type | Es esto |
|---|---|---|
| Un componente homologado pa un campo (ej. que se vea como Currency) | ❌ no crees un type nuevo | declará `component: "X"` directo en el field del schema |
| Estructura anidada/repetida (varios sub-campos, arreglo de objetos) | ❌ no crees un type nuevo | es un **embedded doc** o **docArray** |
| Cast/validate propio Y/O **atributos de configuración custom** que el componente del front necesita pa renderizarse o comportarse | ✅ ACÁ SÍ | custom type |

⟹ **Un custom type que no necesita NINGUNA configuración propia** o es puro layout (componente homologado, caso 1 de la tabla) o es complejidad estructural (caso 2). Si estás creando un type de verdad, **lo más probable es que sea justamente porque necesitás atributos custom** — no es un detalle secundario del "Creating a New Type" de abajo, es **la razón habitual de existir** de la mayoría de los types reales del FW: `Date.forceAttrs:["dateType"]`, `Number/Percentage:["scale","precision"]`, `Url:["baseURL","protocols"]`, `Code:["language","minLines"]`, `Model:["options","modelFilter"]`.

**Dado eso, la pregunta que sigue casi siempre es "¿cómo uso ese atributo en el front?"** — dos piezas, en orden:
1. **Que el atributo LLEGUE al front**: declarálo en `forceAttrs` (options del type) — sin esto, el pipeline lo recorta en contextos restrictivos (grilla). Ver [toinput-pipeline.md §3](references/toinput-pipeline.md).
2. **Que el COMPONENTE lo LEA**: en modo input (forms) llega laxo, directo en `localInput.miAtributo` — 🔴 NUNCA en `localInput.attrs` (eso es el spread al control interno HTML, no config). Pa que también llegue a la grilla (`tableFields`, régimen restrictivo) necesitás el `forceAttrs` del punto 1. Detalle completo + de dónde lee cada contexto: [toinput-pipeline.md §5](references/toinput-pipeline.md).

## File Structure

```
back/itdfw/src/SITE/mongooseTypes/
  z99base.js     — Configures ALL built-in types + defines Email, Url, File, etc.
  TimeFrame.js   — Custom: {measure, duration}
  Color.js       — Custom: hex color
  Password.js    — Custom: password
  ...            — z99 prefix loads LAST (custom types first)
```

## Quick Reference

| Need to... | Do this |
|------------|---------|
| Create custom type | Export `{TypeName: {cast(v){}, options: {}}}` |
| Set type default | `db.Schema.Types.X.set("key", value)` |
| Describirlo para máquinas | 🔴 `options: {aiDescription: "..."}` en todo type nuevo: qué valor guarda y cómo se lee (inglés). Es el default de cada campo de ese type, y el campo la pisa con la suya |
| Map type → component | 🔴 type con componente HOMOLOGADO (mismo nombre: Currency→ItdCurrency) NO declara `component` — deriva del type. `options: {component: "X"}` SOLO si la operatoria real es OTRA (ej. Profile.functions docArray → SubsetDoc) |
| Force attrs to front | `forceAttrs: ["myAttr"]` in options or toInputNative |
| Add Mongoose validator | 🔴 función `(value, props)` que LANZA (ver regla abajo); un objeto `{validator, …}` se mergea y termina igual |
| Configure input generation | `.set("toInputNative", async function({schemaType, input}) {})` |
| Override per-field | `toInput: {component: "X"}` in schema definition |
| Saber qué FORMA tiene el valor guardado (para escribir un `default`) | 🔴 `listTypes` **NO la entrega** — da `component`/`measures`/`forceAttrs`, no el shape. Sácala con `mcp query <Modelo>` sobre datos REALES de un modelo que ya use ese type (ej. `Duration` → `LoanScenario.periodicity` = `{months: 1}`). ⚠️ Solo funciona si ese type YA tiene consumidor; si es un type sin uso previo, no hay fuente fuera del código |
| Opciones NATIVAS de mongoose que sobreviven al pipe | `trim`, `lowercase`, `uppercase`, `default`, `immutable`, `min`/`max`, `minlength`/`maxlength` funcionan normal sobre los types base (evidencia en el propio catálogo: `String` trae `trim:true`, `Email` trae `lowercase:true`). No hay que reimplementarlas con formatters |

## 🔴 validate — UNA firma, dos mundos (estándar 2026-07-03, props desde back 7.5.3)

El `validate` de un custom type es **SIEMPRE una función `(value, props)` que LANZA**. El back es opinionado: el
loader la registra con `propsParameter: true`, así que mongoose la llama con `this` = el documento (o la Query en
un update con `runValidators`, que también trae `schema`) y `props` = `{path, fullPath, value, …}`. Si el type
declara un objeto `{validator, …}`, se mergea y se le fuerza `propsParameter`: termina en la misma firma. Un
validador externo con argumentos posicionales (validator.js) lo envuelve quien lo trae.

```js
validate(val) {                      // la mayoría no necesita props: las ignora
  if (val && !esValido(val)) throw new Error("{PATH} is not a valid X ({VALUE})");
  return true; // válido (o vacío — FCC: required es del campo)
}

validate(val, {path}) {              // reglas que viven en la declaración del CAMPO (canon: Password)
  if (val == null) return true;
  const {options} = this.schema.path(path);   // minUpper, minStrength… declarados en el campo
  if (options.minSymbols && contarSimbolos(val) < options.minSymbols) throw new Error("{PATH} needs symbols");
  return true;
}
```

Solo el `validate` del **type** tiene esta firma; los `validate`/`min`/`minLength` declarados en el campo siguen
siendo los de mongoose (homologarlos y llevarlos al front es otra etapa).

- **El mensaje es un TEMPLATE con el vocabulario NATIVO de mongoose** (`{PATH}`/`{VALUE}`): mongoose lo
  interpola en el back (path + valor crudo) y el validateSelf lo interpola en el front (label traducible +
  valor formateado). UN mensaje de dominio, DOS interpolaciones contextuales — cero parsing de formatos,
  cero message declarado aparte. Por eso función pelá: "¿quieres validar en ambos lados? función pelá y chao".
- **El loader SIEMPRE enchufa un validate** al SchemaType (dispatcher único): corre el declarado del type
  si existe; si no, la ESENCIA de la clase (`v.validate()` — contrato DDD); si no hay nada, `true`. Se
  ACUMULA con los `validate` del campo (mongoose los guarda en arreglo — verificado).
- Types con `class:` (DDD) normalmente NO declaran validate — la esencia de la clase valida sola
  (skill `itdfw-ddd-value-objects`). Declararlo es para reglas EXTRA del type.
- Canon: Rut (clase) · Email/Url/Cuit (types con validate función pelá, homologados 2026-07-03).

## toInput Pipeline

Three stages, merged in order — later overrides earlier:

```
toInputBase (universal, ALL types) → toInputNative (per-type) → toInput (per-field)
```

Details + forceAttrs: [toinput-pipeline.md](references/toinput-pipeline.md)

🔴 **Restrictivo vs Laxo (de dónde un componente lee su config)**: la grilla (`tableFields`) es
RESTRICTIVA (`pickAttrs` whitelist → config del type necesita `forceAttrs`); los forms
(`formCreate`/`formUpdate`/`tableForm`) son LAXOS (`omitAttrs` blacklist → pasa todo salvo lo restringido).
⟹ un componente en modo input lee sus atributos custom en `localInput` directo (NO `localInput.attrs`,
que es del control interno). Detalle: toinput-pipeline.md §5.

🔴 **Un type se sobrecarga PARA los plugins `toXXX` que lo consumen** (`toFilter`→plugin toFilter,
`toPDF`→plugin PDF, `toXLS`→download, `forceAttrs`/`toInputNative`→toInput). Una option sin consumidor
no hace nada; para entender un type, mira el type que define Y el plugin que usa. Cruce completo +
matriz en [toinput-pipeline.md](references/toinput-pipeline.md).

🔴 **Atributos contextuales** (`hidden`/`readonly`/`disabled`/`options`) aceptan
`boolean | string | array<string> | función`. La función (lista `attrAsFunction`) se ejecuta
**server-side** en el toInput con `{path, req, schemaType, input, schema}` (recibe `req`, NO el doc) y
se reemplaza por su valor; `disabled`/`readonly` además se colapsan a boolean según el verbo
(create/update). Al front NUNCA viaja una función (`pure:true`). Detalle en toinput-pipeline.md §2.

🔴 **VIRTUALES no viajan a los forms por DEFAULT** — opt-in explícito con `hidden: false` en la
declaración del virtual (jcmunoz 2026-07-14).

🔴 **`hidden` ⊥ `send` (ortogonal)**: `hidden`=infra (¿se renderiza el input?), `send`=dato (¿viaja el
valor?). `hidden:true+send:true` = oculto pero el dato viaja (ej. `creationUserModel` para que el
refPath resuelva); `send:false` = manda el input pero no el valor (ej. `password`), con `keepOnEmpty`
para no borrar al venir vacío. Detalle/matriz en toinput-pipeline.md §2.

## Common Patterns

| Schema has... | toInputBase does |
|---------------|-----------------|
| `ref`/`refPath` | component = `"ItdSelect"` |
| `enum`/`options` | component = `"ItdSelect"` |
| Array + enum | `"ItdSelect"` + multiple |
| Array, no enum | `"ArrayAdd"` |
| DocumentArray | `"Embedded"` with recursive toInputs |

## 🔴 Prefijo `Itd` — distinguir DECLARACIÓN vs NAME

Hay dos lugares donde aparece el string del componente. Las reglas son distintas:

**1. DECLARACIÓN en el back** (`component:"X"` en schemas / type defaults / `.set("component", ...)`):
- ✅ Nombre NO colisiona con HTML built-in → puede ir sin prefijo: `"Embedded"`, `"ArrayAdd"`, `"Range"`, `"Currency"`, `"Boolean"`.
- 🔴 Nombre colisiona con HTML built-in → **OBLIGATORIO** prefijo `Itd`: `"Code"` → `"ItdCode"`, `"Select"` → `"ItdSelect"`, `"Form"` → `"ItdForm"`.
- Acepta PascalCase (`"ItdCode"`) o kebab-case (`"itd-code"`) — el FW resuelve ambas.

**2. NAME del componente Vue** (`name:"X"` dentro del `export default` del archivo `.jsx`):
- 🔴 **SIEMPRE con prefijo `Itd`**, sin excepción: `name:"ItdEmbedded"`, `name:"ItdForm"`, `name:"ItdCode"`, etc.
- Razón: el `name` es identificador interno Vue (Vue DevTools, registros). Mantenerlo siempre prefijado evita ambigüedad + futuras colisiones si algún día el name se usa como tag.

**Caso real 2026-05-18**: `Config Banco` quedaba con ItdCode pegado al cambiar a sub-form porque `z99base` declaraba `Object.set("component", "Code")` y el endpoint `Config.getDefinition` retornaba `component:"form"`. Vue lowercaseaba a `<code>`/`<form>` HTML built-in → reconciliation rota. Fix: migrar Code/Select/Form → `Itd*` en el back. Embedded/ArrayAdd/Range/Currency etc. NO necesitan prefijo en la declaración (no colisionan), pero el archivo front se llama `ItdEmbedded.jsx` y declara `name:"ItdEmbedded"` siempre.

**Lista de HTML built-in tags a evitar como `component` declarado**: `code, select, form, input, button, textarea, table, tr, td, th, details, summary, dialog, menu, output, progress, meter, datalist, optgroup, option, fieldset, legend, label, a, p, span, div, ul, ol, li, img, video, audio, canvas, svg`. Si dudas, prefija con `Itd`.

## Creating a New Type

🔴 Antes de seguir estos pasos, confirmá que de verdad necesitás un type — ver
[¿Cuándo se justifica un custom type?](#-cuándo-se-justifica-un-custom-type-antes-de-crear-uno) arriba.

1. Create `mongooseTypes/MyType.js`
2. Export `{MyType: {cast(...args){}, options: {component, forceAttrs, validate, ...}}}` — si el type
   tiene atributos de configuración que el front necesita (lo más común), van en `forceAttrs`
3. Create front component (`ItdMyType.jsx`) — lee los atributos custom en `localInput.miAtributo`
   (NUNCA `localInput.attrs`)
4. If needed: `addValidator("mytype", ...)` + `addCast("mytype", "parentType")`

Full structure + validators: [type-definition.md](references/type-definition.md). Cómo el atributo
llega al front (forceAttrs, restrictivo vs laxo): [toinput-pipeline.md](references/toinput-pipeline.md).

## 🔴 ¿El valor del type tiene LÓGICA propia? → es un Value Object (DDD)

Si el valor no es un escalar pelado sino un dato CON COMPORTAMIENTO — formato (sobre todo si cuelga del
locale), aritmética, getters derivados, estructura compleja, o depende de otro valor del doc — entonces el
**campo ES una instancia de una clase VO** y el `cast` solo la envuelve (`new VO(...)`). El FW es
**headless** y corre por interacción: `cast` / `toBSON` (persistencia) / `toJSON` (transporte) son los tres
pilares — el back manda; el front que usa la misma clase es aprovechamiento transversal opcional.

Esto NO es un skill aparte: un VO **no existe sin un type** (es la forma del valor de un campo). Es la
**rama experta** de acá. Entrás cuando "creá un custom type que haga X" implica lógica sobre el valor.
Detalle completo (constructor→parse, niveles N1–N3 con templates probados, pub/sub para valores que
dependen del root, intrínseco-vs-runtime, atomicidad del API, anti-patrones, checklist):
**[value-objects-ddd.md](references/value-objects-ddd.md)**.

## References

| Reference | Read when |
|-----------|-----------|
| [type-definition.md](references/type-definition.md) | Creating types, z99base exports, set() API, validators |
| [toinput-pipeline.md](references/toinput-pipeline.md) | toInputBase/Native/toInput flow, forceAttrs, merge order |
| [value-objects-ddd.md](references/value-objects-ddd.md) | 🔴 El valor del type tiene lógica/formato/estructura → Value Object (DDD): constructor→parse, niveles N1–N3 + templates, cast genérico, pub/sub root, atomicidad API, headless-first |

## 🔴 Antes de dar por terminado → `itdfw-completeness`

Creaste/tocaste un type o VO → NO lo des por hecho sin la puerta de salida: `cast`/`parse`/`toBSON`/`toJSON`
**green + red**, **memleak** si cableaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario),
completitud (¿qué más toqué?), logs con niveles, validación externa. Es un **servicio**, no un browser → cero
memleaks. Detalle: skill **`itdfw-completeness`**.
