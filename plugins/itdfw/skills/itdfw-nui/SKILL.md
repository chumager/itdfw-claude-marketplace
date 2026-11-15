---
name: itdfw-nui
description: Use when writing or modifying any component that renders Naive UI in ITDFW — n-card, n-tag, n-button, n-input, n-progress, n-timeline, or any n-* tag — including new site components, and whenever a component needs a color, a theme token, or asks how to avoid hardcoding colors.
---

# ITDFW + Naive UI

Naive UI **no se importa**. Se declara con `$NUI` y se usa por tag. Los colores **nunca** se
escriben: vienen del tema, y el tema vive en la base de datos.

## Quick reference

| Necesitas | Haces | NUNCA |
|---|---|---|
| usar `n-card` en tu render | `$NUI: ["Card"]` en el componente | `import ... from "naive-ui"` ni de `itdfw/NUI/*` |
| color por estado | `type`/`status` semántico (`success`/`info`/`warning`/`error`) | un hex, un rgb, un nombre de color |
| un token del tema en un elemento nativo | `n-element` + `var(--error-color)` (§4) | inventar un wrapper en `NUI/`; `useThemeVars` NO está disponible |
| nombrar el componente | prefijo `Itd` (`ItdSectionCard`) | `SectionCard` |
| idioma del código | inglés camelCase en identificadores, funciones, variables, comentarios; español solo en textos visibles (vía traducción) | `const tarjetas = ...`, `function cargarOfertas()` |
| un `index.html` propio del front (más vistoso) | ponerlo junto a su `src/main.js`: gana el `root`; `public/` igual se suma por cascada (`itdfw-front-app` → `vite-setup.md`) | un `index.html` sin su `main.js` al lado; espacios dentro de `#app` (matan el splash `:empty`) |

## 1 · El contrato: `$NUI` declara, el loader registra

```js
export default {
  name: "ItdSectionCard",
  $NUI: ["Card", "Tag", "Progress"],
  render() {
    return <n-card><n-tag type="success">Completa</n-tag></n-card>;
  }
};
```

El loader de NUI (su `init`) convierte cada nombre a kebab y lo registra global
con **import dinámico**:

```js
this.addLoader("$NUI", (_comp, value) => {
  const name = `n-${toKebab(value)}`;
  if (NUI.has(name)) return;                                            // dedup global
  this.base.component(name, self.resolveTag(() => import(`./NUI/N${value}.js`)));
});
```

Consecuencias que hay que tener presentes:

- **El nombre que declaras es el de Naive sin la `N`**: `"InputGroupLabel"` → `<n-input-group-label>`.
- **Import dinámico ⟹ el bundle solo carga lo que se declara.** Importar el módulo directo mata ese
  lazy y rompe el tree-shake.
- **El dedup es global** (un `Set` en el loader): declarar `"Button"` en diez componentes registra uno.
  Declarar de más no cuesta nada; declarar de menos deja el tag sin registrar.

🔴 **NO existe "auto-import global de Naive UI".** Es la invención más común y la más cara: produce un
componente que compila y no rinde, sin error que apunte a la causa. Si un `n-*` no aparece en pantalla,
lo primero que se revisa es si su nombre está en el `$NUI` de **ese** componente.

## 2 · `src/NUI/` es una carpeta GENERADA — jamás se escribe a mano

El `NUIBuilder` de NUI:

```js
const dir = "./src/NUI/";
await fs.remove(dir);                                    // 🔴 borra la carpeta ENTERA
// lee node_modules/naive-ui/dist/index.mjs, toma el export {...} final
const names = exportMatch[1].split(",")
  .map(s => s.trim().split(/\s+as\s+/).pop().trim())
  .filter(n => /^N[A-Z]/.test(n));                       // 🔴 SOLO componentes N + Mayúscula
```

⟹ Un archivo que pongas ahí **desaparece** en la próxima corrida, y si no matchea `N[A-Z]` tampoco se
regenera. Los `use*` de Naive (`useThemeVars`, `useDialog`, `useMessage`) **no están** y no los agregues
tú: son composables, no componentes, y el builder los filtra por diseño.

## 3 · El tema viene de la BASE DE DATOS — por eso el color no se toca

El front NUI es un FWPlugin que trae el tema consigo; absorbió al viejo
`plugins/nui-theme`. Un site que tiene NUI tiene el tema, sin declarar nada más:

| Pieza | Qué hace |
|---|---|
| modelo `ThemeNui` | los **102 tokens de `common`** de Naive, en `light` y `dark`, con `default` = el valor real del tema de Naive. Editables con `ItdColor`/`ItdCSS` |
| `db.setConfigDefinition("NUITheme", {ref: "ThemeNui"})` | cada deploy elige su tema por config |
| punta `/APP/theme.json` | anónima (`isAnonymous`, `noProfile`), devuelve `{name, light, dark}` |
| `src/injections/App.js` | pide el tema en `created` y lo mergea en `themeOverrides.common` del `n-config-provider` |

