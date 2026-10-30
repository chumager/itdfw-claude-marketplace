# slotOrRender — Scoped Slots con Fallback a Render Methods

Global mixin disponible en TODOS los componentes Vue (registrado en init2.js via pack).

## Firma
```javascript
this.slotOrRender(name, extraScope, fallback)
```

- `name` — nombre del slot/render (ej: "view", "children", "prepend")
- `extraScope` — datos extra para el scoped slot además de `{vm: this}`
- `fallback` — valor si no hay slot ni renderMethod. Default: `null`

## Flujo de resolución
1. Vue 2: `$scopedSlots[name]` (función) → ejecuta con `{vm: this, ...extraScope}`
2. Vue 2: `$slots[name]` (VNode directo) → retorna directo
3. Vue 3: `$slots[name]` (siempre función) → ejecuta con `{vm: this, ...extraScope}`
4. `this.renderX()` donde X = name capitalizado → ejecuta con extraScope como arg
5. Retorna `fallback ?? null`

## Uso en GI — call sites (NO dentro de renderX)

```javascript
// En defaultRenderInput:
{this.slotOrRender("prepend")}
{this.renderMainInput(...)}
{this.slotOrRender("append")}

// En renderMainInput:
const children = this.slotOrRender("children", undefined, null);

// En renderContent:
return this.slotOrRender(viewType);  // "view", "detail", "input", "filter", "plain"

// En render():
{this.slotOrRender("extra")}
```

**CRITICAL: NUNCA usar slotOrRender DENTRO de renderX** — causa recursión infinita.
`slotOrRender("view")` busca `renderView()` como fallback → si está dentro de `renderView()` → loop infinito.

## Slots disponibles en GI

| Slot | Fallback | Donde se llama | Scope extra |
|------|----------|---------------|-------------|
| view | renderView() | renderContent | - |
| detail | renderDetail() | renderContent | - |
| input | renderInput() | renderContent | - |
| filter | renderFilter() | renderContent | - |
| plain | renderPlain() | renderContent | - |
| prepend | renderPrepend() | defaultRenderInput | - |
| append | renderAppend() | defaultRenderInput | - |
| children | renderChildren() | renderMainInput | - |
| extra | renderExtra() | render() | - |
| preInput | renderPreInput() | defaultRenderInput | - |
| postInput | renderPostInput() | defaultRenderInput | - |

## Uso desde template (SFC)

```html
<!-- Vue 2 -->
<ItdMyComponent :input="input" :value="value">
  <template v-slot:view="{vm}">
    <span>Custom: {{vm.validateSelfValue}}</span>
  </template>
</ItdMyComponent>

<!-- Vue 3 -->
<ItdMyComponent :input="input" :modelValue="value">
  <template #view="{vm}">
    <span>Custom: {{vm.validateSelfValue}}</span>
  </template>
</ItdMyComponent>
```

## Uso en componentes hijos (JSX)

```jsx
// ArrayAdd renderiza hijos con slot "child"
renderChildren() {
  return values.map((val, id) =>
    this.slotOrRender("child", {id, value: val, remove: () => this.removeRow(id)})
  );
}

// renderChild es el fallback si no pasan slot
renderChild({id, value}) {
  return <SubComp input={...} value={value} onInput={v => this.updateRow(id, v)} />;
}
```

## Pattern: GI como wrapper puro con slots

```html
<GI :input="miInput" :value="miValue">
  <template #input="{vm}">mi input custom</template>
  <template #view="{vm}">mi vista custom</template>
  <template #children="{vm}">mis hijos</template>
</GI>
```

Zero herencia, zero extends — puro template.
