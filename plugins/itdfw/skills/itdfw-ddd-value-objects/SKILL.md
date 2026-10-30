---
name: itdfw-ddd-value-objects
description: Use when an ITDFW custom type's value has behavior of its own (formatting by locale, arithmetic, derived getters, structure, or depends on another value of the document) — the value becomes a domain class (Value Object) shared by the SchemaType (cast/validate/persistence) and the front. Covers the class, its essence validation, and how back and front use the same class.
---

# ITDFW DDD — Domain Objects (types con clase)

Un type custom cuyo valor tiene lógica = una **clase de dominio** transversal back↔front: la MISMA clase
la usa el SchemaType (cast/validate/persistencia) y el front (hooks GI/formato/validación). El objetivo:
**el dato es dueño de su comportamiento** — `doc.campo.metodo()`, nunca statics al modelo.

> Contrato definido 2026-07-03 (jcmunoz + análisis conjunto). Reemplaza el canon "VO inmutable" anterior:
> la inmutabilidad dura era dogma custodiando una puerta sin camino (ver §setValue). Piloto del core: **Rut**
> (la base simple); luego Currency (el completo).

## 🔴 Los 3 anillos — qué necesita una clase para VIVIR

| Anillo | Qué es | Ejemplo Currency | Ejemplo Rut |
|---|---|---|---|
| **1. DOMINIO** (sin esto no ES) | el valor + su identidad + lo derivado | monto + moneda (identidad, vive UNA vez en el doc) → precisión | el rut mismo |
| **2. PRESENTACIÓN** (sin esto no se MUESTRA, pero ES igual) | lo del OBSERVADOR, jamás del dato | locale (user-scope) + mask (config) | formato puntos/guión (fijo, sin externalidad) |
| **3. VIDA** (sin esto no SOBREVIVE al tiempo) | enterarse de cambios de su identidad externa | pub/sub `newCurrency` del root (ownerDocument) | — (identidad propia, no necesita) |

🔴 **Completitud ≠ obligación**: este contrato es el TECHO, no el piso. Rut no necesita challa (sin
externalidades, sin pub/sub: `setValue` que valida+guarda+ensucia y listo). Currency necesita los 3 anillos.
La challa se gana por necesidad — anti-sobreingeniería aplicada al propio estándar.

## 🔴 Nulish = FCC de la clase — LA INSTANCIA SIEMPRE SE CREA

null/undefined NO niegan la clase (antes el caster hacía `v == null → return null`: **eso murió**).
Nulish → instancia en **STANDBY**: `#value = null`, no valida, `toJSON()`/`toBSON()` → null — pero la
instancia EXISTE con su infra lista. El front igual: `initVal` soporta undefined.

**Consecuencia estructural — muere el patrón recrear-el-invariante**: el campo SIEMPRE es la clase
(aunque nazca vacía) → **UNA instancia viva por campo desde el nacimiento**, y el valor se **transfiere
directo** (`setValue`) en vez de recrear por cast. No hay paso transitivo del nulish.

## 🔴 `setValue` — valida + guarda + ensucia (y el fin del dogma inmutable)

La inmutabilidad dura del `#value` protegía UNA cosa práctica: mutar in place = mongoose no se entera =
no dirty = no persiste (el hoyo del Rut original). Pero en mongoose **nadie llama `setValue`**: el idioma
es `doc.campo = v` (recast) y la aritmética pasa por `Symbol.toPrimitive` (recast al reasignar) — la
barrera custodiaba una puerta sin camino. Se suelta el dogma con una RED de fábrica:

- **La cochinada del caster**: el caster pasa el **`this` del SchemaType** como argumento final del
  constructor → la clase conoce su **path** → `setValue` se **auto-ensucia**
  (`#doc.markModified(#path)`). La mutación invisible al dirty-tracking es imposible por construcción.
  (Ojo: el schemaType es COMPARTIDO por path del schema — de él solo se toma path/options; el doc de la
  dupla dirty es el `#doc` propio.)
- 🔴 `setValue` es TRÁNSITO, NO punta: normaliza → asigna → ensucia. **NUNCA valida ni lanza.** El flujo lo
  demuestra: VSV → assignVSR → para VALIDAR se necesita el formateado → el formatter necesita el valor YA
  en el VO → la asignación va ANTES de la validación por construcción del pipeline. Un setValue que valida
  invierte el orden del proceso. **El estado intermedio inconsistente es LEGÍTIMO** (la clase es
  transitiva, vive siempre); quien cae es `validate()` (VS/mongoose la llaman) y, por contrato si se
  decide, `toBSON`/`toJSON` como gate de salida.
