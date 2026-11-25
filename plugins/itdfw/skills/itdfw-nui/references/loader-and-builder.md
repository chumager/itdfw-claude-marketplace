# El loader de `$NUI` y el `NUIBuilder` — el código

> El contrato corto vive en `SKILL.md`. Aquí está cómo lo hacen el loader y el builder, para entender por qué un tag no
> rinde o por qué un archivo en `src/NUI/` desaparece.

## El loader (el `init` de NUI)

Convierte cada nombre declarado en `$NUI` a kebab y lo registra global con **import dinámico**:

```js
this.addLoader("$NUI", (_comp, value) => {
  const name = `n-${toKebab(value)}`;
  if (NUI.has(name)) return;                                            // dedup global
  this.base.component(name, self.resolveTag(() => import(`./NUI/N${value}.js`)));
});
```

- El dedup es un `Set` del loader: declarar `"Button"` en diez componentes registra uno.
- El import dinámico es lo que hace que el bundle cargue solo lo declarado; importar el módulo directo lo mata y rompe
  el tree-shake.

### Los componentes que Naive reconoce por una marca

`RadioButton`, `Tab`, `TabPane`, `GridItem`, `FormItemGridItem` y `CarouselItem`: el padre de Naive mira `type.name` o
una marca (`__TAB_PANE__`/`__GRID_ITEM__`) en el componente real, y con el envoltorio async los descartaría sin error o
perdería el estilo de grupo. Por eso el `init.js` de NUI los registra **sin** `defineAsyncComponent`, desde su lista
`NO_ASYNC_WRAPPER`. Si aparece otro padre de Naive con ese síntoma (hijos descartados sin error, estilo de grupo
perdido), se suma a esa lista con su marca y la línea de naive-ui que la lee.

## El `NUIBuilder`

```js
const dir = "./src/NUI/";
await fs.remove(dir);                                    // 🔴 borra la carpeta ENTERA
// lee node_modules/naive-ui/dist/index.mjs, toma el export {...} final
const names = exportMatch[1].split(",")
  .map(s => s.trim().split(/\s+as\s+/).pop().trim())
  .filter(n => /^N[A-Z]/.test(n));                       // 🔴 SOLO componentes N + Mayúscula
```

Un archivo puesto a mano en `src/NUI/` desaparece en la próxima corrida, y si no matchea `N[A-Z]` tampoco se regenera.
Los `use*` de Naive (`useThemeVars`, `useDialog`, `useMessage`) quedan fuera por diseño: son composables, no
componentes.

## Por qué `useThemeVars` no resuelve desde un site

No lo genera el builder, y `naive-ui` no resuelve desde un site: pnpm es estricto y el paquete vive en `node_modules`
del front, no del site. Instalarlo en el site arriesga **dos copias de Naive**, con dos contextos de tema que no se
hablan.

## Las `--n-*` de un componente

Naive las computa **por instancia** y las expone en el root de ESE componente (`src/card/src/Card.tsx`). No son
globales: `var(--n-error-color)` en un `<div>` suelto no resuelve. Para un elemento nativo, `n-element` (ver
`SKILL.md` §4), que además entrega `styleScheme` por slot si se necesita en JS.
