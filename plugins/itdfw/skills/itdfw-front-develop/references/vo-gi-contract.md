# Contrato VO↔GI — el Value Object enchufado al GenericInput

Un GI puede delegar dominio a un **Value Object** (la misma clase isomorphic del back — skill
`itdfw-ddd-value-objects`). Se enchufa con DOS slots que el GI garantiza (existen siempre, null default):
`data.VO` (la clase o su WRAPPER — ver abajo) y `this.doc` (el pseudoDoc). El GI despacha con patrón único:
`new this.VO(value, this.doc, null, null, options)` → método HOMÓNIMO del VO; sin método → warn onDev
(1 vez por clase.hook) + fallback nativo; `hook = null` = opt-out mudo.

## 🔴 LA REGLA: hooks de clase SOLO SIN externalidades

**La clase puede sobrecargar los métodos del GI SOLO SI NO HAY EXTERNALIDADES** — los valores que el hook
consume deben existir REALMENTE en ambos mundos:

| Valor | ¿Existe en el doc REAL (back)? | ¿Alcanzable por el GI (front)? | Veredicto |
|---|---|---|---|
| `_currency` | ✅ campo real del root (el plugin refresca al set; nested = virtual ascendente) | ✅ `localInput`/`rootBus`/`row` | **NO es externalidad** → hook de clase OK |
| `locale` | ❌ JAMÁS — es del USUARIO, no del sistema (back: `$locals.locale`/`req.locale`; front: Config store) | ✅ pero por canal de USER | **Externalidad** → PROHIBIDO en el doc |
| `mask` | ❌ config de presentación | ✅ store | **Externalidad** |

🔴 **NUNCA se parcha un VO para suplir externalidades** (meterle `locale` al pseudoDoc = corromper la
identidad del dato con el contexto del observador — el mismo doc se presenta es-CL a uno y en-US a otro).
La homologación es *"en la medida de lo posible"*: un MEDIO para simplificar, no un fin que justifique
deformar el contrato del doc. Si el hook necesita una externalidad → NO es hook de clase pura → wrapper.

## 🔴 El WRAPPER del VO (la cochinada bendita) — externalidades por ADAPTER

Cuando el dominio necesita externalidades (locale/mask), el componente enchufa un **wrapper** de la clase
en `data.VO`/created — el adapter donde viven los conectores propietarios:

```js
// created() del componente
const vm = this;
this.VO = class extends Currency {
  constructor(...args) {
    super(...args);
    this.setLocale(vm.staticLocale); // ← la externalidad entra por la FRONTERA, no por el doc
  }
};
```
- La clase base queda **PURA** (isomorphic — el back jamás ve el wrapper).
- El contrato GI ni se entera (`new this.VO(...)` idéntico).
- `initVal`/`formatter` PUEDEN ser hooks de clase: toda instancia nace con su locale inyectado.
- El VO provee **mutators de PRESENTACIÓN** (`setLocale`/`setMask` — chainables, el invariante `#value`
  intacto: el valor es el mismo sin importar el locale) y sus métodos hacen `locale ??= this.#locale`
  (el arg explícito manda; el inyectado es fallback).

🔴 **Regla de oro del wrapper**: lee fuentes **PLANAS** (`vm.staticLocale` — snapshot actualizado por el
watcher), NUNCA el getter reactivo directo — el constructor corre DENTRO del computed `externalValue`, y
un `vm.getLocale` ahí es el getter-tubo: re-tunelea la reactividad del locale al computed → pisado
fantasma del VSV editado. Wrapper + snapshot plano + watcher que actualiza y llama `refreshDisplay` =
cero túnel, todo explícito.

### Mutabilidad del VO — la taxonomía

- `#value`: el invariante DURO — jamás desde fuera.
- `setCurrency`/`setPrecision`: re-cierran `#value` → inmutabilidad **con descanso deliberado**, acotado:
  nunca existen a nivel back (allá la moneda es fija al cast); son herramientas del front, y nadie externo
  enchufa precisión (viene de options o del currency).
- `setLocale`/`setMask`: presentación PURA — cero deuda.

## El pseudoDoc — SOLO system-scope

`this.doc` emula el doc de mongoose para el VO: **únicamente lo que el doc real tiene** (`_currency`).
Nace en `created` (`this.doc = {_currency: this.localCurrency}`). Plano (conector push — un getter sobre
un reactivo ≡ declarar el reactivo: tunelea el tracking). Su reactividad es decisión y responsabilidad
del dev (no hay cerca técnica: data lo envuelve, markRaw es solo preventivo).

## Flujo del componente (Currency como canon)

