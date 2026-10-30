# Setup vs Options API + paradigma lazy/async

## Setup vs Options API

`setup(props, ctx)` corre ANTES de `created` → `this` NO existe aún. Por eso NADA que dependa de `this` (loaders, mixins, $-keys, computed, data, methods) puede vivir en setup — no es una regla, es el lifecycle. Setup es para lo que se alimenta de `props`/`ctx`, NO de `this`: (1) composables Vue 3 que DEBEN correr en setup (`useDialog`, `useRoute`), inyectados via return (ej. `setup() { return {dialog: useDialog()} }` bridge NUI); (2) bootstrap / definiciones previas con helpers standalone alimentados por props — SWR, `formBundle(props)` de BackEnd.js. Si recibe `props` y retorna data → setup es el lugar correcto (patrón creciente). En LOADERS: Options API puros, retornar `function(){}` (no arrow). **Compartir setup entre capas** (no se hereda → `core→front→site`): named export + re-export, ver [cascade-inheritance.md](cascade-inheritance.md).

Ver también las filas de setup+loader (silent reactivity loss, bridge regular-function) en [anti-patterns.md](anti-patterns.md).

## 🔴 NO asumir dato-on-create (paradigma lazy/async)

🔴 **Los LOADERS/plugins ($validateSelf, $vModel…) también tienen created — y quedaron FUERA de las
limpiezas de GI/GF** (cazados 2026-07-18, DOS fósiles en el MISMO created de validateSelf): (1) la
`assignVSR(true)` forzada — con valor async corría con VSV VACÍO → VSR = null ASIGNADO → el watcher
EMITÍA null al form PISANDO el valor bueno; el lazy gate sellaba el desacople hasta el blur (Number/
Percentage rojos en update con display válido — la firma: VSR null + modelValue null = el roundtrip
CORRIÓ y nulificó; VSR undefined + modelValue intacto = solo bloqueo). La secuencia del rojo MOMIFICADO:
el null activó el VS (error) → el valor real llega al VSV pero SIN assign (lazy) → VSR jamás cambia →
su watcher jamás re-dispara → el VS nunca re-corre → el delivery final re-valida sobre el VSR null y el
error persiste con el display sano; solo un focus/blur lo recuperaba. Muerta: la emisión inicial no la
necesita nadie — el form YA tiene el valor. (2) el snapshot `doubleCheckValue = externalValue` — capturaba
vacío → Profile partía en rojo; mudado al GI (la estructura del DC es del GI, VS solo VALIDA) como espejo
reactivo mientras-COMPLETAMENTE-prístino (primer tipeo en principal O DC corta el espejo — un espejo que
sigue al tipeo vuelve el DC adorno). ⟹ al auditar created, revisar TAMBIÉN los de los loaders.

El invariante viejo *"componente creado ⟹ su dato disponible"* está ROTO. `formBundle` separó form/specs/value en puntas **SWR lazy/async/independientes** → "creado" ya NO implica "tengo el dato". `setup`/`created` NUNCA debe leer `value`/`options`/`form`/`universe` esperando que ya esté poblado: declara la punta SWR (lazy, no gatilla), llama `mutate()` **explícito** cuando se necesita, y lee el resultado vía **reactividad** (watcher/computed), nunca el valor crudo en created. El patrón viejo "todo one-shot a created" era correcto en su momento (Vue2: cortar reactividad anidada + infra/data sync: una punta traía todo) — ambas premisas murieron (Vue3 reactividad sana + formBundle lazy). **Deuda ENCAPSULADA en setup/created**: al tocar cualquier componente, revisa esos 2 hooks. Síntomas (misma raíz): options/universe/value vacío, submit que manda con verbo/punta/datos mal. GI/GF tienen la deuda mayor (setup/created grandes). Análisis de completitud pendiente.

### 🪄 MAGIA NEGRA — `formBus.getValue(name)` es REACTIVO leído EN VIVO, MUERTO si lo snapshoteas

`getValue` retorna `vm.validateSelfValue[name]` (data **reactiva del FORM**); leerlo dentro del tracking de Vue registra la dependencia **cross-instance** → el hijo re-evalúa al mutar el form. Es el *"lee vía reactividad"* de la regla lazy/async de arriba, hecho concreto. **TRES formas:**
- ✅ `computed(){ return formBus.getValue(x) }` → VALOR reactivo (render/derivar).
- ✅ `$watch(() => formBus.getValue(x), cb)` (source **función**, NO string-path) → SIDE-EFFECT reactivo (corre `cb` al cambiar, ej. `setCurrency()`).
- ❌ `created(){ const v = formBus.getValue(x) }` → snapshot **MUERTO** (fuera del tracking → pierde mutaciones intermedias + lazy loads).

⟹ **cross-field reactivo = computed/watch(fn) de 1 línea, NO `formBusOn("valueUpdate:X")`** (los eventos son para reacciones IMPERATIVAS, no para *leer* valores ajenos — y encima se pierden el lazy load). Semi-obsoleta `currencyHandler`/`setCurrencyHandlers` (son watchers → colapsan a `watch(()=>getValue)`); reemplaza el legacy `extra` (prop pre-formBus). **Caveat:** `getValue` resuelve sobre el formBus INMEDIATO; en forms anidados (docArray, ej. cuotas) un hijo puede necesitar valor del parent/root → cadena `formBus→parentBus→rootBus` PENDIENTE (ver `claude-docs/TODOs/ideas/formbus-nested-chain.md`). Detalle completo: [value-pipeline.md](value-pipeline.md).
