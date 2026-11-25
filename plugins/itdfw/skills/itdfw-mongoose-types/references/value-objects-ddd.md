# Expert: Value Objects (DDD) — cuando el valor del type tiene comportamiento

> Rama experta del custom type. **Un VO no existe suelto**: es la forma del *valor de un campo*, y un
> campo es un type → el VO es una **profundización del type**, no una entidad aparte. Llegás acá desde
> "creá un custom type que haga X" cuando ese valor tiene lógica/formato/estructura propia.
>
> 🔴 **Dos documentos, dos scopes — no se pisan**: el **CONTRATO** del VO como objeto de dominio
> (construcción total, setters ambientales por goteo, `static cast`, validate de esencia, los 3 anillos)
> vive en el skill **`itdfw-ddd-value-objects`**. **ACÁ** va lo que es del **TYPE**: el mínimo que el
> motor exige, dónde vive la clase, la cadena del cast, intrínseco vs runtime, `options.API`, y los
> niveles N1/N2/N3 con sus templates probados.

## 🔴 Headless-first: el VO es del BACK

El FW es **headless** y corre por **interacción** (transición entre capas). Por eso los tres pilares del
VO son `cast` / `toBSON` / `toJSON`:

| Pieza | Capa | Dirección |
|---|---|---|
| `cast(...args)` | entrada (mongoose castea el valor que llega) | externo/interno → VO |
| `toBSON()` | persistencia (MongoDB) | VO → **interno** |
| `toJSON()` | transporte (`res.json`/`JSON.stringify`) | VO → **externo** |

`toBSON` y `toJSON` son **igual de válidos** — uno interno, otro externo; juntos son la transición entre
capas.

🔴 **`toBSON` también decide el DIRTY.** Un VO es opaco para el deepEqual de mongoose, así que el caster del
FW marca `modified` por su cuenta — pero SOLO si `toBSON()` del valor casteado difiere del de `prev` (el 4°
arg del caster). Re-setear el mismo valor (lo que hace `setData` en cada PUT) **no ensucia**. Comparación
con `_.isEqualWith` + customizer por `_bsontype`, nunca `JSON.stringify` (orden de keys). Detalle: la doc de arquitectura «custom-type-dirty». El front (mismo VO vía `parse`/`serialize`) es **aprovechamiento transversal opcional**, NO la
razón de ser: el VO se usa puro headless y ahí el back manda.

## 🔴 ¿Dónde vive la clase? — el cruce (CONDICIONAL) con FWP y front

La clase VO es JS puro, pero **dónde vive** depende de tres ejes **independientes** que se combinan. No es
"siempre FWP+front" — referenciás cada pata SOLO si su condición se cumple:

| Eje | Si NO | Si SÍ |
|---|---|---|
| **(a) ¿es VO?** | (no estás acá) | la clase existe; `cast/toBSON/toJSON` |
| **(b) ¿componente custom para el type?** | render con uno existente (String, Number…) — **nada de front** | el componente vive en el FWP **por framework** (`vue2`/`vue3`/…) → **`itdfw-front-develop`** (cómo se construye) |
| **(c) ¿transversalidad back↔front?** | la clase vive **junto al type** (back), headless puro — **nada de FWP** | la clase DEBE vivir en **`<FWP>/lib/<VO>.js`** → **`itdfw-fwplugin`** |

🔴 **Por qué la transversalidad ES el FWP** (no el front): back y front están **físicamente en lugares
distintos** (carpetas/procesos separados). El **único punto de código real que los conecta es el FWP** —
es donde la clase vive UNA vez y la importan los dos lados (el back en el `cast` del type, el front en el
componente). **Sin FWP no hay clase compartida → no hay transversalidad.** El front es *consumidor*; el
FWP es el *origen*.

⟹ **Referenciás FWP + front juntos solo cuando se juntan (a) Y (b) Y (c)**: VO **+** componente custom
**+** transversal (p. ej. Currency/Address). Un VO headless-only que se renderiza con un input String no
toca ninguna de las dos patas — vive junto a su type y listo.

## 🔴 VO pure-externality — SIN onChange

