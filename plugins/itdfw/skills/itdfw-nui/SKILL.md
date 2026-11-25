---
name: itdfw-nui
description: Use when writing or modifying any component that renders Naive UI in ITDFW — n-card, n-tag, n-button, n-input, n-progress, n-timeline, or any n-* tag — including new site components, and whenever a component needs a color, a theme token, or asks how to avoid hardcoding colors.
---

# ITDFW + Naive UI

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [loader-and-builder.md](references/loader-and-builder.md) | El código del loader de `$NUI` (kebab, dedup global, import dinámico), la lista `NO_ASYNC_WRAPPER` y cómo se suma un componente, el código del `NUIBuilder`, por qué `useThemeVars` y `--n-*` no resuelven | un tag `n-*` no rinde, un archivo de `src/NUI/` desapareció, o un hijo de Naive se descarta sin error |
| [nav-store.md](references/nav-store.md) | El ítem de barra completo, celdas y zonas, la base del drawer, la tabla del store `app` (breakpoints, display, menu, zones, drawer), los componentes de la base, el menú y las opciones con descripción | agregas o cambias algo en las barras, el menú o el layout de un sink |

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

El loader de NUI (su `init`) convierte cada nombre a kebab y lo registra global con **import dinámico** (el código:
[references/loader-and-builder.md](references/loader-and-builder.md)).

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

El `NUIBuilder` de NUI **borra la carpeta ENTERA** en cada corrida y la regenera desde el `export` de
`naive-ui`, quedándose **SOLO con los componentes `N` + Mayúscula**. ⟹ Un archivo que pongas ahí **desaparece**, y lo
que no matchea `N[A-Z]` tampoco se regenera. Los `use*` de Naive (`useThemeVars`, `useDialog`, `useMessage`) **no están**
y no los agregues tú: son composables, no componentes. El código: [references/loader-and-builder.md](references/loader-and-builder.md).

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

**`useThemeVars` NO está disponible** (no lo genera el builder, y `naive-ui` no resuelve desde un site). **`n-element`
es el wrapper de transferencia de variables**: vuelca `common` COMPLETO como CSS vars sobre su propio elemento.

```jsx
$NUI: ["Element"]

<n-element tag="div" style={{border: "1px solid var(--error-color)"}}>
  {body}
</n-element>
```

- Nombre kebab **sin prefijo `n-`**: `errorColor` → `--error-color`, `textColor3` → `--text-color-3`.
- `tag` configurable (default `div`) → sirve para cualquier elemento nativo; entrega `styleScheme` por slot para JS.
- 🔴 Las `--n-*` de un componente son **por instancia** (en el root de ESE componente): `var(--n-error-color)` en un
  `<div>` suelto no resuelve.
- 🔴 Lo que NO se hace: agregar el composable al `NUIBuilder`, crear un wrapper a mano en `NUI/`, o instalar `naive-ui`
  como dependencia del site (**dos copias de Naive**, dos contextos de tema que no se hablan).

## 5 · Las barras y lo que va en ellas: el store `app` (NUI ≥ 7.2.0)

Los ítems de las barras viven en el **store del app**, no en inyecciones de `ItdNav`. Cualquier capa (core, front,
plugin, site) los agrega, reemplaza o saca con una mutación, desde un bloque de su `init.js`. Las barras son **sinks**
(`nav` arriba, `side` al costado, `drawer` el de la hamburguesa) y **todo** lo que se pinta en ellas es un ítem (logo,
hamburguesa, login, avatar, modo oscuro, menú): el core trae una base y el site la borra, la condiciona o la pisa.

| Quieres | Mutación (desde un bloque del `init.js`: `pack.push([function () { this.store.commit(...) }])`) |
|---|---|
| un ítem | `app/setNavItem` con `{key, component, props?, sink, position, pos?, when?, class?, style?}`: `sink` uno o un arreglo (default `"nav"`), `position` `first`\|`center`\|`last`, `pos` `^`/`$` (sin él, orden de llegada), `when` reactivo, `class`/`style` van a la CELDA del ítem |
| reemplazar / sacar un ítem | la misma `key` **reemplaza en su lugar**; `app/removeNavItem(key)` la saca |
| el wrapper de una zona (gap, padding, flex del drawer) | `app/setZone({sink, position, class?, style?})`: mezcla solo lo que declaras |
| un bloque sobre o bajo la grilla de un modelo | `app/setViewBlock({key, component, position: "above" \| "below", props?})` y `removeViewBlock(key)`; la vista lo pinta con sus `props` y el `filter` vigente |
| la fuente del menú | `app/setMenu({ref})` o `{options: [{value, text, description, icon}]}`, crudo; si sus opciones se traducen, con `optionsTranslation` (y `minMatchingChars` para un `ref`): sin ellos se pinta crudo. `checkLogin` enchufa las funciones del usuario solo si nadie enchufó antes |
| otros breakpoints / qué sinks existen por tramo | `setBreakpoints` (anchos mínimos en **px CSS**: `xs` 0 · `s` 360 · `m` 600 · `l` 900 · `xl` 1280 · `2xl` 1600 · `3xl` 1920 · `4xl` 2560 · `5xl` 3840) / `setDisplay` (mobile-first; base `{xs: ["nav", "drawer"], xl: ["nav"]}`) |

🔴 **`sink`, `position`, `pos`, `when`, `class` y `style` pueden ser funciones, con UNA sola firma**:
`({breakpoint, touch, store, route, atLeast, sink})` — `sink` es el que está pintando el ítem; **sin `this`
bindeado**; `pos` recibe además los ítems de su tramo. Ejemplo de la base:
`sink: ({atLeast}) => (atLeast("xl") ? "nav" : "drawer")` (arriba en escritorio, al drawer en lo chico).

- Cada sink (`ItdNav`, `ItdSide`, `ItdDrawer`) hace **`provide("sink")`**: un componente a cualquier profundidad dentro
  del ítem sabe dónde está con `inject: {sink: {default: "nav"}}`.
- El store da `breakpoint`, `touch` y los getters `app/atLeast(nombre)` y `app/sinks` como **utilidad general**, y
  **no guarda ancho en px**, a propósito: quien lo necesite lo mide él.
- El menú (`ItdMenu`) es un receptor puro con una sola presentación: otra es un componente propio en el ítem `menu`.
- 🔴 Los textos propios de estos componentes se declaran con `t()` en **`created`**: un `t()` dentro del render declara
  una Query por render y smart-fetch lo corta con error.

Reglas que blinda el contrato: el store es reactivo (una mutación o un cambio de ancho repinta sin recargar); un `when`
que revienta no tumba la barra (el ítem se omite y se loguea en `onDev`); los slots `preMenu/postMenu` (alrededor de
`first`) y `preRight/postRight` (alrededor de `last`) siguen.

El ejemplo completo, la tabla del store, las celdas, la base del drawer y las opciones con descripción:
[references/nav-store.md](references/nav-store.md).

## Red flags — si te ves haciendo esto, PARA

- `import {X} from "naive-ui"` en un site → no resuelve, y no es la vía.
- `import NCard from "itdfw/NUI/NCard.js"` → resuelve, pero mata el lazy y se salta el loader.
  🔴 Los que Naive reconoce por una marca (`RadioButton`, `Tab`, `TabPane`, `GridItem`, `FormItemGridItem`,
  `CarouselItem`) también se declaran en `$NUI` y **no** se importan: el loader los registra sin envoltorio async
  (lista `NO_ASYNC_WRAPPER`; cómo se suma otro: [references/loader-and-builder.md](references/loader-and-builder.md)).
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
