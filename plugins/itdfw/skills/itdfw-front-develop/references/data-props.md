# GenericInput Data Props

Override in `data()` to configure GI behavior.

| Prop | Default | Purpose |
|------|---------|---------|
| `type` | `"text"` | HTML input type attribute |
| `tag` | (none) | Force specific tag. `"ItdForm"` for composite, `"input"` for native checkbox |
| `lazy` | computed | `true` = listen `change`, `false` = listen `input` |
| `valueProp` | `undefined` | DOM property for value binding. `??=` in getRenderProps → `"value"` (Vue2) or `"modelValue"` (Vue3) |
| `targetValue` | `"value"` | `event.target[X]` in extractEventValue |
| `left` | `""` | Text/symbol prepended to input |
| `right` | `""` | Text/symbol appended to input |
| `plaintext` | `false` | Render as plain text (no prepend/append) |

## Tag Resolution (`localTag` computed)

```
this.$attrs.tag || this.localInput.tag || this.tag || inputTag
```

- Core `defaultTagMap.inputTag` = `"input"` (native)
- Front mutates `defaultTagMap.inputTag` = `"BFormInput"` (Bootstrap-Vue)

## Event Resolution (`localLazy` computed)

🔴 **`forceLazy` va PRIMERO** (2026-07-13): si `this.forceLazy` es boolean, `localLazy` lo retorna
DIRECTO — veto declarativo que manda sobre todo el OR (en el OR "false no veta"; forceLazy sí). Detalle
y casos (ArrayAdd, Radio/CheckboxGroup NUI): value-pipeline.md §NESTED-LAZY.

Chain (si forceLazy es undefined): OR de `this.lazy` → `$attrs.lazy` (arrastre del padre, incl.
`childrenLazy` del GF) → `localConfig.lazy` → `attrs.lazy` — lazy manda, false no veta.

- `childrenLazy` es concepto del GF (el contenedor declara el lazy de sus HIJOS sin ser lazy él) →
  value-pipeline.md §NESTED-LAZY.

## Dónde vive cada pieza (por concepto)

- Core components: los `components/` del core front
- Front components: los `components/` de la librería de front
- Back type defaults: el type `z99base` del back
- ValidateSelf: el plugin `validateSelf` del core front
- GenericInput: el `GenericInput` del core front

## localImport Cascade

```
@ (site-specific) → default → plugins → itdfw (front) → core
```

6 name variants per level. Front found FIRST. HMR does NOT detect new files — restart vite.