Si el VO en modo external **no tiene valor propio** (su valor es 100% DERIVADO de externalidades — canon:
Credit del plugin financial), en el front **NO emite `onChange` por externalidades**: la propagación la
hace el computed `externalValue` del GI solo (la externalidad que gotea re-evalúa el EV y el `initVal`
retorna la derivación fresca — un ciclo, cero eventos; emitir dentro del goteo = escritura-dentro-de-
lectura). `initVal` = derivación pura (retorna SIEMPRE la derivación; el primer descenso no-vacío se
guarda pal caso update/validación futura). `onChange` queda solo pa cambios INTERNOS que el pipeline no
ve. Detalle: skill `itdfw-ddd-value-objects` + `itdfw-front-develop` → vo-gi-contract.md §VO
PURE-EXTERNALITY.

## 🔴 VO COMPUESTO + la frontera con el front

Un VO que CONTIENE valores monetarios compone VOs hijos (`new Currency` por campo; conductores
setValue; `setCurrency` cascadea; aritmética que cierra por moneda PASO A PASO — jamás "raw + la capa
redondea": eso es definirse por condicionantes externos → dispersión → la validación por reconstrucción
se cae por diseño). El sello de idempotencia del cast (`instanceof → colá`) es lo que permite que las
MISMAS instancias fluyan clase→mongoose→componente. 🔴 PERO hacia el FRONT las instancias NO cruzan a
estado reactivo (Proxy de Vue vs `#privates` → throw): la frontera serializa (`toJSON` = transporte,
raw ya cerrado + contexto plano por fila). Canon: FeeFullClass (plugin financial). Detalle:
`itdfw-ddd-value-objects` §VO COMPUESTO + `itdfw-front-develop` → vo-gi-contract.md §VOs vs REACTIVIDAD.

## 🔴 La regla de oro: EL CAMPO ES LA INSTANCIA

`doc.field` ES una instancia de la clase VO → toda la lógica se pide DESDE el campo:

```js
doc.plazo.multiply(12).format(locale)   // Duration viva
doc.monto.toBSON()                      // el VO decide cómo persiste
doc.address.fullAddress                 // getter del VO
```

**Anti-patrón (Currency real)**: enchufar mil statics al MODELO → `doc.currencyXXX(field)`. El modelo
carga lógica que es del DATO. Correcto: `doc.field.method()`. El VO es el dueño.

## ¿Cuándo el valor es un VO? (cualquiera basta)

1. **Lógica compartida back↔front** — la MISMA clase opera headless y, si se quiere, en el front.
2. **El dato tiene comportamiento propio** — `.format` (sobre todo si cuelga del **locale**), aritmética,
   getters derivados. El format es el síntoma más común.
3. **Estructura compleja** donde un VO (con métodos) es mejor que un nested crudo.
4. **El valor depende de OTRO valor del doc** (Currency ← `_currency` del root) → el VO interactúa con el
   entorno vía el cast (N2).

## 🔴 EL MÍNIMO — cuatro cosas, y las verifica el motor al ARRANCAR

> El contrato completo del VO (construcción total, setters ambientales, `static cast`, validate de
> esencia) vive en el skill **`itdfw-ddd-value-objects`**. Acá va el **mínimo operativo** y el **scope**
> de cada punta: qué exige el motor, qué exige el front, y qué es pura oferta.

Según el código: `#loadTypesFromObject` (`mongooseSchema/index.js`) corre
un **SAFE GUARD de boot** sobre `new Clase(null)`. Si algo de esto falta o miente, **el servicio no
levanta** y el error nombra la clase y la punta:

| Punta | Qué exige | Mensaje si falla |
|---|---|---|
| **`constructor(null)`** | NO lanza — nulish = instancia en standby (FCC) | `violates TOTAL construction` |
| **`isEmpty`** | propiedad/getter; con nulish `=== true` | `is missing "isEmpty"` / `has a broken "isEmpty"` |
| **`toBSON()`** | con nulish retorna **nulish** (persistencia) | `is missing "toBSON"` / `has a broken` |
| **`toJSON()`** | con nulish retorna **nulish** (transporte) | `is missing "toJSON"` / `has a broken` |