- **Contrato back**: `setValue` NO se usa en mongoose (existe para el front y casos límite). El skill lo
  explicita; el caso dirty queda documentado, no prohibido.

### Taxonomía de mutabilidad

- `#value`: se transfiere SOLO por `setValue` (disciplina, no dogma).
- `setCurrency`/`setPrecision` (Currency): re-cierran el valor — descanso deliberado, acotado al front
  (en el back la identidad es fija al cast).
- `setLocale`/`setMask`: presentación PURA — el valor es el mismo sin importar el locale. Cero deuda.

## 🔴 El REGRESO — `onChange` e `initVal` son FIRMA del VO (2026-07-12)

Todo VO enchufado al GI (`$VO`) tiene DOS puntas OBLIGATORIAS (el GI las llama PELADAS — ausencia =
revienta al boot, no silent-error): **`initVal`** (externo → display; declarativa, el fallback nativo del
GI es SOLO para componentes sin VO) y **`onChange(cb)`** (el REGRESO: el VO cambió su valor por una
externalidad → notifica con el valor YA initVal'eado → el GI lo asigna al VSV → la cascada natural corre
sola). Sin reactividad externa → `onChange` NOOP (`return this`), jamás se dispara pero la firma existe.
Canales paralelos (símbolos, texts de medidas) = slots aparte del VO, registrados por el componente.
Detalle completo: skill itdfw-front-develop → vo-gi-contract.md §El REGRESO. El módulo de conformance
debe chequear ambas puntas.

🔴 **VO PURE-EXTERNALITY (2026-07-15) — la excepción que refina el regreso**: si el VO en modo external
NO tiene valor propio (su valor es 100% DERIVADO de las externalidades — Credit VO), **NO emite onChange
por externalidades: de la propagación se encarga el computed EV** (la misma externalidad que gotea
re-evalúa el EV y el `initVal` retorna la derivación fresca — un ciclo, cero eventos). Emitir dentro del
goteo = escritura-dentro-de-lectura (el goteo corre DENTRO del EV; la notificación reentra a mitad de
evaluación y la cola del computed la pisa). `initVal` = derivación pura: retorna SIEMPRE la derivación
(cálculo en vivo se presume correcto); el PRIMER descenso no-vacío se guarda (`#initial ??=`) pal caso
update / validación futura contra datos legacy. `onChange` queda reservado a cambios INTERNOS que el
pipeline no ve (cadena cuota→crédito en free). Construcción PURA en el componente: sin precarga de
arrays. Ambas patas (externalidad que cambia EV≠VSR — declarada, sin caso aún — y externalidad que
cambia formateo+initVal) cubiertas por el early-return del valor final. Detalle: vo-gi-contract.md
§VO PURE-EXTERNALITY.

## 🔴 Validación: ESENCIA vs DEFINICIÓN (y el validate transversal)

- **La clase valida su ESENCIA** — lo que la hace SER: Number valida "no me llegó chanchito"; Currency
  (hereda esencia de Number) valida "monto monetario coherente"; Rut valida módulo 11. Test: *¿la regla es
  verdadera para CUALQUIER campo de este tipo en cualquier schema?* → esencia → clase.
- **Las DEFINICIONES EXTERNAS** (min/max/required/unique) son del CAMPO → mongoose nativo (extends),
  validators del form, capa de contexto. El mismo Currency vale 5.000 acá y 5.000.000 allá.
- **Transversal**: el custom type detecta `validate` en la clase y **lo enchufa al SchemaType** → la misma
  función valida en mongoose Y en el front. La pichicata `_validate` (el túnel viejo back→front) MUERE
  para los DDD — y esa presión empuja a que todo sea DDD.
- **El desplazamiento del flujo**: `validateSelf` (front) deja de validar esencia — pasa a ADAPTADOR:
  ¿hay clase instanciada? → `setValue` → si se cae, trapea el error y lo EMITE (dominio → UI, i18n vía
  formatM). Se desplaza lo INTRÍNSECO (sync, puro); lo EXTRÍNSECO queda en su capa (remotas tipo
  checkStrength, cruzadas entre campos, min/max de mongoose).
- 🔴 **Validación EXCLUSIVA para DATOS** (2026-07-06): `validate()` **nunca rechaza indefiniciones** —
  vacío pasa, TRÁNSITO pasa (el pipeline lo resuelve; el emitter-gate impide que persista). Pa eso está
  `required`, que el MOTOR da GRATIS a todo type con `class`: `checkRequired = v != null && !v.isEmpty`
  (delega en el isEmpty del VO) — por eso `isEmpty` = "NADA de nada" (datos colgando ≠ empty; esos los
  juzga validate como COHERENCIA — ej. Address: "datos huérfanos sin coordenadas = malo").
