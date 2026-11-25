# Sistema de columnas del form — container-driven (NO viewport)

El layout de forms del FW NO usa breakpoints nombrados (sm/md/lg/xl). Esos miden **viewport**
(pantalla); nosotros medimos el **container** (ResizeObserver sobre el row del form). La pregunta
del FW nunca fue "¿en qué pantalla estoy?" sino **"¿cuántas columnas me caben acá adentro?"**.
Importar nombres de viewport a un problema de container era vocabulario prestado de BV/Bootstrap.

## Dónde vive (core ≥ 7.3): la lógica en el core, la piel en el front

| Pieza | Capa | Qué hace |
|---|---|---|
| `colWidth`, `fit`, `currentCols`, `_setupResize`, `getColSpan(input)` | **core** `lib/GenericForm.jsx` | mide el container y calcula N y el span de cada campo |
| `getRowProps()` / `getColProps(input)` | core: CSS grid (`repeat(N, minmax(0, 1fr))`, `grid-column: span X`) · NUI: `n-grid` (`cols`) / `n-grid-item` (`span`) | solo pintan lo que el core calculó |
| tope de ancho con `fit` | GIW del core | `max-width: colWidth * span` |

Un front nuevo pisa `getRowProps`/`getColProps`/`getButtonsRowProps` con su grilla y nada más.

🔴 **El layout que envuelve al form tiene que poder achicarse**: si un ancestro es un item de grid con su columna
implícita (`auto`), crece al ancho mínimo de su contenido, el form mide ese ancho, pide N columnas y ensancha la
página que mide (ciclo). El `App.vue` del core fija `grid-template-columns: minmax(0, 1fr)` en sus tres grids.

## Las dos perillas del GF (props + specs)

| Prop | Default | Qué controla |
|------|---------|--------------|
| `colWidth` | `280` (px) | ancho ideal de UNA columna → **cuántas columnas caben** (emergente) |
| `fit` | `true` | el input mide `colWidth` (no se estira) vs `fill` (llena el slot) |

**El dev define el ancho de columnas de DOS formas, intercambiables:**
- **Vía specs (back / origen back)**: el form trae su `colWidth`/`fit` en las specs.
- **Vía prop directa**: `<ItdForm colWidth={200} fit />` — cualquier dev acota el ancho sin tocar el back.

El layout de columnas es **libre**: el ancho de columna es declarativo y el N
de columnas emerge de la división (no hay un grid fijo).

## colWidth → cuántas columnas (N)

```
N = max(1, floor(containerWidth / colWidth))
```

Un solo número (`colWidth`) y una división. Sin tabla de breakpoints. Container 1876px / 280 ≈ 6
columnas; un drawer de 560px / 280 ≈ 2; un embedded angosto → 1. Todo sale del mismo principio.
Escala infinita gratis: un 4K mete más columnas sin tocar nada (no hay techo, solo una división).

`colWidth` casi nunca se toca: el caso común (form ancho) sale solo. Solo forms angostos/densos
(un drawer, un panel) lo declaran (`colWidth: 150`).

## cols (span del input) — 4 reglas

`cols` es del INPUT (cuántos slots ocupa), NO confundir con `colWidth` del form (ancho de columna).
NO hay escala de 12 — la unidad es "columnas que caben", no un grid fijo.

| `cols` | Regla | Span en grid de N |
|--------|-------|-------------------|
| ausente | — | `1` slot (lo mínimo) |
| `≤ 1` | proporción % | `round(N × cols)` (`1` = 100% = toda la fila; `0.5` = mitad) |
| `> 1` (entero) | cantidad de columnas | `min(cols, N)` (capeada a las que caben) |
| objeto `{N: valor, "*": fallback}` | por columnas-que-caben | match EXACTO de N → su valor (interpretado por las reglas de arriba); `*` comodín |

**Asimetría clave**: *ausente = 1 slot* (lo mínimo) vs *`cols:1` = 100%* (la unidad ES el todo).
Son opuestos a propósito: "no me dijiste nada → mínimo" vs "me dijiste la unidad → todo". Ejemplo
de layout: `name` sin cols (1 col, tamaño humano) + `value` con `cols:1` (full → baja a su fila y
empuja lo que sigue).

Ejemplo objeto (config `code`): `{1:1, 2:1, 3:2, "*":0.5}` → con 1-2 columnas usa 100%, con 3 usa
2 de 3, con 4+ usa 50%. Code ancho cuando hay poco espacio, comparte cuando sobra.

## fit — ancho del input dentro del slot (NO toca el grid)

`fit:true` (default): el input mide `colWidth` y NO se estira; el sobrante del slot queda libre.
`fit:false`: el input llena el slot (fill).

- **El grid NUNCA cambia** por fit. El slot sigue siendo su tamaño; lo que cambia es el ancho del
  INPUT dentro del slot (el GIW le mete `max-width:colWidth` o lo deja `flex:1 1 auto`).
- Elimina el "salto" elástico: con fill, al crecer la pantalla cada columna se estira hasta que
  entra una nueva y todas saltan; con fit las columnas no cambian de ancho, solo aparece una nueva.
- **`input.fit` (back) manda sobre el `fit` del form** — misma precedencia que el resto: el back
  declara por campo, el form pone el default. Per-GI gratis (cada GIW decide su ancho).

## Contenedores: cols:1 + fit:false (declarado en el back)