**Eso es TODO lo obligatorio en el back.** Un VO con esas cuatro cosas ya opera: castea, persiste,
viaja al front y responde el `required` (el motor deriva `checkRequired` de `isEmpty`).

🔴 **El guard prueba SOLO el caso nulish.** Una clase que lanza con *otros* inputs (fuentes rivales,
invariante roto) **pasa el arranque igual** — pero eso NO la hace correcta: el contrato pide construcción
total para cualquier input. El patrón vivo es el de `Address`: `parse` estricto que lanza, **atrapado**
por `setValue`, que guarda el valor como TRÁNSITO en vez de reventar.

### La cadena del cast — quién castea, en orden

`#loadTypesFromObject` intenta en este orden y se queda con el primero que exista:

1. **`def.cast`** del type (el que escribís en `mongooseTypes/<X>.js`).
2. **`static cast`** de la clase — el ADAPTER por consumidor.
3. **`new VO(...args)`** — el constructor ES el cast, y recibe **todos** los args del caster.

🔴 Si estás en (3), el constructor recibe la firma de mongoose. **NO declares cuántos son ni qué
significan**: hoy son cinco (`value, doc, init, priorVal, options` — `lib/schemaType.js` de mongoose, en 9.9.2) y
el 5º es **API privada de mongoose** (`{_skipMarkModified}`, que usa al aplicar un `default`) — **no** son
las options del campo, esas se leen de `this.options`. Tomá por posición solo lo que ocupes.

Después del `new`, el motor llama **`vo.setOptions?.(this.options)`** — la punta estándar para recibir la
config del campo, optional por construcción.

## Todo lo demás es OFERTA — el scope de cada punta

Ninguna de estas es obligatoria en el back. Si existe, el FW la usa; si no, cae al comportamiento nativo.

### Puntas del BACK

| Punta | Cuándo la llama | Si falta |
|---|---|---|
| `validate()` | el type la enchufa al SchemaType (`v?.validate ? v.validate() : true`) → mongoose la corre pre-save, y el front la corre como un validador más | el campo no valida ESENCIA (sigue validando lo del campo: required/min/max) |
| `checkRequired(...)` | la cadena del required, ANTES del `!isEmpty` genérico | cae a `!isEmpty` |
| `setOptions(options)` | el caster, post-`new` | el VO no recibe la config del campo |
| `toFilter` / `toFilterHandlers` | al construir queries | filtro identidad |
| `toXLS` / `toPDF` | las puntas de exportación | proyección por omisión |

### Puntas del FRONT (solo si declarás `$VO` en el componente)

🔴 **Tres son FIRMA: llamadas PELADAS, sin `?.`** — si declarás `$VO`, tu clase las tiene o **revienta al
montar**. Es deliberado: alerta de migración al boot, no silent-error en producción.

| Punta | Llamada | Dónde |
|---|---|---|
| **`onChange(cb)`** | **pelada** — registra el handler del GI. Noop legítimo si no tenés reactividad externa, pero **tiene que existir** | `created` |
| **`initVal(v)`** | **pelada** (tras `if (this.vo)`) — el VO entrega el display; el GI no re-transforma | bajada del valor |
| **`setValue(v, raw)`** | **pelada** (tras `if (this.vo)`) — el canal de escritura | `updateValue` |
| **`forceUpdate()`** | **pelada** (tras `if (self.vo)`) — el display converge por re-emisión del VO | `blur` |
| `formatter(v)` | dentro de `try/catch` con fallback nativo | display |
| `emitter(v)` | dentro de `try/catch` | subida del valor |
| `formatM()` | dentro de `try/catch` → `(t, r) => r(t)` | Mustache |
| `keypress(e, vsv)` | `?.` | teclado |
| `tableViewValue()` | tras `if (this.vo?.tableViewValue)` | grilla/vista |
| `setLocale(l)` · `setLogger(log)` · `dispose()` | `?.` | goteo de ambiente / limpieza |

⟹ Resumen del scope: **el back exige 4**; **el front exige 4 más, pero solo si enchufás `$VO`**; el resto
es capacidad opcional que el FW aprovecha si está.

## Piezas de diseño (no obligatorias, pero es dónde vive la calidad)