- 🔴 **`validate()` valida el BOLSILLO, no el registro vivo (patrón SNAPSHOT, 2026-07-23)**: el
  singleton VO es MUTABLE por la cadena reactiva del front (scope: campos LAZY — la re-bajada lo pisa
  mid-ciclo) → un validate ASYNC/lento que lea `#value` después de un await valida OTRO valor (cazado
  e2e: N2 prístino validaba "OK" con basura adentro, vía un delay de prueba). Regla: **primera línea
  `const value = this.#value` y TODO el cuerpo valida el snapshot** — inmune a pisadas, aguanta
  validadores foráneos lentos (checkStrength, remotas). Verificado con delay de 500ms inyectado:
  perfecto. Canon: `Rut.validate()`. (Arista aparte, pendiente: 2 ciclos VS solapados → generación.)
- 🔴 **`{VALUE}` en mensajes de esencia SOLO si el VSV es ESCALAR** (Rut/Currency): en VOs de
  valor-objeto (Address) el front interpola contra el VSV plano → "[object Object]". El back interpola
  vía Symbol.toPrimitive (mensaje) y toJSON (serialización del error) — verificado e2e 2026-07-06.
- 🔴 **La cadena required es DOBLE PUNTA espejada** (2026-07-06): back = `checkRequired` del SchemaType
  (motor); front = las variantes `required` de `validators.js`. Ambas: `vo.checkRequired(...args)` si
  existe → `!vo.isEmpty` → chequeo nativo/estándar. TODOS los args del caller se colan (el VO decide si
  los usa; args asimétricos back/front = problema del dev que los necesite). 🔴 los validadores de
  `validators.js` se SERIALIZAN al front (toString + merge por capas) → CERO closures/helpers de módulo
  — todo INLINE en cada variante, aunque se repita.

## 🔴 VO COMPUESTO — génesis monetaria y aritmética por definición (2026-07-17, canon: FeeFullClass)

Un VO cuyo valor CONTIENE valores monetarios/dimensionales NO opera floats: **compone VOs hijos**.
Nació del descuadre del motor de cuotas — "compute RAW + la capa redondea" era **definirse por
condicionantes EXTERNOS** (el back redondeaba de carambola vía setters mongoose; el front NADA →
dispersión acumulada → la validación por reconstrucción estaba condenada por diseño: un peso corrido
con premisa de identidad = premisa invalidada; la tolerance era la alfombra). Las reglas:

- **GÉNESIS**: el compuesto construye su estructura en el constructor — cada campo monetario nace
  `new Currency(null)` (instancia-siempre, standby FCC). Los valores se CONDUCEN por `setValue` del
  hijo (un conductor único: `assign(field, v)` — público: mongoose no soporta privates por definición).
- **ARITMÉTICA MONETARIA**: cada paso del cálculo CIERRA a la precisión de su moneda ANTES de alimentar
  el siguiente (lee por `+this.x` = toPrimitive cerrado, escribe por conductor). Back y front idénticos
  por construcción — misma clase, mismos VOs; mongoose pasa a ser SOLO persistencia.
- **CASCADA (anillo 3 compuesto)**: `setCurrency` del padre dispersa a todos los hijos (re-cierran su
  valor) y sella `_currency` own-prop (viaja por fila; el docArray no la persiste si no está declarada).
- **El sello de los casters lo hace viable**: `v instanceof VO → pasa colá` — las MISMAS instancias
  fluyen clase→mongoose→componente sin reinterpretación. Sin ese sello, el compuesto no existe.
- **QUÉ CIERRA Y QUÉ NO (2026-07-18)**: solo la PLATA cierra por moneda (Currency — los centavos
  fraccionarios no existen en caja). Las TASAS/definiciones (Percentage) NO llevan VO ni caster: **raw
  PURO operacional, jamás se redondean** — su `precision` es perilla de DISPLAY no más (lección TIR: un
  cap de precisión en la tasa genera bloques de error groseros sobre capital gordo; el display a 2
  escondía 0,8333% como 0,83% — la pintura capada, el cálculo intacto).
- **TRANSPORTE**: el compuesto se serializa SOLO (`toJSON()`: hijos como raw YA cerrados + contexto
  plano). 🔴 Las instancias JAMÁS cruzan hacia estado reactivo del front — el Proxy de Vue es
  transparente al `instanceof` pero NO declara los `#privates` → throw. Raw + externalidades por su
  vía = idempotente. Detalle front: itdfw-front-develop → vo-gi-contract.md §VOs vs LA REACTIVIDAD.

