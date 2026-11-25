---
name: itdfw-ddd-value-objects
description: Use when an ITDFW custom type's value has behavior of its own (formatting by locale, arithmetic, derived getters, structure, or depends on another value of the document) — the value becomes a domain class (Value Object) shared by the SchemaType (cast/validate/persistence) and the front. Covers the class, its essence validation, and how back and front use the same class.
---

# ITDFW DDD — Domain Objects (types con clase)

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [externalities-gi.md](references/externalities-gi.md) | El regreso `initVal`/`onChange`, el VO pure-externality (por qué no emite), el wrapper de externalidades con su regla de fuentes planas, y la máxima del componente pelado | enchufas un VO al GI, el VO tiene locale/moneda/mask, o su componente está creciendo |
| [validation-detail.md](references/validation-detail.md) | `validateSelf` como adaptador, el patrón snapshot y por qué, `{VALUE}` en mensajes, la cadena `required` doble punta y la serialización de `validators.js` | escribes `validate()`/`isEmpty`/`checkRequired` o un validador del front |
| [why-and-history.md](references/why-and-history.md) | Por qué murió la inmutabilidad dura y por qué `setValue` no valida, el pecado original del constructor, por qué no hay clase base, por qué existe el VO compuesto, la lección de las tasas | quieres el porqué de una regla, o vas a discutirla |

Un type custom cuyo valor tiene lógica = una **clase de dominio** transversal back↔front: la MISMA clase la usa el
SchemaType (cast/validate/persistencia) y el front (hooks GI/formato/validación). El objetivo: **el dato es dueño de su
comportamiento** — `doc.campo.metodo()`, nunca statics al modelo. Piloto del core: **Rut** (la base simple); el
completo: **Currency**.

## 🔴 Los 3 anillos — qué necesita una clase para VIVIR

| Anillo | Qué es | Ejemplo Currency | Ejemplo Rut |
|---|---|---|---|
| **1. DOMINIO** (sin esto no ES) | el valor + su identidad + lo derivado | monto + moneda (identidad, vive UNA vez en el doc) → precisión | el rut mismo |
| **2. PRESENTACIÓN** (sin esto no se MUESTRA, pero ES igual) | lo del OBSERVADOR, jamás del dato | locale (user-scope) + mask (config) | formato puntos/guión (fijo, sin externalidad) |
| **3. VIDA** (sin esto no SOBREVIVE al tiempo) | enterarse de cambios de su identidad externa | pub/sub `newCurrency` del root (ownerDocument) | — (identidad propia) |

🔴 **El contrato es el TECHO, no el piso**: Rut no necesita challa (sin externalidades ni pub/sub: `setValue` que
normaliza+guarda+ensucia y listo); Currency necesita los 3 anillos. La challa se gana por necesidad.

## 🔴 Nulish = FCC de la clase — LA INSTANCIA SIEMPRE SE CREA

null/undefined NO niegan la clase (el `v == null → return null` del caster murió). Nulish → instancia en **STANDBY**:
`#value = null`, no valida, `toJSON()`/`toBSON()` → null, con su infra lista. El front igual: `initVal` soporta
undefined. ⟹ **UNA instancia viva por campo desde el nacimiento**, y el valor se **transfiere** (`setValue`) en vez de
recrearse por cast.

## 🔴 `setValue` — normaliza + asigna + ensucia (TRÁNSITO, no punta)

- **NUNCA valida ni lanza.** La asignación va antes de la validación por construcción del pipeline; el estado intermedio
  inconsistente es legítimo. Quien cae es `validate()` (la llaman VS y mongoose) y, si se decide, `toBSON`/`toJSON`
  como gate de salida.
- **Auto-dirty**: el caster pasa el **`this` del SchemaType** como argumento final del constructor → la clase conoce su
  **path** → `setValue` hace `#doc.markModified(#path)`. El schemaType es COMPARTIDO por path: de él solo se toma
  path/options; el doc es el `#doc` propio.
- **Contrato back**: `setValue` NO se usa en mongoose (el idioma es `doc.campo = v`, y la aritmética recastea vía
  `Symbol.toPrimitive`). Existe para el front y casos límite.

| Mutación | Regla |
|---|---|
| `#value` | se transfiere SOLO por `setValue` (disciplina, no dogma) |
| `setCurrency`/`setPrecision` (Currency) | re-cierran el valor; acotado al front (en el back la identidad es fija al cast) |
| `setLocale`/`setMask` | presentación PURA: el valor es el mismo con cualquier locale |

El porqué: [references/why-and-history.md](references/why-and-history.md).

## 🔴 Las puntas OBLIGATORIAS frente al GI — `initVal` y `onChange`