- **`static parse`** — dispatcher por firma. 🔴 Devuelve un **DESCRIPTOR plano** (`{re, im}`,
  `{amount, currency}`) y el constructor lo asigna; NO instancia dentro de `parse` (recursión
  constructor↔parse). **Idempotente**: `parse(parse(x))` ≡ `parse(x)`, por VALOR (deepEqual), no por
  identidad. Puede ser estricto y lanzar — **pero el que lo llama atrapa** (ver el mínimo, arriba).
- **Captura del entorno** cuando aplica (N2) — ver §niveles.
- **Aritmética** (si numérico) — `Symbol.toPrimitive` (number/default → crudo; string → repr) y/o
  métodos (`add`/`multiply`). 🔴 Definí el primitivo del VO **vacío** (NaN/`""`/`null`) — no implícito.
- **`.format`** (si visual) — si cuelga del **locale**, el locale es **runtime** → lo pide SOLO `format`
  (PLR si falta, sin default). Ver §intrínseco-vs-runtime.
- **FCC en TODAS las ramas** (`isEmpty`; `empty → null` en la proyección). El `required` lo gobierna el
  campo (mongoose/front) con la ayuda del VO (`isEmpty`/`checkRequired`), NO el VO por su cuenta.

## 🔴 El type del VO — declará `class`, NO escribas el cast

El caso normal (VO autocontenido, N1/N3): el type **declara `class: VO`** y el **caster del FW hace el
wrapper estándar** (`RegExp` passthrough, `null→null` FCC, `instanceof→` idempotente, `new VO(...args)`) —
vos NO escribís el cast:

```js
// mongooseTypes/<VO>.js — el type delgado, puramente declarativo
export default { MyVO: { class: MyVO, options: { component: "ItdMyVO", … } } };
```

El boilerplate del cast (incluido el RegExp de zona-gris) vive **una vez** en el caster
(`#loadTypesFromObject`). Las 3 formas del caster (`cast`/`class`/`extends`) → `type-definition.md`.

**Cuándo SÍ escribís `cast(...args)` manual**: cuando el cast necesita **capturar el entorno** (N2 —
cablear el pub/sub al root, limpiar el listener del `prev`). Ahí `class` no alcanza y declarás `cast`:

```js
cast(...args) {                      // 🔴 firma GENÉRICA nativa — NO posicional (inmune a versionado)
  const [val, doc, , prev] = args;   // mongoose pasa (value, doc, init, prev, options); `this`=SchemaType
  // … cablear pub/sub al root + prev cleanup (ver N2) …
}
```
`cast(...args)` y no `(value, doc, init, prev)`: aunque ya conocemos los args (testeado), **no te
comprometas** con la firma → forward nativo, a prueba de cambios de mongoose. El wrapper del FW ya
forwardea todos los args bindeando `this`.

### ⚠️ RegExp en el cast — ZONA GRIS (estado actual) + 🛣️ roadmap

Hoy el cast **debe** soportar RegExp y NO se puede sacar: el flujo de queries hace
`castForQuery` → (sin handler) `applySetters` → `cast`. Un cast que no castea RegExp **revienta la
query** (p. ej. `Rut`). Tampoco se pone dogmáticamente — es zona gris hasta arreglar el flujo.

🛣️ **Roadmap**: la nueva implementación hará **overload de `castForQuery`** en los custom types (control
completo de la query), o un `toFilter` que convierta los `conditionalHandlers` en cascada. Cuando eso
exista, el filtro NO pasa por `cast` y el `if (v instanceof RegExp)` se retira. Hasta entonces: **se
queda, documentado como deuda**, no como patrón.

## 🔴 Intrínseco (del dato) vs runtime (locale) — NO confundir

La **precisión/escala** de un VO es **intrínseca al dato**, NO del locale: la precisión de una moneda la
fija la **moneda** (ISO 4217: CLP 0, USD 2, JPY 0, BHD 3), no la localización. El **locale solo afecta el
FORMAT** (separadores, símbolo, posición). ⟹ `fractionDigits/round/floor` NO toman locale; solo
`format/long` (PLR si falta). Mezclarlos es error de categoría (el bug clásico de Currency). Lo confirma
Intl: `NumberFormat(cualquierLocale, {style:"currency", currency:"CLP"}).resolvedOptions().maximumFractionDigits === 0`.