- **SSoT = VSR**: el valor real YA lo tenemos — **no se revierte NADA del display** (eso era arrastre de
  la era Number/BV sin esta infra). Cambio de moneda/locale → push/snapshot + `refreshDisplay()`:
  `setSymbol + VSV = initVal(VSR) + assignVSR(true)`. Una coreografía, sin `old`.
- **Reactivos SOLO a lo DECLARADO en `externalReactivity`** (Currency: `getLocale: "setLocale"`,
  `localCurrency: "setCurrency"`, `localMask: "setMask"`) — las cadenas de conversión (externalValue,
  getTableViewValue) tocan el mapa y gotean al VO. 🔴 NADA global: el `setLocale` FIJO en el GI (régimen
  anterior) volvía el EV de TODOS reactivo al locale — GF incluido → al cambiar locale el GF root (sin
  vModelValue) re-computaba `initVal(undefined)` y PISABA su contenedor → wipe en cascada (2026-07-13).
  Locale es una externalidad más: quien la necesita la declara (Currency sí, Rut no, GF jamás).
- **SIN props "por fuera"** (`currency`/`$attrs.precision` = API muerta): el `input` es OBLIGATORIO y
  reactivo — TODO lo per-campo viaja en él. "Solo quiero cambiar el currency" → cámbialo en el input.
- **options del VO = el CONTENEDOR de config**: front `localInput` (ahí viven `precision`, `currency`
  fijada); back = las schemaType options del path. El VO lee del contenedor LO QUE SU CONTRATO DEFINE
  (`options.precision`, `options.currency`) e ignora el resto — el caster/GI no arma objetitos ad-hoc.
- `localCurrency` (resolución de contexto): `localInput.currency → row._currency → rootBus` + **error
  logueado** si no hay de dónde (no silencio).

## 🔴 El REGRESO del contrato (2026-07-12) — onChange: el VO cambia → VSV, la cascada corre sola

El contrato tiene DOS direcciones y ambas son del GI (cero watchers de hoja):

- **IDA (externalidades → VO)**: el mapa `data.externalReactivity = {computed: "setterDelVO"}` — el GI lo
  gotea en `touchExternalReactivity` (pull reactivo dentro de `externalValue`). El dev declara los
  computeds de RESOLUCIÓN DE CONTEXTO (dónde vive cada externalidad) y el mapa; el GI hace el resto.
- **REGRESO (VO → flujo)**: el VO notifica por **`onChange`** y el GI mete el valor por la puerta NATURAL:
  el **VSV** (`voUpdated(v) { this.validateSelfValue = v }`). De ahí la cascada corre según el contrato de
  cada componente (lazy mantiene su blur; normal fluye directo). 🔴 NUNCA activar `validateSelf()` a mano
  — eso invierte el orden del pipeline; el VSV ES la entrada.

Reglas de FIRMA (FCC — llamadas PELADAS, sin `?.`, para que la ausencia reviente al boot y no sea
silent-error en producción):
- **`onChange` es OBLIGATORIA en todo VO enchufado como `$VO`** — noop legítimo (`onChange() { return
  this; }`) si el VO no tiene reactividad externa (Rut, Address). El GI la registra en `beforeCreate`.
- **`initVal` es DECLARATIVA, no optional**: con VO presente el GI delega PELADO (un VO sin initVal o con
  bug EXPLOTA — el try/catch tragón que colapsaba sin-vo/sin-hook/hook-con-bug en un fallback mudo murió).
  El valor que `onChange` entrega viene YA pasado por el initVal DEL VO — el GI no re-transforma.
- **Ruta especial** → override de `voUpdated` en el componente (ItdQuotes: inyecta la PK sintética del AF;
  un componente-imagen mete su flujo propio). El handler es la punta overrideable, no re-registrar.
- **Canales paralelos**: lo que NO es valor va por SU canal (slot con nombre, registrado por el
  componente): Currency `onSymbol` (pintura), Duration `onMeasures` (texts de medidas). Un slot por
  concern, sin event-bus genérico.
- ⚠️ **Migración pendiente**: ItdCurrency aún instancia manual (`beforeCreate`) y resuelve el regreso con
  watchers (`localCurrency → validateSelf` a mano) — funciona pero es el invariante replicado en la hoja
  que este contrato mata. Migrar a `$VO` + onChange + onSymbol. Canon del regreso: ItdQuotes (Credit VO).

## 🔴 VO PURE-EXTERNALITY (2026-07-15) — derivación pura: SIN onChange, initVal retorna la derivación

Refina el REGRESO para el caso donde el VO en modo external **NO tiene valor propio** — su valor es 100%
DERIVADO de las externalidades ("mi externalidad me define; no tengo valor, lo crean ellas"). Canon:
Credit VO / ItdQuotes.