Todo VO enchufado al GI (`$VO`) tiene **`initVal`** (externo → display) y **`onChange(cb)`** (el REGRESO: el VO cambió
por una externalidad → notifica con el valor YA initVal'eado → el GI lo asigna al VSV). El GI las llama PELADAS:
ausencia = revienta al boot. Sin reactividad externa → `onChange` NOOP (`return this`): la firma existe aunque nunca se
dispare.

🔴 **VO PURE-EXTERNALITY** (en modo external NO tiene valor propio: es 100 % derivado de sus externalidades): **NO emite
`onChange` por externalidades** — la propagación la hace el computed EV, y emitir dentro del goteo es
escritura-dentro-de-lectura. `initVal` retorna SIEMPRE la derivación; el primer descenso no-vacío se guarda
(`#initial ??=`); `onChange` queda para cambios INTERNOS que el pipeline no ve.

Detalle: [references/externalities-gi.md](references/externalities-gi.md); del lado del front, skill
`itdfw-front-develop` → `vo-gi-contract.md` §El REGRESO.

## 🔴 Validación: ESENCIA vs DEFINICIÓN

| Regla | Dónde va |
|---|---|
| la **ESENCIA** (lo que la hace SER: Number "no me llegó chanchito", Currency "monto monetario coherente", Rut módulo 11). Test: *¿es verdadera para CUALQUIER campo de este tipo en cualquier schema?* | la clase (`validate()`) |
| las **DEFINICIONES** del campo (min/max/required/unique) | mongoose nativo, validators del form, capa de contexto |
| lo **extrínseco** (remotas tipo `checkStrength`, cruzadas entre campos) | su capa, no la clase |

- **Transversal**: el custom type detecta `validate` en la clase y **lo enchufa al SchemaType** → la misma función valida
  en mongoose Y en el front. `_validate` (el túnel viejo back→front) muere para los DDD. En el front `validateSelf` pasa a
  ADAPTADOR (`setValue` → si cae, emite el error).
- 🔴 **Solo DATOS**: `validate()` **nunca rechaza indefiniciones** (vacío y tránsito pasan). `required` lo da el MOTOR
  gratis a todo type con `class`: `checkRequired = v != null && !v.isEmpty`. `isEmpty` = "NADA de nada" (datos
  colgando no son vacío: los juzga `validate` como coherencia).
- 🔴 **SNAPSHOT**: primera línea `const value = this.#value` y TODO el cuerpo valida el snapshot (un validate async que
  relee `#value` tras un `await` valida otro valor). Canon: `Rut.validate()`.
- 🔴 **`{VALUE}`** en mensajes de esencia SOLO si el VSV es ESCALAR (Rut/Currency); en valor-objeto (Address) sale
  "[object Object]".
- 🔴 **`required` es DOBLE PUNTA espejada**: back `checkRequired` del SchemaType; front las variantes `required` de
  `validators.js`. Ambas: `vo.checkRequired(...args)` si existe → `!vo.isEmpty` → chequeo estándar. Los validadores de
  `validators.js` se SERIALIZAN al front → cero closures o helpers de módulo, todo INLINE.

Detalle: [references/validation-detail.md](references/validation-detail.md).

## 🔴 VO COMPUESTO — un valor que CONTIENE montos compone VOs hijos (canon: `FeeFullClass`)

- **GÉNESIS**: el compuesto arma su estructura en el constructor — cada campo monetario nace `new Currency(null)`. Los
  valores se CONDUCEN por `setValue` del hijo con un conductor único `assign(field, v)` (público: mongoose no soporta
  privates).
- **ARITMÉTICA**: cada paso CIERRA a la precisión de su moneda ANTES del siguiente (lee por `+this.x` = toPrimitive
  cerrado, escribe por conductor). Back y front idénticos por construcción; mongoose queda SOLO como persistencia.
- **CASCADA**: `setCurrency` del padre dispersa a todos los hijos y sella `_currency` own-prop (viaja por fila; el
  docArray no la persiste si no está declarada).
- **El sello de los casters**: `v instanceof VO → pasa colá`, así las MISMAS instancias fluyen clase→mongoose→componente.
- **QUÉ CIERRA**: solo la PLATA (Currency). Las TASAS (Percentage) NO llevan VO ni caster: **raw PURO, jamás se
  redondean**; su `precision` es solo de display.
- **TRANSPORTE**: se serializa SOLO (`toJSON()`: hijos raw ya cerrados + contexto plano). 🔴 Las instancias JAMÁS entran
  al estado reactivo del front: el Proxy de Vue no declara los `#privates` → throw. Raw + externalidades por su vía.

Por qué existe el VO compuesto y la lección de las tasas: [references/why-and-history.md](references/why-and-history.md).

## 🔴 Externalidades: JAMÁS en la clase ni en el doc — WRAPPER en el componente

Los hooks GI de la clase sirven lo que existe REALMENTE en ambos mundos: `_currency` sí (campo real del doc); `locale` y
`mask` JAMÁS (son del USUARIO: back `$locals.locale`/`req.locale`, front el store de Config). Nunca se parcha una clase
ni un pseudoDoc: en el `created()` del componente, `this.VO = class extends Currency { constructor(...a) { super(...a);
this.setLocale(vm.staticLocale); } }`. 🔴 El wrapper lee fuentes **PLANAS** (`vm.staticLocale`, snapshot por watcher),
NUNCA el getter reactivo.

**La máxima — componente PELADO**: un VO que necesita PARCHAR su componente está malo. Sin externalidades el componente
queda VACÍO (`$options.VO = Rut` y nada más; el GI usa los hooks que el VO soporta y cae al flujo clásico en los demás).
Con externalidades, el componente justifica SOLO el cableado (watchers → setters al singleton); el resto es olor a
parche. Detalle y el ejemplo completo: [references/externalities-gi.md](references/externalities-gi.md).

## 🔴 Construcción: constructor-VALOR / setters-AMBIENTE / `static cast` opcional

1. **`constructor(value)`** — SOLO registra valor. Puro, testeable sin mocks, cero ambiente.
2. **SETTERS ambientales** (`setDoc`/`setLocale`/`setSchemaType`/`setCurrency`…) — el ambiente entra POR GOTEO cuando
   llega, idempotentes, en cualquier orden.
3. **`static cast(...)`** (OPCIONAL) — el ADAPTER por consumidor: recibe la firma que sea (la del caster mongoose
   `(value, doc, init, prev)` + options + schemaType; la del GI), crea la instancia y la arma vía setters. Simple (Rut)
   no lo necesita; complejo (Currency) sí.

- 🔴 **Construcción TOTAL**: cualquier input produce instancia y los setters no lanzan. Los throws viven SOLO en las
  puntas de SALIDA que lo necesiten: `validate` cae al validar (mongoose la llama pre-save), `format` cae sin locale
  (PLR), `toBSON` warnea el chueco.
- 🔴 **`setOptions(options)` = LA punta estándar para la config del campo**: la infra la llama sola en ambos mundos (back:
  caster genérico post-new; front: GI en created Y en cada `inputUpdate`), siempre con `?.`. El constructor PUEDE recibir
  los args completos del caster para config back-only; si la config se necesita en AMBOS mundos, va por `setOptions`.
  La clase lee lo que su contrato define e ignora el resto; sin props "por fuera" en el front.
- `schemaType`: el path para el auto-dirty de `setValue`. `prev` → `dispose()` (limpieza de listeners). Pub/sub:
  escuchar al **ROOT** (`ownerDocument()`).

## 🔴 SIN clase base — el contrato se VERIFICA, no se hereda

No hay `DomainObject` base: los `#private` no se heredan, y exponerlos con getter/setter los deja sin protección. El
contrato es de COMPORTAMIENTO y lo verifica un **módulo TDD de CONFORMANCE**: le pasas tu clase y dice qué cumple y qué
falta (¿instancia con nulish sin caerse? ¿`setValue` sin throw y con dirty? ¿`toJSON`/`toBSON` vacío → null? ¿`validate`
cae con basura? ¿`toPrimitive`? ¿`initVal` y `onChange`?). "¿Pasa el conformance?" es la puerta de salida objetiva
(`itdfw-completeness`).

## Reglas de salida y presentación

- **Export**: `toXLS()`/`toPDF()` en la clase — la data sabe presentarse (canon Rut).
- **`toJSON()` = transporte** (canónico limpio al front) / **`toBSON()` = persistencia**; vacío → null.
- **PLR segmentado**: el locale solo lo usan los formatters → PLR AHÍ, no en el constructor.
- **Labels locale-aware para selects = SINGULAR** (forma de cita; no existe plural genérico sin conteo):
  `Intl...formatToParts({[unit]: 1})` filtrando `type !== "integer"`, NUNCA regex sobre el dígito. `options`/label =
  independiente del conteo; `format`/valor = flexiona por conteo.

## Anti-patrones

| ❌ | ✅ |
|---|---|
| Parchar la clase/pseudoDoc con externalidades (doc.locale) | wrapper en el componente |
| Statics al modelo `doc.method(campo)` | `doc.campo.metodo()` |
| Negar la clase con nulish (`v == null → null`) | instancia SIEMPRE, standby |
| Validar definiciones (min/max) en la clase | solo ESENCIA; definiciones al campo |
| `_validate` para túnel back→front | `validate` en la clase, enchufado transversal |
| Revertir el display para recuperar el valor | el SSoT es VSR |
| Default silencioso de locale | PLR en dominio explícito; el hook degrada; el wrapper inyecta |
| **Clase de adorno**: cast gordo que valida todo + clase vacía | la lógica EN la clase; cast/type delgado |
| Copiar un VO viejo como plantilla (TimeFrame) | partir del contrato de este skill (piloto Rut) |
