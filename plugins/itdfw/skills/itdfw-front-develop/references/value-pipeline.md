# Value Pipeline

> 🔴 **FLUJO SELLADO**: los gates de abajo están CONGELADOS.
> NO tocar ninguno sin tema MUY fuerte — cada uno mata un modo de falla específico (eco, over-render,
> retro-formateo, wipe). Declaración canónica pa reimplementar front/core:
> La doc de arquitectura «value-flow-sealed».

## 🔴 El árbol de gates — CÓMO OPERA (sellado)

El flujo es CIRCULAR: `raw baja → initVal → VSV (display) → emitter → VSR (canónico) → emisión → raw
del padre → baja de nuevo`. Los gates cortan el círculo en cada frontera; solo progresa lo que cambia
estado real.

### CARRIL 1 — DESCENSO (padre → hijo)

```
externalValue (computed)
├─ TER: gotea SOLO externalidades DECLARADAS al VO (+ setOptions del input)
│   ├─ mapa vacío (GF) → inmune al ambiente          [si global → WIPE del contenedor]
│   └─ cambio detectado (_lastExternal) → _forceDisplay = true (one-shot, NO-reactivo)
└─ return initVal(vModelValue ?? input.value)

watcher EV(val), en ORDEN:
├─ 1. _forceDisplay? → VSV = val, consume flag, SIN emisión → return
│      [re-formateo por externalidad: canónico idéntico, el eco-cut se lo comería.
│       Seguro por EXCLUSIÓN TEMPORAL: valor y ambiente nunca en el mismo tick]
├─ 2. isEqual(emitter(val), VSR)? → return           [ECO-CUT: mi emisión de vuelta;
│      comparación SEMÁNTICA en dominio canónico — quitarlo: over-render + retro-formateo]
└─ 3. cambio externo GENUINO → vModelSync(val) + VSV = val
       [sync = "ya alineado" → el guard de emisión no re-emite el eco]
```

### CARRIL 2 — ENTRADA (tipeo/click)

```
updateValue(e)
├─ hay VO → vo.setValue(result, lazyFormatter)    [raw=true: display intacto, cursor sano]
│    └─ onChange → voUpdated → VSV                [salida ÚNICA del VO, firma pelada]
└─ clásico → VSV = lazyFormatter ? result : formatter(result)
```

### CARRIL 3 — SUBIDA (VSV → VSR → emisión)

```
watcher VSV → assignVSR(force)     [GATE PURO — cero lógica de negocio]
├─ support(viewType)?              [contrato viewTypes]
├─ localLazy && !force → return    [lazy retiene; el blur trae el force]
└─ VSR = emitter(VSV) si difiere   [isEqual — idempotente]

watcher VSR → await validateSelf() [CARRIL PARALELO: SIEMPRE se emite, el error
├─ guard post-await: VSR == val?    viaja aparte — emitOnError no existe]
└─ vModelEmit(val)
     └─ isEqual(val, lastEmitted CLONADO)? → no re-emite   [snapshot inmutable;
        por referencia = "se actualiza solo" = GF mudo p/siempre]
```

### CARRIL 4 — LAZY (ortogonal: decide TIMING, jamás toca valores)

```
localLazy
├─ forceLazy boolean → DIRECTO     [veto por construcción: ArrayAdd (infra), Radio/ChBG NUI (sin blur)]
└─ OR(this.lazy, $attrs.lazy ←childrenLazy del padre, localConfig.lazy, attrs.lazy)
    [lazy manda, false no veta]

childrenLazy (contenedor): hijos al blur, canal del padre LIBRE
├─ Embedded/SubdocRow → renderFormInput          [recursivo gratis: L2+]
├─ AF-NUI → prop a ItdGrid → renderGI de celda   [50×10 celdas sin asesinato]
└─ ArrayAdd → input.lazy al sub

blur: valor sube ANTES del $emit("blur") → el padre flushea con datos frescos [transitividad]
estructurales (add/remove, click de selección): despachan INMEDIATO — el gate lazy es solo pal tipeo
```