Embedded (Subdocument) y ArrayForm (DocumentArray) NO son inputs escalares — son **sub-forms con
su propio grid adentro**. Su ancho debe ser el slot completo, no `colWidth`. Por eso `z99base`
les setea `cols:1` (100%, full-width) + `fit:false` (sin cap). Si tuvieran `fit:true`, el GIW les
pondría `max-width:colWidth` → estrangularía el grid interno.

`empty` también se declara ahí (`Array`/`DocumentArray` → `empty:[]`); es del pipeline de valor
(ver [value-pipeline.md](value-pipeline.md)), no del layout, pero viaja por el mismo mecanismo
de defaults del type.

**Capacidad extra (combo cols:1 + fit en un AF)**: un ArrayForm con `cols:1` usa todo el ancho
(full-width), pero con `fit:true` sus campos internos no se estiran — si tiene 3 campos chicos, no
queda un AF gigante de columnas enormes; cada input mide su `colWidth` y el resto queda libre.

## filterWidth — ancho del drawer del filter + cascada por nivel

`ItdGrid` recibe `filterWidth` (default `300`, px) = ancho del drawer de filtros. Se propaga:
`ItdGrid → ItdFilter → GIWFilter (sub-drawer)`. Cada nivel de anidamiento resta **10px** (efecto
cascada estilo Finder: principal 300, sub-drawer 290, sub-sub 280…).

El `-10` viaja por **provide/inject** (mismo patrón que `model`/`contextType`): `ItdFilter` resuelve
`localFilterWidth = filterWidth(prop) ?? filterWidthLevel(inject) ?? 300`, y **provee**
`filterWidthLevel = localFilterWidth - 10` a su subtree. El raíz lo recibe por prop (de ItdGrid),
los anidados lo heredan ya decrementado. El inject cruza el slot del sub-drawer (el sub-form va como
`$slots.default`, el GIWFilter no controla sus props → provide es el puente).

## n-ellipsis en celda de grilla — NO envolver inputs editables

El render de celda del `ItdGrid` envuelve el contenido en `<n-ellipsis>` para truncar TEXTO (modo
view/display). Pero el `n-ellipsis` es inline-block content-sized: **estrangula a `width:0` cualquier
input sin ancho intrínseco** (un select sin valor — el placeholder no aporta ancho → colapsa,
desaparece visualmente aunque siga montado).

Regla: en modo **input** (arrayForm editable) → render directo SIN `n-ellipsis` ni width forzado, el
GI se despliega como en cualquier container (ancho natural de la celda). En **view/detail** → con
`n-ellipsis` (trunca texto). Condición: `viewType === "input" ? result : <n-ellipsis>{result}</n-ellipsis>`.
NO forzar `width:100%` al input (100% de un ellipsis de 0px sigue siendo 0; y estira de más) — la
solución es SACAR el obstáculo (el ellipsis), no imponer ancho.

## ⚠️ Edge PENDIENTE de verificar: fit más ancho que el container

Si un input declara un `cols`/ancho que excede el container (ej. `fit` con un colWidth mayor al
ancho disponible), ¿qué pasa? Debería acotarse al container (no desbordar). Se cree resuelto por el
`min-width:0` del wrapper, pero **falta probarlo en vivo**. Verificar antes de darlo por cerrado.

## Grilla (`ItdGrid` NUI): columnas de infraestructura vs columnas de datos

🔴 **Un campo `_XXX` (y `docLink`) es de INFRAESTRUCTURA**: su ancho es fijo y no se reparte el sobrante. Las de
selección y expandir también (40 y 30 px, las pone `buildColumns`). Las columnas de **datos** absorben el sobrante.

**Cómo se calcula el ancho de una columna de datos** (`buildColumns`): el título TRADUCIDO que se pinta (el `ItdT`
del encabezado lo reporta por `onChange` y el computed se recalcula) medido con canvas en la fuente real del `th`,
+ 24 de padding + 15 si ordena + 36 si filtra + 15 si tiene popup; `field.width` lo pisa. `scroll-x` es la suma de todos.
🔴 **El contenido de las celdas NO entra en la cuenta, a propósito**: si el ancho siguiera al dato,
cada página movería las columnas de lugar. Lo que no cabe va con `n-ellipsis`, que se toca (celu) o se apunta
(laptop) para verlo completo. Vale igual para el detalle de una fila.

🔴 **`width`, no `minWidth`**: con `table-layout: fixed` el navegador **ignora el `min-width`
de un `<col>`**; una grilla que desbordaba repartía el ancho por partes iguales (todas a 156 px, títulos partidos y
celdas cortadas). Cada columna de datos lleva `width: <su ancho / scroll-x>%`, y la ÚLTIMA va sin `width`: cuando la
tabla desborda (mide `scroll-x`) cada una mide exactamente su ancho calculado; cuando sobra espacio crecen en
proporción y la última se queda con el resto. La infra conserva su `width` en px (si TODAS fueran px, el sobrante se
repartiría también al checkbox). Chrome ignora un `calc(% - px)` en el ancho de un `<col>`: solo porcentaje puro.
Una columna de datos con `fixed` (pegada) queda en px: n-data-table necesita el número para su posición.
Posición: selección y expandir van `fixed: "left"` y `_update`/`_delete` traen su `fixed` desde el back.
`docLink` NO es `fixed` a propósito: sin una vista apilada de la tabla, otra columna pegada gasta demasiado espacio.

Para probarlo: un modelo de prueba con 2 campos (la grilla sobra y se ve el reparto) y otro con muchas columnas
(no cabe y aparece el scroll).
