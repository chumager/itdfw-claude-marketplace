# 🔴 Mixins globales: model / contextType (cimiento del flujo, NO loaders)

Dos mixins globales (init.js, bloque dedicado ~566-665) se aplican a **TODO componente** del FW. Son la base transversal del flujo de scope — por eso son **mixins globales y NO loaders**: los loaders son opt-in/selectivos; `model`/`contextType` los necesita *todo* componente para resolver a qué entidad/contexto pertenece. No se puede "no aplicar".

`modelTransitivity` y `contextTypeTransitivity` (idénticos en forma):

| | model | contextType |
|---|---|---|
| prop | `model` | `contextType` |
| inject | `contextModel` | `parentContextType` |
| computed SSoT | `localModel = model ?? contextModel ?? getModel()` | `localContextType = contextType ?? parentContextType ?? getContextType()` |
| provide (aguas abajo) | `contextModel = computed(localModel)` | `parentContextType = computed(localContextType)` |

`getModel()`/`getContextType()` = globals que leen `route.meta.{model,type}` (fallback de la vista raíz).

**Cascada de 3 puntas + auto-reconfiguración reactiva**: `prop (caller) → inject (ancestro) → route.meta (raíz)`. El provide es `computed(localModel)` → si un nivel cambia su model (ej. ItdSelect pasa `model={ref}` a ItdRowDetail en el detail de una referencia), TODOS los descendientes recalculan `localModel` solos, sin lógica explícita. La cadena se reconfigura sola.

**Reglas para el dev:**
- **Usá `localModel`/`localContextType`** (el SSoT resuelto), NUNCA `this.model`/`this.contextType` crudos.
- **NO declares `model`/`contextType` como props locales** — el mixin global YA los da a todo componente. Declararlos es redundante y puede chocar. (Por eso Form NO declara `model` prop; `method` SÍ lo declara porque NO es del mixin.)
- **Override = pasar el prop** `model`/`contextType` (máxima precedencia en la cascada). Es el escape hatch del "default automático, no imperativo" — el dev cambia el comportamiento pasando props (ver premisa de puntas con origen back en skill `itdfw-api-system`).
- Un componente que recibe model de un padre (ItdRowDetail ← ItdSelect via ref/refPath) lo obtiene **gratis** por el mixin; no declara prop ni lo cablea a mano.
- **🪄 Transparencia props↔provides↔meta (la idea fundamental del flujo)**: como `localModel = prop ?? inject ?? meta`, las tres fuentes son **intercambiables y transparentes**. El MISMO componente funciona idéntico en una **ruta** (hereda `meta.model`/`meta.type` — ej. ItdRegister en `/Member` con `meta:{model:"Member",type:"Register"}`) o **standalone** (el caller pasa `<ItdRegister model="Member"/>` → prop). El componente NO sabe ni le importa de dónde viene; quien necesita cambiar la herencia pasa el prop, quien no, la usa. Por eso un consumer como `getRegisterForm()` no necesita argumento model: `useBackend` lo resuelve del closure (`props.model ?? contextModel ?? meta`) sea cual sea la fuente. Es patrón nativo, no caso especial.

**🔴 Red flag (error típico)**: antes de analizar el flujo de model/context de un componente, recordá que el mixin global YA inyectó `model`/`contextType`/`localModel`/`localContextType`. NO busques props locales ni asumas `props.model === undefined` = "bug" — el componente lo recibe del mixin aunque no lo declare en sus props. `hasFormBus` (ver [contextType-formbus.md](contextType-formbus.md)) consume `localContextType`; este es su cimiento.

**También resuelve en `setup`** (vía `useBackend`+`inject`, no solo `this.localModel`) → wrappers que arman SWR en setup (AF, RowDetail, ItdQuotes) heredan el `parentModel` nested gratis. Mecánica completa + pruebas operativas (ItdFilter←contextType, Select-ref→RowDetail←model) → `architecture/core/model-contextType-propagation.md`.

## `contextType` + `hasFormBus` (buses SOLO dentro de un form)

El mixin global `contextTypeTransitivity` (init.js) provee `contextType` (prop de ruta → cascada `localContextType` → fallback `meta.type`), igual patrón que `model`/`localModel`. GI expone el computed SSoT **`hasFormBus = viewType === "input" && localContextType !== "View"`** (doble trap). Úsalo para CUALQUIER condicional de `formBus`/`rootBus`/`parentFormBus` (suscripciones, setInput, cols) — **NUNCA `mode === "input"`** (over-guard, no captura los edges). El doble trap cubre 2 edges: (1) input *read-only* DENTRO de un form → `viewType` lo excluye; (2) input *editable* DENTRO de una vista → `contextType` lo excluye. Si un GI pasa el doble trap y nadie le inyectó el bus, el `warn` del `noopBus` es CORRECTO: culpa del dev que lo instanció sin form, no de la infra. Cobertura: vista que usa GI como inputs → la ruta declara `contextType:"View"` (cae al guard, sin buses); form dentro de una vista → el dev pasa `contextType:"Form"` (o cualquier no-`"View"`) → habilita buses. Grilla = snapshot puro: lee cross-celda via `row`, NO necesita reactividad cross-input (eso ya es ArrayForm, que trae su bus). Raíz (views/Form.jsx) usa `contextType` directo (no `localContextType`) porque es punta del router. **`View` es el ÚNICO contextType read-only** — el resto (Create/Update/Profile/Register/Upload) son forms editables. El guard compara contra el literal `"View"`, NO una lista, por diseño: un contextType read-only nuevo solo se justifica si aporta semántica adicional sobre `View`; si no aporta nada (ej. un hipotético `"Detail"`) ES `View`, no un valor nuevo.
