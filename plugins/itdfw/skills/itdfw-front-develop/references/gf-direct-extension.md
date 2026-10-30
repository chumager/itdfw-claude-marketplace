# GF Direct Extension (Level 5 — Non-Scalar Components)

## Rule

If your component's value is an Object (sub-form, group, range), **extend GF directly**. Never wrap GF inside a GI.

## Which GF to extend?

- **🔴 Composite que ES un input (slot compacto)** → **`GenericFormMin`** (global `GenericFormMin`). **Este es el caso por defecto de un type-form.** Sin labels/rows/cols: cada input va en un wrapper mínimo (`<div>` con style/class del config), el componente se comporta como UN slot de input sin polutar el layout del form padre. Ejemplos reales: `ItdBetween`, `ItdCheckboxGroup`, `ItdDuration`.
- **Custom layout** (own Row, VFG, tags): `GenericFormCore` from `core/lib/GenericForm.jsx`.
- **Standard full form** (labels, rows, buttons): GF de cascade.

### GFMin — el principio (un input tipo form usa GFMin)

Único motivo de existir de GFMin: **compactar el layout y comportarse como un slot de input**. Sin labels (los placeholders + el label del campo padre bastan). Patrón idéntico al gf-direct, solo cambia la base:

```js
/*global GenericFormMin*/
export default {
  name: "ItdMyComposite",
  extends: GenericFormMin,
  data() { return { mode: "input" }; },
  created() { this.innerForm = this.buildInputs(this.localInput); },
  methods: { initVal(v){/* ext→inner */}, emitter(v){/* inner→ext */} }
};
```

### horizontal — config-driven vía `options` del TYPE (NO hardcode en el componente)

GFMin lee `localConfig.horizontal` (= `localInput.horizontal` en modo input). **Se enciende en la definición del TYPE**, no en el componente:

```js
// mongooseTypes / FWPlugin type options
options: {
  component: "Duration",
  horizontal: true,         // layout inline (default del type; un campo puede pisarlo a false)
  forceAttrs: ["measures"]   // SOLO lo que necesita un contexto RESTRICTIVO (grilla) — ver abajo
}
```

🔴 **`horizontal` NO va en `forceAttrs`** — es input-only (solo el modo form usa el layout GFMin), y los **forms son LAXOS** → los attrs custom llegan a `localInput` solos. `forceAttrs` es **solo** para contextos **RESTRICTIVOS** (la grilla `tableFields` recorta con whitelist). `measures` SÍ se fuerza porque la **celda en view** lo necesita para formatear (`Duration#format` construye el VO con measures). Regla: forzá un attr **solo si un contexto restrictivo lo consume**; ponerlo "por si acaso" es flaw (cargo-cult). Mecánica: skill `itdfw-mongoose-types` → toinput-pipeline §5; qué punta entrega qué → skill `itdfw-api-system`. Vertical es el default de GFMin si no se setea.

### Layout del form — override de estilo: `styleHorizontal` / `styleVertical` (preferí GRID, no flex)

GFMin expone en `data` `styleHorizontal` y `styleVertical`; `renderMainInput` aplica uno u otro según `horizontal`. **Default: flex** — pero flex colapsa items (anchos impredecibles, el bug del select a width 0). Un componente los **override en su propio `data()`** para cambiar el layout sin tocar el core. **Preferí grid** (marco real, determinista, sin colapso):

```js
data() {
  return {
    mode: "input",
    styleHorizontal: {display: "grid", gridTemplateColumns: "repeat(N, minmax(0, 1fr))", gap: "0.25rem", alignItems: "end"}
  };
}
```

`minmax(0, 1fr)` evita overflow Y el colapso a contenido. Las columnas del grid definen el ancho → **elimina los hacks de `width:50%` por campo**. Ejemplo: `ItdDuration` override `styleHorizontal` a grid 2-col (select | number). Criterio: flex = flujo de contenido desconocido ("cajitas"); grid = layout de campos definidos (determinista). Para forms, grid.

## Why

GF already IS a GI. It inherits the full pipeline: initVal, emitter, validateSelf, render, formBus, slotOrRender. Wrapping adds a useless component layer with extra render cycles and watchers.

## Pattern

```js
import GenericFormCore from "core/lib/GenericForm.jsx";

export default {
  name: "ItdMyComposite",
  extends: GenericFormCore,
  props: {
    formTag: {default: "div"},        // Only if custom layout
    rowTag: {default: () => MyRow}    // Only if custom layout
  },
  data() {
    return {
      VFG: MyCustomVFG,       // Only if custom layout
      validate: false,         // If internal inputs don't need validation
      mode: "input"       // Use GI pipeline (initVal/emitter/VS emit)
    };
  },
  created() {
    this.innerForm = buildMyForm(this.localInput);  // GF watcher does cloneDeep + $forceUpdate
  },
  methods: {
    initVal(v) { /* external → internal */ },
    emitter(v) { /* internal → external */ }
  }
};
```

## Key Points