## 🔴 LA MÁXIMA: componente PELADO — el VO lo hace TODO (jcmunoz 2026-07-04)

**Un VO que necesita PARCHAR su componente está MALO — o tiene externalidades que no puede controlar
sin ayuda. Corta y fome.** El norte del contrato:

- **Sin externalidades → el componente queda VACÍO**: con suerte `$options.VO = Rut` y **NADA MÁS**.
  ItdRut hoy está vacío A PROPÓSITO — es la prueba de concepto de lo que se INYECTA al GI después.
- **El GI viene parchado para soportar VOs instanciados**: si el VO soporta la funcionalidad (hook
  homólogo: initVal/formatter/emitter/keypress/validate…) el GI la usa; **si no la soporta → FALLBACK**
  al flujo clásico del GI. Encapsulamiento transversal, CERO sobrecarga por componente.
- **Con externalidades (Currency: locale/moneda/mask) → el componente justifica SOLO el cableado de
  externalidades** (watchers → setters al singleton). Todo lo demás que un componente declare (pisar
  emitter, formatM, refreshes, herencias por binding) es olor a parche → revisar el VO o el GI, no
  engordar la hoja.

Vara de revisión: cuenta las líneas del componente que NO son cableado de externalidades — cada una
es deuda contra esta máxima.

## 🔴 Externalidades: JAMÁS en la clase ni el doc — WRAPPER en el componente

Los hooks GI de la clase existen SOLO SIN externalidades (los valores deben existir REALMENTE en ambos
mundos: `_currency` sí — campo real del doc + alcanzable por localInput/rootBus; `locale`/`mask` JAMÁS —
son del USUARIO: back `$locals.locale`/`req.locale`, front Config store). **Nunca se parcha una clase ni
un pseudoDoc para suplir externalidades** — se enchufa por WRAPPER (la cochinada):

```js
// created() del componente — el ADAPTER: solo el componente sabe que hay cochinada
const vm = this;
this.VO = class extends Currency {
  constructor(...args) { super(...args); this.setLocale(vm.staticLocale); }
};
```
Clase pura (el back jamás ve el wrapper), GI ni se entera, externalidad en la frontera. 🔴 Regla de oro:
el wrapper lee fuentes **PLANAS** (`vm.staticLocale`, snapshot actualizado por watcher) — NUNCA el getter
reactivo (el constructor corre dentro del computed `externalValue` → getter-tubo → pisado fantasma).
Detalle front: skill `itdfw-front-develop` → vo-gi-contract.md.

## 🔴 Construcción: constructor-VALOR / setters-AMBIENTE / `static cast` opcional

**El pecado original (muerto 2026-07-03): "constructor = firma del cast"** — amarraba la clase al esquema
de UN consumidor (mongoose) → reinstanciación perpetua + constructor fijo + timing ambiental como problema
del dev. La forma final separa las 3 fases:

1. **`constructor(value)`** — SOLO registra valor. Puro, testeable sin mocks, cero ambiente.
2. **SETTERS ambientales** — el ambiente entra POR GOTEO cuando llega (`setDoc`/`setLocale`/
   `setSchemaType`/`setCurrency`...), idempotentes. Resuelve el timing: no se puede saber cuándo cambia el
   ambiente ni en qué etapa está — la instancia se arma al ritmo del ambiente (hydrate back, lazy/async
   front, da lo mismo el orden).
3. **`static cast(...)`** (OPCIONAL — challa por necesidad) — el ADAPTER por consumidor: recibe la firma
   que sea (la del caster mongoose `(value, doc, init, prev)` + options + schemaType; la del GI; la que
   venga), crea la instancia y pichicatea vía setters. La variabilidad de firmas vive en la fábrica, no en
   la clase. **Simple (Rut) NO necesita cast** — constructor directo; complejo (Currency) sí.

🔴 **Construcción TOTAL — la infra NUNCA se cae**: cualquier input produce instancia (nulish FCC incluido);
los setters ambientales tampoco lanzan. **La parcialidad (throws) vive SOLO en las puntas de SALIDA, y solo
si la punta lo necesita**: `validate` cae al validar (mongoose lo llama pre-save → lo inválido nunca
persiste, como ValidationError), `format` cae sin locale (PLR), `toBSON` warnea el chueco. Mata: el dogma
"jamás existe inválido" (validaba en el peor momento — la construcción, con el ambiente a medias), los
guards de timing y los FCC-checks defensivos.