🔴 **PRINCIPIO (decisión de diseño; implementación pendiente de análisis):
el roundtrip interno del componente es COMPLETITUD y no depende de externalidades; el blur es SOLO el
gatillo de emisión, nada más.** Hoy `lazy` gatea la asignación del VSR al blur, o sea convierte al blur
en un stopper de la completitud interna: el componente vive en estados intermedios (VSV ≠ VSR, "falta
asignación") que nos acostumbramos a leer como normales, y no lo son. Lo que debe ser:

- `lazy` = **emisión diferida**, punto. VSV → emitter → VSR y la validación corren SIEMPRE, por tecla.
- La protección que justifica `lazy` (no re-alimentar el input controlled mid-tipeo) vive en la EMISIÓN:
  sin emisión no hay re-bajada, el display queda intacto. Asignar VSR vivo no la rompe.
- El rojo mientras se tipea es pega del **emitter** (normaliza "1....000,10" → `1000.1`), no del validador:
  se valida el canónico; si queda rojo es porque el valor está malo, no "incompleto".
- "Cuándo gatillar cosas internas" (validadores async tipo `checkStrength`) es una perilla PROPIA
  (throttle / al blur), no el blur como gate global. Hoy está acoplado por accidente.
- El contrato hacia el padre NO cambia (recibe al blur). Cambia solo el timing interno.

### Invariantes transversales

1. **Todo dato que cruza frontera viaja CLONADO** (`GI.clone`: Blob por ref, resto deep). Excepción
   deliberada: el contenedor del GF muta in-place (sus observadores comparan contra clones).
2. **Cada gate pregunta por ESTADO, no por evento** → idempotencia: señales repetidas = no-ops.
3. **Dominios separados**: canónico (VSR) · display (VSV) · timing (lazy) · validación (paralela).
   Único puente: `emitter()`, siempre display→canónico.
4. **Ambiente por DECLARACIÓN** (externalReactivity): nada global toca el flujo.

**Propiedad emergente**: solo cambios idempotentes pasan — la cobertura no viene de enumerar casos
sino de gates ORTOGONALES (uno por dominio): cualquier combinación pasa por todos.

```
prop.value → initVal() → [validateSelfValue] → emitter() → $emit("input")
                ↑                                    ↑
           initial load                      watcher in validateSelf

user input → extractEventValue() → updateValue() → [validateSelfValue]
```

## Methods

| Method | Purpose | Default |
|--------|---------|---------|
| `initVal(v)` | Transform initial value from prop | `v => v` |
| `cast(v)` | Coerce external values to expected type | (none) |
| `emitter(v)` | Transform before emitting to parent. Nullify as type normalization OK (`"" → null`), nullify as validation filter NEVER (`{partial} → null`) | `v => v` |
| `formatter(v)` | Display formatting (Intl, trim, etc.) | `v => v` |
| `extractEventValue(v)` | Extract value from DOM event | `v instanceof Event ? v.target[this.targetValue] : v` |
| `keypress(e)` | Filter keystrokes | (noop) |

## 🔴 viewType: render LIBRE, emisión REGISTRADA (gotcha de composites)

`viewType` carga **TRES** responsabilidades que es fácil confundir. Un viewType EDITABLE nuevo debe registrarse en los TRES, o falla en el lugar que olvidaste:
1. **Qué se renderiza** — LIBRE: `renderContent` hace `slotOrRender(viewType)` → resuelve el método `render{ViewType}` por nombre. Cualquier viewType (incluido uno inventado) rinde lo que su método diga. Ej: `viewType:"mainInput"` → `renderMainInput` (control desnudo, sin el InputGroup pipeline) — útil para un **GI composite** que mete sub-inputs en su PROPIO group (input-group de NUI: los sub-controles deben ser hijos directos, sin InputGroups anidados).
2. **Si EMITE** — REGISTRADA en `assignVSR`: el round-trip de emisión (`updateValue/set → assignVSR → emitter → validateSelfRaw → vModelEmit`) **solo corre si el viewType está en la lista de `assignVSR`** (plugin `validateSelf`: `["input", "filter", "mainInput"]`). Un viewType editable que NO esté ahí **rinde pero NO emite** → el padre nunca recibe el value (el handler jamás se dispara).
3. **Si el prop lo ACEPTA** — REGISTRADA en el `validator` del prop `viewType` (`lib/GenericInput.jsx`, prop `viewType` → `validator(v)` con la lista `["input","view","detail","filter","plain","mainInput"]`). Si no lo agregas, Vue **alega en consola** (`invalid prop`) aunque el render y la emisión funcionen.

**🔴 Regla**: viewType EDITABLE nuevo → agrégalo en los TRES: `render{ViewType}` (método), lista de `assignVSR` (emisión), y `validator` del prop (sin warning). Síntomas por lugar olvidado (ejemplo: ItdAddress):
- falta en `assignVSR` → el log muestra `validateSelfValue set {...}` pero NO `assignVSR`/`vModelEmit`; el control setea pero el padre no se entera.
- falta en el `validator` → Vue warnea `invalid prop: viewType`.
La auto-validación del watcher VSR queda atada a `viewType === "input"`, pero eso no importa en composites: el padre valida sus sub-inputs explícito (`validateSelf` itera refs y llama `vm.validateSelf()`). Lo que NO puede faltar es la **emisión**.

### `renderGI` + `viewType:"mainInput"` = composite SIN wrapper GF/GFMin (patrón clave)
Para un input cuyo value es un Object de N campos fijos (Address: address/detail/postalCode), la opción histórica era extender GF/GFMin (innerForm + formBus + render-por-input). Pero eso mete **un wrapper de form entremedio** que aporta poco para campos fijos sin cross-field, y es fuente de bugs (round-trip, render por externalValue). El patrón nuevo, más limpio:
- el componente **extends GenericInput** directo + `$renderGI:true`;
- define los sub-inputs como objetos (name/label/type/component/validate…) en un computed;
- `renderMainInput()` los rinde A MANO con `this.renderGI(def, value, handler, {props:{viewType:"mainInput"}, ref:collect})` → cada sub-GI rinde su control **desnudo** (sin su propio InputGroup) → quedan como hijos directos del InputGroup del composite (NUI los pega como grupo);
- **handlers explícitos** por sub-input (`handleX(val){ this.validateSelfValue = {...this.validateSelfValue, x: val} }`) → cero `if (qué-input-me-mandó)`, cero ciclo de form;
- `validateSelf()` itera los refs recolectados y junta errores.
Ventaja: toda la lógica de negocio del GI (initVal/emitter/cast/validación) disponible, renderizando los sub-controles sin wrapper. **Candidatos a migrar así**: `between` (hoy GF), `checkbox-group` (hoy GFMin en core — en NUI ya es GI directo porque NUI daba las prestaciones). Ejemplo vivo completo: el componente `ItdAddress` del plugin `address`.

**Corolario — controles auxiliares (botones, modales) DIRECTO en el fragment, con `this` natural.** Cuando rindes a mano, un botón left/right o un modal van como hijos del fragment del `renderMainInput`. Para el botón usa **`ItdButton`** (wrapper agnóstico del FW, `resolveTag("itdButton")`), NUNCA `n-button`/`button` directo — ItdButton trae su propio `$NUI:["Button"]` y los defaults por framework: `const ItdBtn = resolveTag("itdButton"); <ItdBtn onClick={() => { this.showMap = true }}>{{icon: () => <Icon name="map"/>}}</ItdBtn>` → el handler es un método/arrow del componente con **acceso pleno al `this`** (lógica de negocio, refs SWR, estado). Esto **evita** la fricción del `leftButton`/`rightButton` declarados en `inputDefaults`: ese es un **objeto de config sin `this`** → su handler obliga rebindeo / pasar referencias para tocar la lógica del componente. Rendir el control en el fragment lo pone en el MISMO scope que lo que dispara → cero rebindeo. (Mismo criterio para un modal: meterlo en el fragment — NUI lo teletransporta igual — en vez de pelear con `postInput`/slots que el GI condiciona a `viewType==="input"` y no se rinden con `$renderGI`.) Caso real: el botón del mapa + el `n-modal` de ItdAddress.

## 🔴 assignVSR + lazy: cuando un cambio de FORMATO capa el VALOR real

`assignVSR(force)` (plugin `validateSelf`) re-corre `emitter(validateSelfValue)` y asigna el
`validateSelfRaw` — el valor ENTREGADO al padre, **lo que los controllers calculan**. Dos guardas:
- **viewType** editable (`input`/`filter`/`mainInput`); si no → return.
- **lazy**: `if (this.localLazy && !force) return`. Con `lazyFormatter`, el watcher interno de
  `validateSelfValue` llama `assignVSR()` **SIN force** → queda **bloqueado** → el VSR NO se re-emite al
  cambiar el display. Para forzar la emisión en el flujo lazy: `assignVSR(true)` (lo hacen `GenericForm`
  y `GenericInput`).

🔴 **Caso raro: un cambio de FORMATO que CAPA el valor real.** Normalmente el formato NO toca el
valor (formatear "1000" no cambia el número) → el VSR no necesita re-emitirse. PERO en Currency la **precisión
es de la MONEDA**: cambiar CLP↔USD **re-redondea** el valor (0↔2 dec). Si solo reformateás el display (VSV) y
NO re-emitís, con `lazyFormatter` el **VSR queda con la precisión vieja** → los cálculos comen arrastre por
error acumulado. Fix: tras reformatear el VSV, `this.assignVSR(true)` → el emitter re-capa el raw a la nueva
precisión. Ejemplo: `ItdCurrency` watcher de `localCurrency`. **Regla general: si un cambio de formato altera
el VALOR DE DOMINIO (no solo su representación) y hay `lazyFormatter`, forzá `assignVSR(true)`.**

## 🔴 Corte de ECO en el watcher de externalValue

El flujo es **CIRCULAR**: raw baja → `initVal` → VSV → `emitter` → VSR → se emite → raw del padre → baja
de nuevo. La memoria del círculo YA existe y se llama **VSR** (VSR = el VSV emitido = el EV de regreso).
El watcher de EV corta el eco comparando en el dominio correcto (el EV es DISPLAY, el VSR es CANÓNICO →
se lleva el EV a modo emisión primero):

```js
externalValue(val, old) {
  if (isEqual(this.emitter(val), this.validateSelfRaw)) return; // mi propia emisión de vuelta → ni tocar VSV
  ...vModelSync + VSV
}
```

- **Mata el over-render completo**: el eco no toca VSV → ni initVal ni la cascada corren.
- **Subsume al comparador `val/old`**: toda bajada idéntica también tiene emisión == VSR;
  el eco en cambio pasaba el val/old (tipeaste → val ≠ old) y clobbereaba el display. El guard pasó de
  "¿cambió el INPUT del watcher?" (sintáctico) a "¿cambia mi ESTADO?" (semántico).
- De yapa: `emitter(val)` corre en cada bajada genuina → en DDD transfiere el valor nuevo al VO
  (transferencia muda) justo antes de que el flujo siga — el descenso alimenta el canal gratis.

## 🔴 NESTED-LAZY: `childrenLazy` (contenedor) + `forceLazy` (veto del GI)

**El lazy vive en el TIPEO de los HIJOS, jamás en el canal del padre.** Separación declarativa:

- **`childrenLazy: true`** (data del GF; default false) — el CONTENEDOR nested declara que sus hijos son
  lazy SIN ser lazy él: `renderFormInput` pasa `lazy: this.childrenLazy || this.localLazy`. El hijo emite
  al blur (se auto-contiene en su delivery); el padre solo recibe `valueUpdate` por el canal natural —
  idempotente, ni sabe que el hijo es lazy. Compone RECURSIVO solo (nested L2 gratis). 🔴 El error
  típico es lazy EN el GF padre: gateaba SU assignVSR → bloqueaba el flujo completo (incluidos los
  estructurales). Quién lo declara y por qué vía (🔴 verificar la rama con el MCP inventory — NUI NO
  siempre extiende el core):
  - `ItdEmbedded` (GF core) y `SubdocRow` (rama core/BV del ArrayForm): data, vía `renderFormInput`.
  - `ItdArrayForm` NUI (GI directo, wrapper de ItdGrid — NO usa renderFormInput): data + prop
    `childrenLazy` al ItdGrid, que lo baja como `lazy` en el bag del `renderGI` de celda editable
    (la grilla es tonta: solo lo PASA).
  - `ItdArrayAdd` NUI: equivalente vía `input.lazy = true` en su `localSubInput` (declarativo al sub).
- **`forceLazy`** (data del GI; default `undefined` = no opina) — veto declarativo: si es boolean,
  `localLazy` lo retorna DIRECTO (manda sobre el OR del arrastre; recordar que en el OR "false no veta").
  `forceLazy: false` en componentes donde lazy rompe POR CONSTRUCCIÓN:
  - `ItdArrayAdd` (core y NUI — 🔴 NUI extiende GI directo, NO el core ArrayAdd): DOS patas — la INFRA de
    crecimiento del array muere esperando un blur que no llega; el lazy va en los SUBS.
  - `ItdRadio` / `ItdCheckboxGroup` NUI: grupos SIN punto de delivery — el click no bluerea el grupo →
    el flush lazy espera un blur que no existe. Instant por naturaleza.
  - Los verificados SIN problema en lazy: select estático, date, checkbox suelto (bluerean de verdad),
    tipeo (obvio). `forceLazy: true` también existe (componente que DEBE ser lazy aunque nadie lo arrastre).

Cubierto: embedded L1+L2, ArrayForm (celdas lazy, filas libres), ArrayAdd
root+nested, radio/checkboxgroup/select/date/boolean dentro del nested.

## Accessing the Value

Always: `this[this.$options.$validateSelfValue]` — NEVER hardcode `this.localValue`.

Shortcut in computed: `this.validateSelfValue` (cloneDeep for objects).

## Reactividad cross-field — `formBus.getValue` (🪄 magia negra)

`formBus.getValue(name)` retorna `vm.validateSelfValue[name]`, la data **reactiva del FORM**. La MISMA llamada es **reactiva o muerta** según DÓNDE la leas — no hay magia extra: es el dependency-tracking de Vue tocando la data del form **cross-instance**.

| Forma | ¿Reactivo? | Uso |
|-------|-----------|-----|
| `computed(){ return formBus.getValue(x) }` | ✅ valor | leer/derivar el valor de OTRO campo |
| `$watch(() => formBus.getValue(x), cb)` (source FUNCIÓN) | ✅ side-effect | correr algo al cambiar (ej. `setCurrency()`) |
| `const v = formBus.getValue(x)` (created/data/method) | ❌ snapshot muerto | NUNCA para valores que mutan o llegan lazy |

**Por qué reactivo:** el getter se ejecuta DENTRO del tracking (computed o watch con source función) y toca `vm.validateSelfValue` del form → Vue registra la dependencia cross-instance → re-evalúa cuando el form muta ese campo. Sin evento, sin watch de string-path (un path NO puede expresar `getValue()`), sin inyectar un ref.

**Por qué muerto al snapshotear:** `const v = getValue(x)` lee UNA vez, fuera del tracking → no se entera de mutaciones posteriores NI de lazy loads del valor externo (el bug clásico de leer en `created`).

**Implicaciones:**
- Reactividad cross-field = computed/watch(fn) de 1 línea. `formBusOn("valueUpdate:X")` es para reacciones IMPERATIVAS (side-effects), NO para *leer* valores ajenos — y encima se pierde los lazy loads (ver paradigma sync-create→lazy-async).
- Semi-obsoleta `setCurrencyHandlers`/`currencyHandler` (son watchers → colapsan a `watch(() => formBus.getValue("_currency"), setCurrency)`).
- Reemplazo limpio del legacy `extra` (el valor que se pasaba por prop antes de formBus).
- Ejemplo: `ItdCurrency.currencySource` lee `_currency` del form así.

**Caveat (pendiente de diseño):** `getValue` resuelve sobre el formBus INMEDIATO. En forms anidados (docArray — ej. cuotas de una simulación colgando de formBus) un hijo puede necesitar un valor del parent/root → cadena `formBus → parentBus → rootBus` (o wrapper encadenado que pregunte en orden). Sin resolver — ver el TODO «formbus-nested-chain».