⟹ **Un admin edita los 102 tokens y todo Naive se re-tematiza solo.** Un color escrito en un
componente es un agujero en ese sistema: ese pedazo de UI deja de responder al tema del cliente.

Por eso los estados se expresan en **semántica**, que es lo que `type`/`status` consumen:

| Semántica | Significa |
|---|---|
| `success` | completa · al día · aprobado |
| `info` | en curso · en revisión |
| `warning` | pendiente · por vencer |
| `error` | observada · vencida · rechazada |

## 4 · Cuando necesitas un token de color (y no hay `type` que sirva)

Caso típico: un borde de "error" en un `n-card`, que no tiene variante semántica.

**`useThemeVars` NO está disponible** — no lo genera el builder (§2) y `naive-ui` no resuelve desde un
site (pnpm es estricto: el paquete vive en `node_modules` del front, no del site).

**`n-element` es el wrapper de transferencia de variables.** Vuelca `common` COMPLETO como CSS vars
sobre su propio elemento:

```jsx
$NUI: ["Element"]

<n-element tag="div" style={{border: "1px solid var(--error-color)"}}>
  {body}
</n-element>
```

- Nombre kebab **sin prefijo `n-`**: `errorColor` → `--error-color`, `textColor3` → `--text-color-3`.
- `tag` configurable (default `div`) → sirve para cualquier elemento nativo.
- También entrega `styleScheme` por slot, si lo necesitas en JS en vez de CSS.

⟹ Con esto un elemento nativo queda tematizado igual que un componente de Naive.

🔴 Las `--n-*` de un componente son otra cosa: Naive las computa **por instancia** y las expone en el
root de ESE componente (`src/card/src/Card.tsx`). No son globales — `var(--n-error-color)` en un `<div>`
suelto no resuelve.

🔴 Lo que NO se hace: agregar el composable al `NUIBuilder`, crear un wrapper a mano en `NUI/`, o
instalar `naive-ui` como dependencia del site (te arriesgas a **dos copias de Naive**, con dos contextos
de tema que no se hablan).

## 5 · Las barras y lo que va en ellas: el store `app` (NUI ≥ 7.2.0)

Los ítems de las barras viven en el **store del app**, no en inyecciones de `ItdNav`. Cualquier capa (core, front,
plugin, site) los agrega, reemplaza o saca con una mutación, desde un bloque de su `init.js`.

Las barras son **sinks** (`nav` arriba, `side` al costado, `drawer` el de la hamburguesa) y **todo** lo que se pinta
en ellas es un ítem, incluidos el logo, la hamburguesa, el login, el avatar, el modo oscuro y el menú. El core trae
una base que reproduce la barra de siempre; el site la borra, la condiciona o la pisa. Si saca el login, no hay
login: la herramienta es nuestra, la decisión es suya.

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

**Bloques de la vista (sobre y bajo la grilla):** mismo patrón para la vista de un modelo, fuera del layout de la
grilla. `this.store.commit("app/setViewBlock", {key, component, position: "above" | "below", props?})`, con
`removeViewBlock(key)`. La vista NUI pinta cada bloque con sus `props` y el `filter` vigente de la grilla. No se junta
con `setNavItem`: cambian por razones distintas. Primer consumidor: la fila de KPI (el plugin `kpi`).

Cada sink es un componente (`ItdNav`, `ItdSide`, `ItdDrawer`) que `App` pinta con su nombre por prop
(`<ItdNav sink="nav">`) cuando el sink existe, y que hace **`provide("sink")`**: un componente a cualquier
profundidad dentro del ítem sabe dónde está con `inject: {sink: {default: "nav"}}`. Otro sink o otro aspecto de uno:
un componente propio por cascada con la misma prop.

🔴 **`sink`, `position`, `pos`, `when`, `class` y `style` pueden ser funciones, con UNA sola firma**:
`({breakpoint, touch, store, route, atLeast, sink})`, donde `sink` es el sink que está pintando el ítem (`"nav"`,
`"drawer"`, `"side"`). Sin `this` bindeado: el contexto trae lo que hace falta. Lo que depende del ancho o del lugar se
escribe ahí (`pos` recibe además los ítems de su tramo). Ejemplo de la base:
`sink: ({atLeast}) => (atLeast("xl") ? "nav" : "drawer")` (arriba en escritorio, al drawer en lo chico).

