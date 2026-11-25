# Front Override Pattern

## Rule

Front GI adapts the core pipeline to a component framework. **Overload defaults, never replace noop functions.**

## Why Components Extend Core (not GI front)

Core components use `/*global GenericInput*/` which cascade resolves to the front GI. So `ItdPasswordCore extends GenericInput` already inherits the front GI layer. Front components extend core for 3 reasons:

1. **Different render components** — same logic, different FW tags/components (e.g., Password adds `showPasswordOn`)
2. **Dependencies that would be lost** — validators, casters, imports that core registers at load time. Without extending, cascade would skip the core file entirely
3. **Completely different logic** — rewrite the component, keeping only the "concept" from core

```jsx
// Front component — extends its core homologue
import ItdPasswordCore from "core/components/ItdPassword.jsx";
export default {
  extends: ItdPasswordCore,
  // Core already inherits front GI via cascade
  methods: {
    getInputProps(displayVar) {
      const props = this.defaultGetInputProps(displayVar); // gets front GI overloaded version
      props.showPasswordOn = "click";
      return props;
    }
  }
};
```

## Overloading Default Functions

GI has a chain: `defaultGetInputProps` → `getInputProps` → render. The "default" functions are the pipeline base. Components customize via `getInputProps` (the noop). The front GI overloads the **default** by calling the core original explicitly:

```jsx
import GenericInputCore from "core/lib/GenericInput.jsx";

export default {
  extends: GenericInputCore,
  methods: {
    // OVERLOAD the default — call core original, extend result
    defaultGetInputProps(displayVar) {
      const props = GenericInputCore.methods.defaultGetInputProps.call(this, displayVar);
      // Framework-specific adaptations here
      props.inputProps ??= {...this.attrs};
      return props;
    }
  }
};
```

**Why overload defaults, not noops?** Components override `getInputProps` (the noop) to add their own props. If the front GI replaced `getInputProps`, any component that overrides it would skip the front GI layer — breaking the pipeline silently. By overloading the **default**, all components calling `this.defaultGetInputProps()` get the front GI adaptations automatically.

Chain: `core.defaultGetInputProps` → `frontGI.defaultGetInputProps` (overload) → `component.getInputProps` (override). No extra links, no hidden dependencies.

## $vModelChildProp / $vModelChildEvent

When the FW component uses different prop/event names than Vue 3 standard (`modelValue`/`onUpdate:modelValue`), declare in front GI:

```js
$vModelChildProp: "defaultValue",    // what the FW component expects as value prop
$vModelChildEvent: "onUpdate:value", // what the FW component emits on change
```

These are read by vModel mixin in `vModelProps()` and `vModelListeners()`. When `native === "standard"`, both are ignored — uses Vue 3 standard v-model (modelValue/onUpdate:modelValue). Use for targeting our own Vue components (DoubleCheck, composite children like TimeFrame's ItdSelects).

**Important**: these values are FW-specific. Each FW has its own conventions — `value`/`onUpdateValue`, `modelValue`/`onUpdate:modelValue`, `defaultValue`/`onChange`, etc. There is no universal pattern.

### 🔴 PRINCIPIO: formatter de entrada + FW con modo controlled/uncontrolled por prop ⟹ el componente NO debe auto-gobernarse

**Regla general** (no es caso NUI ni caso Rut): si el FW de componentes soporta elegir el modo por prop
(NUI: `defaultValue` = el componente se auto-gobierna con estado interno / `value` = el padre gobierna el
display), entonces **todo input cuyo formatter reescribe el texto visible DEBE bindearse por `value`** —
el componente sin control propio.

**Por qué — es estructural de NUESTRO flujo, no preferencia**: el FW no usa v-model; la alimentación del
display es **imperativa** (GI muta `validateSelfValue`, el render lo pasa como prop) y el GI solo ESCUCHA
los eventos del input. No hay reactividad completa de ida y vuelta. ⟹ Si el componente se auto-gobierna
(`defaultValue`), las mutaciones de `validateSelfValue` (applyFormat al blur, resets, controllers) **no
tienen ningún canal hacia el display**: el formatter corre pero el formato jamás se inyecta. Formatter
imperativo + componente auto-gobernado = formato invisible, siempre.

**⚠️ Trampa de terminología (espejo)**: "el componente debe quedar *uncontrolled*" (sin control propio,
perspectiva del componente) ≡ "*controlled*" en jerga React (el padre controla via `value`). Misma cosa,
perspectiva opuesta. En este FW: **bindear por `value` = lo correcto para formatters**.

**Contexto**: NUI es un FW de componentes con modo de binding por prop (otros FW tienen un binding único), por eso los componentes core no lo contemplan. El default del GI NUI es `defaultValue` (auto-gobernado: mejor UX de tipeo — sin saltos de
cursor/IME/churn) y el binding por `value` es opt-in por componente. Es seguro gracias a `lazyFormatter`:
en tipeo el echo es identidad (cursor quieto), el formateo corre al blur.

**Síntoma**: "el formatter corre pero no se ve" → ItdRut sin espejo NUI no
formateaba. `ItdStringNUI`/`ItdRutNUI` existen exactamente para el opt-in (único contenido:
`$vModelChildProp: "value"`). Checklist al traer un componente con formatter visible a un FW con modo por
prop: declarar el binding por `value`. (Pendiente de diseño: factorizar a flag del core — "tiene formatter
visible" — en vez de archivo-espejo por componente.)

**Corolario doble filo**: el binding por `value` muestra lo bueno Y lo malo — el bug `"undefined"` de
ItdString (formatter sin guard stringificando `${undefined}`) era visible justamente por esto. Formatter
de componente con binding `value` SIEMPRE con guard para el caso vacío (`if (v == null) return v`).

## attrs → inputProps

In native HTML and wrapper-based FW (BV), `attrs` spread directly to the input element. In component-based FW where the input is wrapped internally, `attrs` land on the wrapper component, not the native `<input>`.

The front GI overloads `defaultGetInputProps` to pass `attrs` through the FW's passthrough mechanism (e.g., `inputProps` in NUI, `input-attrs` in others):

```js
defaultGetInputProps(displayVar) {
  const props = CoreMethods.defaultGetInputProps.call(this, displayVar);
  props.inputProps ??= {...this.attrs};
  props.inputProps.autocomplete = this.localAutocomplete;
  return props;
}
```

## Validation Status

Map `validateState` (boolean) to the FW's status system via `handleValidateErrors`. Put status in `attrs` so it's included in the spread via `defaultGetInputProps` automatically:

```js
handleValidateErrors(errors) {
  if (this.mode !== "input") return;
  this.attrs.status = errors.length === 0 ? "success" : "error";
}
```

No per-component override needed — all components get status via the existing `attrs` spread.

## Event Binding

- FW components may emit **value directly** (not Event) → extractEventValue returns as-is
- Native inputs emit **Event** → extractEventValue reads `event.target[targetValue]`
- Each FW has its own conventions — check docs for the specific event name and payload format

## Extra Objects Pattern (Composite Inputs)

Core defines empty extension-point objects in data, spreads in form computed.
Front overrides only these objects with framework-specific config:

```jsx
// Core data():   measureInputExtra: {}
// Core computed:  { ...this.measureInputExtra }
// Front data():  measureInputExtra: {tag: "n-select"}
```

Keeps core framework-agnostic. Front injects FW-specific props without touching form logic.