- **Two ways to define the form**: `form` prop (from parent) or `innerForm` (internal). GF has watchers on both → `localForm` + `$forceUpdate`
- **`innerForm`**: declared in GF data (undefined) so it exists for created. Assign there or later — watcher handles it
- **`mode: "input"`**: enables VS pipeline (validate + emitter + emit). GF renderInput wraps with validation border automatically
- **`validate: false`**: inhibits validation on internal form inputs (parent validates the composite)
- **Puntas** (initVal/emitter): transform between external representation and internal form object
- **`showValidation: false`**: on inner inputs prevents duplicate error display. VFG errorsHandler skips display but validation still runs (form validator collects errors). Use in composite components where errors show at parent level only
- **`addCast`**: required for GF-as-input types (e.g., `addCast("timeframe", "form")`) so auto-validator cascades to find form validators
- **formBus.addInput/removeInput**: for dynamic forms (e.g., Between changing inputs based on type selector). Includes `$forceUpdate`
- 🔴 **`childrenLazy: true`** (2026-07-13): un GF contenedor nested (ItdEmbedded, SubdocRow de ArrayForm) lo declara pa que sus HIJOS emitan al blur SIN ser lazy él (su canal de subida libre — jamás `lazy` en el padre: gatea su assignVSR y bloquea todo). ArrayAdd en cambio es `forceLazy: false` SIEMPRE (su infra de crecimiento muere sin blur; el lazy va en `input.lazy` del sub). Detalle: value-pipeline.md §NESTED-LAZY

## GF created guard — localForm vacío

GF created hace `calculatedValue = localForm.reduce(...)` → `validateSelfValue = calculatedValue`. Si `localForm` está vacío (porque innerForm se setea en el created del hijo, que corre después de GF created), el reduce produce `{}` y wipe el valor inicial.

**Guard**: GF created solo setea `validateSelfValue` si `localForm.length > 0`. Sin este guard, componentes dinámicos (ArrayAdd, ArrayForm) pierden valores iniciales.

## created — usar externalValue, no validateSelfValue

En created de componentes dinámicos (ArrayAdd, ArrayForm), usar `this.externalValue` para leer el valor inicial, NO `this.validateSelfValue`. Porque GF created puede haber wipeado validateSelfValue pero externalValue siempre recalcula desde el prop.

## emitter — NUNCA confiar en orden de keys

`Object.values()` retorna por orden de inserción, no por orden lógico. Siempre ordenar por el ID numérico extraído del key name:

```js
emitter(v) {
  return Object.entries(v)
    .sort(([a], [b]) => Number(a.split("_").reverse()[0]) - Number(b.split("_").reverse()[0]))
    .map(([, val]) => val);
}
```

## validateSelf — override con previousErrors

`validateSelf(previousErrors = [])` acepta errores previos. Para componentes compuestos (ArrayForm, ArrayAdd), override validateSelf para:
1. Iterar `localForm` en orden (no `$refs` directo — no tienen orden garantizado)
2. Buscar la ref por nombre
3. Enchufar `vm.rowId = i + 1` para traducción
4. Llamar `vm.validateSelf()` por cada hijo
5. Reescribir scope mustache con prefix del ref
6. Unshift `"Fila {{$refs.inputs.{i}.rowId}}"` al array de errores
7. Pasar todo a `this.validateSelfRAW(errors)` — delega al mixin original

## rootTag — cambiar root element

`rootTag: "div"` en GI data (default). Override para cambiar el root element del componente:

```js
data() { return { rootTag: "tr" } }  // SubdocRow: root es <tr>
```

## Group Wrapper — useGroupWrapper + GroupWrapperTag

GFMin wrappea cada input con `GroupWrapperTag` (default: `GenericInputGroupMin`). Control:

- **`useGroupWrapper: true`** (default en data) → wrappea
- **`useGroupWrapper: false`** → renderFormGroup retorna contenido directo sin wrapper
- **`this.GroupWrapperTag = MiComponente`** en `created()` → pisa el wrapper (no reactivo)

**JSX no resuelve desde `components: {}`** — siempre usa la variable JS. Por eso el tag va en `created()`, no en `components`.

```js
// Override wrapper en created (no en data, no en components)
created() {
  this.GroupWrapperTag = CheckboxGIW;  // pisa GenericInputGroupMin
  this.innerForm = this.checkboxForm;
}

// Sin wrapper (ArrayForm principal)
data() { return { useGroupWrapper: false } }
```

## Render pipeline — GI vs GF

**GI renderInput**: noop → `defaultRenderInput()` (InputGroupTag + prepend/append + renderMainInput)

**GF renderInput**: mode switch:
- `mode === "form"` → `renderForm()` (FormTag + RowTag + formLayout + formButtons)
- `mode === "input"` → wrapper validación (`is-valid`/`is-invalid`) + `defaultRenderInput()`

Todos los GF con `mode: "input"` tienen borde de validación automático. No necesitan override manual en front.

## Anti-Pattern: GI + GF Wrapper

```
// OLD: 185 lines, double component layer
extends: GenericInput          // GI wrapper
  data: { tag: CheckboxGF }      // GF as tag
  computed: { CheckboxGF() {} }   // GF definition inline
  getInputProps()                 // Pass form/config as props between layers

// NEW: 110 lines, single component
extends: GenericFormCore          // Direct
  data: { innerForm }            // Form definition internal
  initVal/emitter                // Puntas only
```

Real example: see `ItdCheckboxGroup.jsx` (current) vs `ItdCheckboxGroup.jsx.bak` (old wrapper pattern).
