# Render Methods

## default/noop Pattern

Every method pair: `defaultX()` (logic) + `X()` (calls default).
Override `X()` for replacement, or call `this.defaultX()` + wrap/extend.

## Render Methods

| Method | ViewType | Default behavior |
|--------|----------|-----------------|
| `renderInput()` | `"input"` | **GI**: noop → `defaultRenderInput()`. **GF**: mode switch (see below) |
| `renderView()` | `"view"` | Formatted value with left/right, or link |
| `renderDetail()` | `"detail"` | `<pre>` with raw value |
| `renderFilter()` | `"filter"` | Same as renderInput |
| `renderPlain()` | `"plain"` | renderView, or JSON if complex |

ViewTypes: `["input", "view", "detail", "filter", "plain"]`

## 🔴 renderView casi NUNCA se pisa — el default ES el pipe view+detail

`defaultRenderView()` resuelve solo TODO el contexto grilla; pisarlo mata el pipe completo:

```
renderView() → defaultRenderView()
  ├─ localDetail (= input.detail ?? hasDetail) decide el branch
  ├─ SIN detail → ViewTag: localLeft + formatter(value) + localRight
  └─ CON detail → LinkTag (botón vivo):
       ├─ texto = tableViewDisplay → getDefaultTableViewDisplay:
       │    Array → length · Number → directo (compactArrays del back) · nullish → "" · resto → "Ver"
       └─ click → this.click(e) + $emit("toggleDetail")   ← el despliegue del detail
```

**Pa un componente compuesto (ArrayForm, Embedded) basta `hasDetail: true` en data** — el default ya
muestra "Ver"/count clickeable y emite el toggle. Los puntos de extensión FINOS son los datos que el
default consume (`tableViewDisplay`, `viewTag`, `localLeft/localRight`, `formatter`), NO el método.
Error típico: override de renderView con un `<span>` estático → botón vivo reemplazado por
texto muerto, detail inalcanzable.

### 🔴 gTVV en la CELDA (grilla): formato COMPLETO desde el CRUDO

En la celda de grilla el display sale de `getTableViewValue`, y ahí el componente cuyo formato de input
DESPLAZA parte del formato a `left/right` debe override-arlo con el formato COMPLETO. Caso Number/
Percentage: el input separa el símbolo (`afterSetNumberData` manda el `%` a left/right, el formatter del
valor va con `style: undefined`) → la celda salía con precisión pero SIN símbolo. Fix canónico
(ItdNumber.gTVV): **`vModelValue` CRUDO → Intl con `numberFormatStyle()` completo** (style "percent"
pone el símbolo Y multiplica ×100 solo — cero pipeline EV/VSV/VSR, cero scale, cero herencia al gTVV
del GI: pa un escalar numérico ninguna de sus ramas aplica).

**Por qué**: Number/Percentage es el ÚNICO componente que enchufaba formato en left/right —
Currency no lo necesita porque su VO formatea COMPLETO en view (tableViewValue con símbolo incluido).
Regla: si tu input desplaza formato a los LADOS, tu celda necesita SU gTVV con el formato entero.

**Precisión de tasas**: Percentage `precision` default 4 declarable, piso
visual 2 — y es SOLO display: la tasa operacional es raw sagrado (sin VO/caster a propósito — las
definiciones no se redondean; ver skill DDD §qué cierra y qué no).

## renderInput() — GI vs GF

**GI** (GenericInput): noop, solo llama `defaultRenderInput()`. No sabe de modes.

**GF** (GenericForm): overridea renderInput con mode switch:
- `mode === "form"` → `renderForm()` (formulario standalone con FormTag, RowTag, formLayout)
- `mode === "input"` → wrapper de validación (`is-valid`/`is-invalid`) + `defaultRenderInput()` (GF como input dentro de un form padre)

Esto significa que TODOS los GF con `mode: "input"` (TimeFrame, ArrayAdd, ArrayForm, CheckboxGroup, Between, etc.) tienen automáticamente el borde de validación visual. No necesitan override manual en front.

## rootTag — Tag root configurable

GI render() usa `rootTag` (default `"div"`) como tag del elemento raíz del componente:

```jsx
render() {
  const [RootTag] = this.resolveTags(["root"]);
  return (
    <RootTag class={this.GIClass} style={this.GIStyle}>
      {this.renderContent()}
      {this.slotOrRender("extra")}
    </RootTag>
  );
}
```

Override `rootTag` en data para cambiar el root element (ej: SubdocRow usa `rootTag: "tr"`).

## innerGroupTag null — Sin wrapper en GFMin

GFMin `renderFormGroup` soporta `localGroupTag: null` para renderizar sin wrapper:

```js
// data: { innerGroupTag: null }
// → renderFormGroup retorna content directo, sin GroupTag wrapper
```

Útil para ArrayForm donde los SubdocRows no necesitan wrapper (van directo en tbody).

## renderMainInput()

Resolves `localTag` → `resolveComp` → renders `<Tag ref={el => (this.inputRef = el)} {...spreadProps} />`.

The callback ref assigns the rendered DOM element or UI-lib component instance to `this.inputRef`. Use for imperative DOM/VNode access — `this.inputRef.blur()`, `.focus()`, `.scrollIntoView()`, etc. **No es un GI** — GI no es recursivo, el inputRef apunta al input nativo final (HTML element o componente del UI lib), nunca a otro GI. Composite validation va por otro path (`$refs.inputs` del GF padre, no por aquí).

**Why callback ref, not `ref="input"` string**: Vue 3 wraps async-resolved components in `AsyncComponentWrapper`. String refs in a child's render get trapped on the wrapper instead of propagating to the real component. Callback ref captures `this` via lexical closure when the arrow is created (inside the real component's method) → assigns to the real component regardless of wrapper.

Example: `ItdSelect.handleSearch` calls `this.inputRef.blur()` to close the dropdown after auto-assign.

## Props Override Pattern

`defaultGetInputProps()` returns base props: state, size, disabled, readonly, value binding.
`getInputProps()` calls the default — override this to add custom props.

**CRITICAL**: ALWAYS spread the default first:

```jsx
getInputProps() {
  return {
    ...this.defaultGetInputProps(),  // preserves state, size, disabled, readonly, value
    myCustomProp: myValue
  };
}
```

**NEVER** return a new object without the spread — breaks state, value binding, disabled/readonly.

## resolveTags

Framework-agnostic tag resolution:

```jsx
const [LinkTag] = this.resolveTags("link");
```

Agrega "Tag" suffix automáticamente: `resolveTags("button")` → lee `this.buttonTag` de data.

Tags resolve from data → `defaultTagMap` (mutable by front).

**resolveTag** (global): `resolveComp(component).component`. Útil fuera de instancias Vue.
