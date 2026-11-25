# Las barras y el store `app` — el detalle

> El contrato corto vive en `SKILL.md` §5. Aquí están el ejemplo completo, la tabla del store, las celdas y zonas, la
> base del drawer, el menú y las opciones con descripción.

## El ítem completo

```js
pack.push([function myNavItem() {
  this.store.commit("app/setNavItem", {
    key: "translate-edit",                  // identidad: con la misma key REEMPLAZA en su lugar; removeNavItem(key) la saca
    component: "ItdEditToggle",             // resuelto por resolveTag (prefijo Itd), vive en la cascada
    props: {},                              // opcional
    sink: "nav",                            // sink o arreglo de sinks donde va (default "nav"); cada sink pinta lo suyo
    position: "last",                       // first | center | last (tramo)
    pos: "^",                               // opcional: ^ al inicio del tramo, $ al final; sin pos, orden de llegada
    when: ({store}) => store.state.auth.auth, // opcional; si existe, reactivo
    class: ({sink}) => `mine-${sink}`,       // opcional: string, objeto o función; va a la CELDA del ítem
    style: ({sink}) => (sink === "nav" ? undefined : "grid-column: 1 / -1;") // opcional, igual que class
  });
}]);
```

El core trae una base que reproduce la barra de siempre; el site la borra, la condiciona o la pisa. Si saca el login,
no hay login: la herramienta es nuestra, la decisión es suya.

## Celdas y zonas

**Cada ítem vive en su celda** (`div.itd-nav-cell`, con `data-nav-key` = su `key`), que toma su `class` y su `style`:
es la libertad del front dev (un botón a todo el ancho, una celda de dos espacios). **Cada zona trae su wrapper del
store** (`app.zones[sink][position] = {class, style}`, misma firma que los ítems): el sink lo pinta sin nada escrito en
duro, y `setZone({sink, position, class?, style?})` mezcla solo lo que declaras.

**Base del drawer:** celdas iguales que bajan solas (`repeat(auto-fill, minmax(7rem, 1fr))`; `last` en 5rem para que
Home, la bandera y el modo oscuro quepan en una fila), con el contenido centrado. `menu` e `inNav` declaran
`grid-column: 1 / -1; justify-items: stretch` fuera de la barra de arriba, y los atajos se ponen `block` y de tamaño
normal fuera de ella. Un ítem con `component: "_sep"` pinta `ItdNavSep` (vertical en la barra, horizontal en el drawer y
el lateral).

**Otro sink u otro aspecto de uno:** un componente propio por cascada con la misma prop. `App` pinta cada sink
(`ItdNav`, `ItdSide`, `ItdDrawer`) con su nombre por prop (`<ItdNav sink="nav">`) cuando el sink existe.

## El store `app`

| Store `app` | Qué es |
|---|---|
| `breakpoints` | anchos mínimos en **px CSS** (no físicos): `xs` 0 · `s` 360 · `m` 600 · `l` 900 · `xl` 1280 · `2xl` 1600 · `3xl` 1920 · `4xl` 2560 · `5xl` 3840; se pisan con `setBreakpoints` |
| `display` | sinks que existen por breakpoint, mobile-first (vale hacia arriba hasta la próxima declaración). Base `{xs: ["nav", "drawer"], xl: ["nav"]}`; `setDisplay` |
| state `breakpoint` · `touch`; getters `app/atLeast(nombre)`, `app/sinks` | el tramo actual, el puntero táctil, "¿es al menos este tramo?" (por orden, no por px) y los sinks que existen ahora. **Utilidad general** para cualquier componente o app. El core los mantiene (un `ResizeObserver` sobre la página que hace commit **solo al cambiar de tramo**, y `matchMedia("(pointer: coarse)")`). No hay ancho en px en el store, a propósito: quien lo necesite lo mide él |
| `navItems` | la base: `hamburger` · `logo` · `menu` · `inNav` (`first`), `register` · `auth` · `home` · `user` · `flags` · `dark` (`last`) |
| `menu` · `setMenu` | `{options, ref, inNav, optionsTranslation, minMatchingChars}`: el select del menú (un `ref` le gana a `options`), las coordenadas con que se traducen sus opciones y desde cuántas letras pregunta un `ref`, y los atajos de las funciones `inNav` que `checkLogin` llena siempre (crudos; `ItdNavShortcuts` los traduce con `interfaceTranslation`). Una fuente nueva viaja con su `optionsTranslation` y su `minMatchingChars`: sin ellos se pinta cruda. Auth limpia `options` e `inNav` |
| `zones` · `setZone` | el wrapper (`class`, `style`) de cada zona `first`/`center`/`last` de cada sink `nav`/`drawer`/`side`; string, objeto o función del contexto |
| `drawerOpen` · `setDrawer` | el drawer (`ItdDrawer`): lo abre la hamburguesa; se cierra solo al navegar |

Los componentes de la base (`ItdNavHamburger`, `ItdNavLogo`, `ItdNavRegister`, `ItdNavAuth`, `ItdNavHome`,
`ItdNavUser`, `ItdLangFlags`, `ItdDarkSwitch`) se pisan por cascada o se cambian en el ítem.

## El menú

`ItdMenu` es un receptor puro: un select con filtro que lee `app.menu` (`ref` si hay uno, si no `options`), navega a la
ruta elegida y se vacía. `checkLogin` enchufa las funciones del usuario en `options` solo si nadie enchufó `options` ni
`ref` antes. Las coordenadas de traducción de una interfaz: `{context: "Interface", text: "name-{{value}}",
description: "description-{{value}}"}`. Tiene una sola presentación: otra (un ícono que abre un modal, un atajo de
teclado) es un componente propio en el ítem `menu`.

## Una opción con descripción (todo `ItdSelectNUI`)

La lista desplegable mide lo mismo que el selector (el `consistent-menu-width` de `n-select`, por omisión) y la
descripción va en UNA línea, tenue, cortada con `n-ellipsis`; el texto completo sale en un tooltip a la derecha. Es a
propósito: si la lista creciera con el contenido, una descripción larga la dejaría ultra ancha y se perdería la elipsis.

## Bloques de la vista

`setViewBlock` no se junta con `setNavItem`: cambian por razones distintas. Primer consumidor: la fila de KPI.