## 🔴 Atomicidad: las puntas (API) van EN el type

Si el VO necesita endpoints (resolver/validar/parsear ESE type), van en **`options.API` del type** (como
`Password.checkStrength`), NO en un bloque API separado del FWP (como `Address` hoy, que pierde
atomicidad: mirando el type no sabés que tiene puntas). El type debe leerse autocontenido: `cast` +
`options` + sus `API` juntos.

🔴 **Qué meter dentro de `options.API` (verbos, `isAnonymous`, `defaultMethods`, niveles 1-4, gate por
verbo, ext obligatoria, seguridad) → skill `itdfw-api-system`** (Level 4 — type-attached: el endpoint
existe una vez por type, lo heredan todos los schemas que lo usan). Acá solo la regla: va en el type.

## Niveles (templates probados, en `templates/` — internos al skill)

> Cada uno con test **green** (el patrón pasa) + **red** (anti-patrones fallan). Corré:
> `node skills/itdfw-mongoose-types/templates/<X>.test.js`.

- **N1 — autocontenido** (sin entorno). Dos ejemplos complementarios:
  - **`Complex.js`** — VO numérico SIN dep externa: aritmética (`Symbol.toPrimitive`, `add`/`multiply`),
    `format` propio, `parse` por firma. El molde base. (14 green/red).
  - **`Percentage.js`** — VO numérico CON dep externa (locale): `.format(locale)` cuelga del locale (PLR
    si falta) + `toXLS()` EN el VO (proyección atómica). (9 green/red).
- **N2 — con entorno** (depende de un valor del root, ej. `_currency`). El cast captura el entorno y
  cablea **pub/sub al EE del doc** para reaccionar a cambios del root. (`Money.js`, 8 green/red — mock de
  doc-EE sin mongoose). Claves:
  ```js
  cast(...args) {
    const [val, doc, , prev] = args;
    if (val instanceof RegExp) return val;                           // ⚠️ zona-gris: filtros (castForQuery → cast) — MISMO guard que el wrapper de `class`, va siempre
    if (val == null) return null;                                    // 🔴 nullish ANTES de suscribir (no listener a VO nulo)
    const root = doc.ownerDocument();                                // sube al root (cubre nested a cualquier nivel)
    if (prev?.listener) root.removeListener("newX", prev.listener);  // limpia el listener del VO viejo → sin leak
    const vo = val instanceof VO ? val : new VO(val, root._dep);     // _dep del root, no se repite por hijo
    vo.listener = v => vo.setDep(v);                                 // el listener vive EN el VO
    root.on("newX", vo.listener);
    return vo;
  }
  ```
  - **El lado del ROOT** (lo que dispara el pub/sub): el setter de `_dep` en el root hace
    `this.emit("newX", v)` una vez → todos los VOs reaccionan. (Back: virtual + setter sobre
    `ownerDocument`. Front: `rootBus._dep` reactivo.)
  - **EE del doc** (Mongoose): `on`/`emit`/`removeListener` (NO `off`), `listeners(evt)` (NO
    `listenerCount`). El doc es autocontenido → el GC recolecta doc + listeners juntos; el leak real es
    acumular un listener por re-cast sin limpiar el `prev`.
  - 🔀 **Trade-off — pub/sub vs lazy-read**: la alternativa es que el VO guarde **ref al root y lea el
    valor lazy** (cero listeners → cero memleak). Pero eso **acopla el VO al doc** → rompe la isomorfía
    (el front no tiene el doc mongoose, tiene `rootBus`). Elegimos **pub/sub por la isomorfía**, no
    porque lazy-read falle. Si el VO fuera back-only, lazy-read es más simple. Decidilo por caso.
  - **Test de memleak real**: no basta `listeners().length` (sólo prueba que no se acumulan en el doc
    vivo). Para probar que el VO viejo se **recolecta**: `WeakRef` al VO + `global.gc()` (`--expose-gc`)
    + `deref() === undefined`.
