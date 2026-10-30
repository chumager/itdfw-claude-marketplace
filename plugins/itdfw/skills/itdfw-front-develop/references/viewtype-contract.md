# Contrato de capacidades por viewType — `support()` (la punta discierne, el consumer usa)

Cada viewType tiene **vinculación FÍSICA con su render** (1:1; único especial: doubleCheck como variante
de input). El contrato agrega la otra mitad de esa tabla: **qué puede HACER cada modo** — y centraliza los
invariantes que antes vivían como listas hardcodeadas replicadas (el guard de assignVSR, el trap de
hasFormBus, whitelists ad-hoc en componentes).

## La tabla (GI `data.viewTypes`)

```js
// keys HOMOLOGADAS 1:1 al nombre de la punta que las consulta (cero mapa mental)
// refAsks = {declareRefOptions: true, refResolve: true, refSearch: true}
viewTypes: {
  input:     {validateSelf: true,  assignVSR: true,  formBus: true,  translateOptionsList: true, ...refAsks},
  mainInput: {validateSelf: true,  assignVSR: true,  formBus: false, translateOptionsList: true, ...refAsks},
  filter:    {validateSelf: false, assignVSR: true,  formBus: false, translateOptionsList: true, ...refAsks},
  view:      {validateSelf: false, assignVSR: false, formBus: false},
  detail:    {validateSelf: false, assignVSR: false, formBus: false, declareRefOptions: true},
  table:     {validateSelf: false, assignVSR: false, formBus: false},
  plain:     {validateSelf: false, assignVSR: false, formBus: false, declareRefOptions: true}
}
```
Los siete modos son del GI; ningún componente agrega un modo. Lo que agregan son **capacidades** sobre modos que ya
existen (core, 11-oct-2026; NUI y los plugins no declaran ninguna):

| Componente | Capacidad | En qué modos |
|---|---|---|
| `ItdCode` | `editor` (carga ace) | `input`, `mainInput`, `filter`, `detail`, `table`, `plain` |
| `ItdHtml` | `editor` | `input` |
| `ItdSubset` | `fetchUniverse` (pide el universo por `myRef`) | `input`, `filter` |
- Vive en **data** → un componente overridea/extiende SU fila en `created` (raro pero plausible); un edge
  que se repite se **promueve al default del GI** (edge → común).
🔴 **AGREGAR UNA CAPACIDAD NUEVA: se declara SOLO donde se tiene.** La tabla es un mapa de capacidades
**DECLARADAS**, no el universo de las posibles — lo no declarado es `false`. Se hace en el `created` del
**dueño de la punta**:
```js
// ItdSubset: el universo acotado solo se pide donde se elige
for (const vt of ["input", "filter"]) this.viewTypes[vt].fetchUniverse = true;
```
(El typeahead remoto de `ItdSelect` nació así, como `handleSearch` en su `created`; hoy vive en el GI como
`refSearch`, dentro de `refAsks`, y `ItdSelectNUI` solo lo consulta.)
Un `false` **explícito** no es obligación, es un mensaje: *"la estoy probando y todavía no la habilito"*
(estado intermedio deliberado).

La lista de modos sigue existiendo, pero vive **una vez y en el dueño de la capacidad**, no replicada en
cada `if` que la consulte. Y el `silent` se decide por el flujo: una punta que corre en TODO modo (el
`created` de un componente que también se rinde en grilla) va `silent: true` — el false ahí es flujo, no
aviso.

- **`fallback`** (fila opcional POR COMPONENTE): para quien insista en viewTypes dinámicos — "haz tu mejor
  esfuerzo por parametrizar; si implementaste el render del modo dinámico, ya lo conoces y puedes definir
  su fila". El GI NO trae fallback.
- Un render/función NUEVO que quiera usar la capa de discernimiento DEBE registrar su fila — la
  vinculación física garantiza que esto solo puede faltar mientras DESARROLLAS.

## `support(capability, silent = false)` — el weeo vive en el AUXILIAR

- 🔴 **ES UN SEMÁFORO: NUNCA se cae.** Preguntar *"¿puedo hacer esto?"* jamás puede voltear la app.
  - **capability no declarada → `false`** (con su warn condicional). La tabla mapea lo DECLARADO, no todo
    lo posible: declarar **es** el opt-in, y no declarar significa exactamente "no la tengo".
  - **viewType sin fila (ni fallback) → warn + `false`.** Es raro —debería estar declarado en el
    componente o global— pero raro no es fatal.
  - (Ex-diseño, corregido 2026-08-14: ambos casos eran PLR. La PLR compraba cazar el typo, que el warn de
    la rama `false` ya delata, y cobraba declarar llaves que siempre serían `false` en las 7 filas — un
    mapa de capacidades TOTALES en vez de declaradas. Ver `supportOrThrow` para quien quiera severidad.)
- **RESULTADO**: capability `false` → retorna `false` + **warn condicional por DEFAULT** (`this.log` —
  no-op salvo logs activos): *"viewType X no soporta Y — ignorado (normal si el flujo pasa por acá;
  silencia con support(Y, true))"*. El dev depurando entiende al toque si es flujo normal o cagada, y si
  silencia lo hace CONSCIENTE y queda **escrito en el código**.
- **`supportOrThrow(capability)`**: la punta que exija severidad — "si no puedes, te caes".
- 🔴 **SIN optional chaining ni fallbacks al llamarlo**: `support` está definido en el origen (GI) —
  `this.support("x")` pelado; lo que se tiene que caer, que se caiga ([[no-optional-on-declarative]]).

## Quién discierne: LA PUNTA. El consumer llama PELADO.

| Punta | Consulta | Severidad |
|---|---|---|
| `validateSelf` (plugin) | `support("validateSelf")` | default (weea) + no-op `return []` |
| `assignVSR` | `support("assignVSR", true)` | **silent** — los watchers lo llaman rutinario en TODO modo: false ahí es flujo, no aviso |
| `hasFormBus` (computed) | `support("formBus", true)` | **silent** — computed evaluado en todos los modos |

El consumer NO condiciona ni valida nada: `this.$nextTick(() => this.validateSelf?.())` sin `if` — si el
modo no valida, la punta lo ignora (y te weea si tienes logs). Meter `if (viewType === ...)` en un
componente = **lógica de negocio del contrato replicada en el consumer** — el anti-patrón que este
sistema mata (una whitelist ad-hoc envejece con cada viewType nuevo).

## Por qué así (el razonamiento)

- **Invariantes centralizados**: N call-sites con listas = N copias del invariante envejeciendo solas.
  UNA tabla + guards en los dueños de cada capacidad.
- **Silent-error subsanado por logs condicionales**: la infra `this.log`/`vsLog` es Proxy no-op → costo
  cero; ¿no te funciona el flujo? activa los logs y la punta te dice QUÉ cagá te estás mandando. Misma
  filosofía que las puntas del back (el endpoint discierne el verbo, no el caller).
- **Estricto donde importa**: la FORMA del contrato es infra — romperla es error de desarrollo y explota
  inmediato; la CAPACIDAD negada es flujo — degrada con aviso.

## Nota hermana: dependencias de un loader viven en SU mixin

Caso `vModelChildProp` (2026-07-02): el computed base (null) se definió primero en GI, pero quien lo lee
es el **loader vModel** — y el loader lo usa CUALQUIER componente con `$vModel`, no solo GIs → un no-GI
warneaba "property not defined". Regla: **el mixin que genera un loader garantiza SUS propias
dependencias** (defaults incluidos); los overrides viven donde está la regla específica (GI NUI:
`lazyFormatter ⟹ "value"`).