- **Regenerar es DERIVAR, no un evento → CERO onChange por externalidades.** De la propagación se encarga
  el propio computed `externalValue` (EV): la MISMA externalidad que gatilla el drip re-evalúa el EV, el
  drip actualiza el VO en esa pasada, y el `initVal` al final retorna la derivación fresca. Un solo ciclo,
  cero eventos. Emitir onChange dentro del goteo era **escritura-dentro-de-lectura** (el goteo corre
  DENTRO del EV → voUpdated→VSV a MITAD de la evaluación → la cola del computed la pisaba con stale). Así
  murió semanas la tabla de ItdQuotes.
- **`initVal` = derivación pura**: retorna SIEMPRE la derivación (se presume el cálculo en vivo correcto),
  ignorando el descenso. El PRIMER descenso no-vacío (caso update) se GUARDA (`#initial ??=`) — cubre
  datos malos llegando y deja en standby el flujo de validación futuro contra las fees iniciales.
- **onChange queda RESERVADO a cambios INTERNOS que el pipeline NO ve** (la cadena cuota→crédito, y solo
  si `type === free`). Sin ese caso, ni existe el trigger.
- **Las dos patas quedan cubiertas por el early-return del valor final** (el match del EV): externalidades
  que cambian el resultado del EV sin coincidir con VSR (declarada, sin caso conocido aún) y externalidades
  que cambian formateo + initVal — ambas convergen porque initVal entrega el valor final derivado.
- **Construcción PURA en el componente**: sin sobrecarga/precarga inicial (murió el preAssign de
  `Array(n).fill({})`) — el VO construye al completarse el goteo y el flujo lo recoge por initVal.

Distinción de contratos del regreso: VO con reactividad externa PARCIAL (Currency: locale re-pinta un
valor que SÍ es propio) → onChange clásico. VO pure-externality (Credit external) → derivación pura, mudo.

## 🔴 VOs vs LA REACTIVIDAD DE VUE (2026-07-17) — la frontera SIEMPRE serializa

**Operar VOs vivos dentro del front con Vue es territorio inexplorado y HOSTIL**: `reactive()` envuelve
en Proxy EN PROFUNDIDAD todo lo que cae al estado (VSV incluido), y el Proxy es una trampa doble para
clases con `#private`: `proxy instanceof VO` da **true** (transparente al instanceof) pero los getters
corren con `this` = Proxy, que NO declara los `#privates` → `Cannot read private member #value` (cazado
2026-07-17: 63 throws en un burst de montaje — celdas Currency leyendo instancias proxificadas).

**LA REGLA: una instancia VO JAMÁS cruza hacia estado reactivo.** Las instancias viven DENTRO de su
dueño (el VO singleton del GI, los hijos de un VO compuesto); lo que cruza la frontera es TRANSPORTE:

- La frontera del VO serializa: `toJSON()` — monetarios/valores como RAW (ya CERRADOS por la aritmética
  del dominio), `_currency`/contexto como campos planos por fila.
- Es IDEMPOTENTE por construcción: el valor viajó cerrado, y las externalidades (que viajan por SU vía —
  row._currency, drips) lo re-cubren idéntico en el componente final. Cero deriva, cero entropía.
- Y homologa con TODO el FW: las filas de cualquier grilla llegan del back como raw JSON + contexto —
  un VO que escupe raw hace que sus datos sean indistinguibles de datos normales.
- `markRaw` (evitar la proxificación) se evaluó y DESCARTÓ como vía general: pelea contra el framework
  pa mantener clases exóticas en estado reactivo — más entropía, no menos. Serializar es el canon.
- Herramienta hermana pa los caminos con cloneDeep real (localInput, etc.): `cloneDeepWith` +
  customizer con marcador (`static isVO`) — el clon deja pasar la instancia en vez de destriparla
  (los `#privates` no sobreviven clones/spreads: `{...instancia}` = objeto VACÍO).

## Por qué existe este contrato

La herencia de componentes es por similitud/dependencia: cuando un VO suple la implementación manual, la
herencia MUERE (ItdCurrency: extendía ItdNumber por el 95% manual; con el VO pasó a `extends
GenericInput` — y murieron los data reactivos `group`/`decimal` que contaminaban `externalValue` vía
formatter). El componente queda mínimo: **contexto** (localCurrency), **wrapper/conectores**,
**coreografía** (refreshDisplay) y **pintura** (left/right vía `symbol` del VO). Un dominio, tres
consumidores (cast mongoose, hooks GI, formatters de vista). Piloto: Currency (2026-07-02/03).