- **N3 — con puntas** (resolve/autocomplete). Parsers de provider como **estáticos del VO**
  (`VO.toOptions(raw, api)` + `VO.parse<Provider>`) + endpoints **en `options.API`** (atomicidad).
  (`Place.js`, 9 green/red). 🔴 Un parser de provider **devuelve `[{text, value}]`** (forma de options
  para selects): `text` = label visible, `value` = el dato serializado (lo que re-parsea el VO).

## Nullish / FCC

null/vacío suele ser válido → el VO lo maneja en TODAS sus ramas (sin throw; `isEmpty` + retorno acorde).
`empty → null` en la proyección.

## Labels locale-aware para selects = SINGULAR (forma de cita)

Cuando el VO alimenta el texto de un select (unidades, enums) → lo proyecta locale-aware, en **SINGULAR**.

🔴 **Por qué singular** (matriz 1/2/5/10/20/100/1000 en 12 locales): **no existe "plural
genérico" sin conteo** — eslavos 3 formas, árabe 5, galés muta la raíz; ningún número ≥2 es "el plural",
CLDR `other` tampoco. La única forma estable count-independent es el singular.
```js
const fmt = new Intl.DurationFormat(locale, {style: "long"});
fmt.formatToParts({[unit]: 1}).filter(p => p.type !== "integer").map(p => p.value).join("").trim(); // "mes"/"month"
```
Asimetría: `options`/label = count-independent (singular); `format`/valor = count-aware (flexiona).

## Anti-patrones

| ❌ | ✅ |
|---|---|
| **Clase de adorno**: cast gordo valida + clase vacía + cast retorna objeto plano | parse en la clase, cast delgado **retorna la clase** |
| **Statics al modelo** `doc.method(field)` | `doc.field.method()` |
| **Default silencioso** de locale/config | PLR si falta, segmentado a quien lo usa |
| **Precisión por locale** (mezclar intrínseco con runtime) | precisión = del dato; locale solo en `format` |
| **`parse` que instancia** (recursión con el constructor) | `parse` devuelve descriptor; el constructor/cast instancian |
| **Constructor que LANZA** con input malo (el guard de boot lo rechaza) | construcción TOTAL: `parse` estricto ATRAPADO → el valor queda en tránsito |
| **API en bloque separado** del FWP | API en `options.API` del type (atomicidad) |
| **Listener por VO sin limpiar** (memleak al re-castear) | `prev` desengancha el listener del VO viejo |
| **Firma de cast posicional fija** | `cast(...args)` nativo |
| Copiar un VO viejo (TimeFrame) | partir de los `templates/` (probados) |

## Checklist de un VO nuevo

**El mínimo (sin esto el servicio NO levanta):**
- [ ] `new Clase(null)` **no lanza** (construcción TOTAL).
- [ ] `isEmpty` → `true` con nulish.
- [ ] `toBSON()` y `toJSON()` → **nulish** con vacío.

**El resto:**
- [ ] `lib/<VO>.js` puro/isomorphic (sin mongoose, sin front).
- [ ] si usás `static parse`: devuelve **descriptor**, idempotente por valor, y **quien lo llama atrapa**
      su throw (patrón Address: el estricto adentro, el tránsito afuera).
- [ ] si enchufás `$VO` en el front: `onChange`, `initVal`, `setValue` y `forceUpdate` **existen**
      (llamadas peladas — sin ellas revienta al montar).
- [ ] getters/aritmética/`format` según nivel; primitivo de vacío definido.
- [ ] precisión/escala intrínseca (sin locale); `format` con locale → PLR.
- [ ] `cast(...args)` genérico → discrimina + `new VO(...)` → retorna la clase. RegExp = deuda documentada.
- [ ] si N2: cast captura `doc`/`prev`, nullish antes de suscribir, pub/sub al root, `prev` limpia el listener; lado-root (setter emite) definido.
- [ ] si N3: parsers estáticos (`[{text,value}]`) + `options.API` (→ `itdfw-api-system`).
- [ ] `toBSON()` + `toJSON()`; `empty → null`.
- [ ] front (opcional) usa la MISMA clase — un solo dominio.
- [ ] test **green + red** (molde: los `templates/*.test.js`).