**Cada ítem vive en su celda** (`div.itd-nav-cell`, con `data-nav-key` = su `key`), que toma su `class` y su `style`:
es la libertad del front dev (un botón a todo el ancho, una celda de dos espacios). **Y cada zona trae su wrapper del
store** (`app.zones[sink][position] = {class, style}`, misma firma que los ítems): el sink lo pinta y no escribe nada en
duro. Se cambia con `setZone({sink, position, class?, style?})`, que mezcla solo lo que declaras: pasar el drawer a
flex, cambiar el gap o el padding es una línea en el `init.js` del site. Base del drawer: celdas iguales que bajan solas
(`repeat(auto-fill, minmax(7rem, 1fr))`; `last` en 5rem para que Home, la bandera y el modo oscuro quepan en una fila),
con el contenido centrado; `menu` e `inNav` declaran `grid-column: 1 / -1; justify-items: stretch` fuera de la barra de
arriba, y los atajos se ponen `block` y tamaño normal fuera de ella. Un ítem con `component: "_sep"` pinta `ItdNavSep`
(vertical en la barra, horizontal en el drawer y el lateral).

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

**El menú** (`ItdMenu`) es un receptor puro: un select con filtro que lee `app.menu` (`ref` si hay uno, si no
`options`), navega a la ruta elegida y se vacía. `checkLogin` enchufa las funciones del usuario en `options` solo si
nadie enchufó `options` ni `ref` antes; un plugin o un site enchufa lo suyo con `commit("app/setMenu", {ref})` o
`{options: [{value, text, description, icon}]}` desde su `init.js`, crudo, y si sus opciones se traducen declara con qué
coordenadas (`optionsTranslation`; las de una interfaz: `{context: "Interface", text: "name-{{value}}", description:
"description-{{value}}"}`, como hace el plugin `typesafe-palette`). Tiene una sola presentación: otra (un ícono que
abre un modal, un atajo de teclado) es un componente propio que se pone en el ítem `menu`.

**Una opción con descripción** (todo `ItdSelectNUI`, no solo el menú): la lista desplegable mide lo mismo que el
selector (el `consistent-menu-width` de `n-select`, por omisión) y la descripción va en UNA línea, tenue, cortada con
`n-ellipsis`; el texto completo sale en un tooltip a la derecha. Es a propósito: si la lista creciera con el contenido,
una descripción larga la dejaría ultra ancha y se perdería la elipsis (jcmunoz, 29-sep-2026, commit `723042e9`).

🔴 Los textos propios de estos componentes se declaran con `t()` en `created`: un `t()` dentro del render declara una
Query por render y smart-fetch lo corta con error.

Reglas que el contrato blinda (el TDD de nav-items de NUI, enmienda 4, y el de menu):
- El store es reactivo: una mutación o un cambio de ancho repinta, sin recargar.
- `when` que revienta no tumba la barra: el ítem se omite y se loguea (`onDev`).
- Los slots `preMenu/postMenu` (alrededor de `first`) y `preRight/postRight` (alrededor de `last`) siguen.

## Red flags — si te ves haciendo esto, PARA

- `import {X} from "naive-ui"` en un site → no resuelve, y no es la vía.
- `import NCard from "itdfw/NUI/NCard.js"` → resuelve, pero mata el lazy y se salta el loader.
  🔴 **Única excepción: los componentes que Naive reconoce por una marca en el componente real** —
  `NTab`/`NTabPane` (`__TAB_PANE__`), `NGridItem`/`NFormItemGridItem` (`__GRID_ITEM__`), verificado en
  Naive 2.45. `$NUI` los envuelve en `defineAsyncComponent` y la marca queda en el componente real, no en
  el wrapper: `n-tabs`/`n-grid` descartan los hijos **sin error** y quedan vacíos. Esos cuatro se
  importan directo (`itdfw/NUI/NTabPane.js`) y se registran en el `init.js` del site o en el `created`
  del componente que los usa — como hace el propio front con `NGridItem` en `App.vue`. No es un defecto
  del loader: es cómo opera Naive (caso demo, 14-sep-2026).
- Escribir un archivo en la carpeta generada `NUI/` del front → basura, el builder la borra.
- Un `#hex`, `rgb(...)` o `red` en un componente → le rompes el tema al cliente.
- Usar `<n-algo>` sin haberlo puesto en `$NUI` → compila, no rinde, no avisa.
- Nombrar el componente sin prefijo `Itd`.

## Skills hermanos

| Skill | Para qué |
|---|---|
| **`itdfw-front-develop`** | escribir el componente: GI, render pipeline, `resolveTag`, prefijo `Itd`, patrón `localX`, cascada core→front |
| **`itdfw-front-app`** | dónde vive el archivo en el site y cómo lo resuelve la cascada (🔴 la ubicación ES la declaración) |
| **`itdfw-front-creation`** | crear un front-library nuevo (ahí sí se toca `NUIBuilder` y el loader) |
| **`itdfw-fwplugin`** | empaquetar un plugin con su carpeta `vue/` o `nui/` (suites); NUI mismo es el ejemplo |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`