- 🔴 **`setOptions(options)` = LA punta ESTÁNDAR para recibir la config del campo** — la infra la llama
  SOLA en ambos mundos (back: caster genérico post-new; front: GI en created Y en cada `inputUpdate`),
  siempre `?.` (optional por construcción). **Libertad del dev**: el constructor PUEDE recibir los args
  completos del caster (config back-only por constructor es legítimo — el caster le pasa todo); pero si
  la config se necesita en AMBOS mundos, la vía correcta es `setOptions` (el GI solo conoce esa punta).
  La clase lee LO QUE SU CONTRATO DEFINE e ignora el resto; sin externalidades de input (Rut) simplemente
  no la declara. SIN props "por fuera" en el front.
- `schemaType` (la cochinada del caster): path para el auto-dirty de `setValue`.
- `prev` → `dispose()` (limpieza de listeners). Pub/sub: escuchar al **ROOT** (`ownerDocument()`).

## 🔴 SIN clase base/template — el contrato se VERIFICA, no se hereda

Una base `DomainObject` con `#value` está muerta **por construcción** (evaluada y descartada 2026-07-03):
los `#private` no se heredan → el hijo no puede operar su valor (¿un `formatter` que no puede leer lo que
formatea?); y darle getter/setter público "para que opere" hace que **el privado ya no sea privado** —
acceso total sin transformación = protección ceremonial. La base cobra flexibilidad y paga con seguridad
falsa.

**El reemplazo: módulo TDD de CONFORMANCE** — el contrato DDD es de COMPORTAMIENTO (qué hacen las puntas),
no de estructura → se verifica con un test externo: le pasas tu clase y te dice qué cumples y qué falta
(¿instancia con nulish sin caerse? ¿setValue no-throw+dirty? ¿toJSON/toBSON empty→null? ¿validate cae con
basura? ¿toPrimitive?). Sirve para clases nuevas Y para auditar las existentes (Address/Duration gratis),
sin acoplamiento estructural. Es el gemelo del skill: el skill DICE el contrato, el módulo lo VERIFICA —
y "¿pasa el conformance?" = la puerta de salida objetiva (itdfw-completeness).

## Orden de implementación (2026-07-03)

1. **Rut** — el CORE del contrato sin challa: instancia-siempre (FCC nulish), `setValue` triple,
   validate transversal de esencia, auto-dirty. Sin anillos 2/3.
2. **Currency** — el completo: + externalidades por wrapper, pub/sub, formatters, hooks GI.
3. Rama futura: **distribución de clases de types al front** (para types core/DEFAULT sin FWP) →
   `claude-docs/TODOs/features/backend/type-classes-distribution.md`.

## Anti-patrones

| ❌ | ✅ |
|---|---|
| Parchar la clase/pseudoDoc con externalidades (doc.locale) | wrapper en el componente |
| Statics al modelo `doc.method(campo)` | `doc.campo.metodo()` |
| Negar la clase con nulish (`v == null → null`) | instancia SIEMPRE, standby |
| Validar definiciones (min/max) en la clase | solo ESENCIA; definiciones al campo |
| `_validate` para túnel back→front | `validate` en la clase, enchufado transversal |
| Revertir el display para recuperar el valor | el SSoT es VSR — ya lo tenemos |
| Default silencioso de locale | PLR en dominio explícito; el hook degrada; el wrapper inyecta |
| **Clase de adorno**: cast gordo valida todo + clase vacía (Duration histórico) | la lógica EN la clase; cast/type delgado |
| Copiar un VO viejo como plantilla (TimeFrame) | partir del contrato de este skill (piloto Rut) |

## Reglas heredadas VIGENTES (del canon anterior — sobreviven al contrato nuevo)

- **Presentación para export**: `toXLS()`/`toPDF()` en la clase — la data sabe presentarse (canon Rut).
- **`toJSON()` = transporte** (canónico limpio/crudo al front) / **`toBSON()` = persistencia**; `empty → null`.
- **PLR segmentado**: el locale solo lo usan los formatters → PLR AHÍ, no en el constructor (una instancia
  sin locale sigue operando el resto).
- **Labels locale-aware para selects = SINGULAR (forma de cita)**: no existe "plural genérico" sin conteo
  (eslavos 3 formas, árabe 5, galés muta raíz — verificado con matriz 1/2/5/10/20/100/1000 en 12 locales,
  2026-06-26). Recipe: `Intl...formatToParts({[unit]: 1})` filtrando `type !== "integer"` — NUNCA regex
  sobre el dígito. `options`/label = count-independent (singular); `format`/valor = count-aware (flexiona).
