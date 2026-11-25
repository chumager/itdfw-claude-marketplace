# Nested wrappers — collapse/drawer por flag del back

## El patrón en una línea

Un campo **nested** (embedded / docArray / ref-en-filter) se envuelve en un wrapper visual (**collapse** o **drawer**) decidido por el **BACK** vía el flag `nested` del input. El front NO decide qué es nested ni qué wrapper usar — **front pure receiver**.

## El flag `nested` (back = SSoT)

| Origen | Qué pone |
|---|---|
| Types nativos `DocumentArray` + `Subdocument` (z99base) | `nested: true` default (sobreescribible en el schema) |
| Ref-como-Embedded del filter (FrontEnd.js `formFilter`) | marca `nested` en el ref, y **al final del ciclo** baja TODO nested a `"drawer"` |

**Valores y semántica:**
- `true` / `"collapse"` → **collapse**
- `"drawer"` → **drawer**
- `null`/`false` → no nested → render normal del GIW core

**La regla de contexto** (por qué el formFilter convierte todo a `"drawer"`): en un **form** el nested va en **collapse** (usa pantalla completa); en un **filter** va en **drawer** (un nested inline en el panel de filtro deja la cagá). El back decide por contexto, el front solo aplica.

⚠️ `nested` NO necesita `forceAttrs` para el **form** (el form es lazo, no restrictivo). La **grilla** sí es restrictiva con los attrs (ahí forceAttrs importa) — pero `nested` viaja al form sin problema.

## El GIW único (front)

`GenericInputWrapper` (NUI) lee `this._inputConfig.nested` y bifurca el wrapper:
- `"drawer"` → `n-drawer` (botón activador + drawer lateral)
- `true`/`"collapse"` → `n-collapse` **colapsado**, envuelto en un `n-card` SIN header (`size="small"`) → el bloque nested queda **enmarcado completo** (header del collapse + contenido dentro del card), no el título colgando afuera. El card lo envuelve ENTERO (no solo el slot) → se distingue al toque de un campo plano.
- falsy → delega al `coreRender` (label + slot + error)

🔴 **Absorbió al `GenericInputWrapperFilter`** (que era solo-drawer). Un solo wrapper, el back decide el modo. El GIWFilter se eliminó; el ItdFilter (concepto) se mantiene.

## Lazy real (el ahorro, no solo visual)

El collapse usa `display-directive:"if"` (default de NUI) → monta el contenido **solo al expandir**. ⟹ El nested colapsado **no corre su setup → no pide infra** (`getForm`/`getTableData`) → no aporta al `formData` → **no viaja al guardar si nunca se abre**. El rastro nested se activa al expandir. (Cuidado: `display-directive:"show"` rompería el lazy — montaría oculto).

## Transitividad del rastro (GI declara, GF/Grid/AF propagan)

- **`parentName`** → path del padre. El GI expone `localParentName = parentName ? `${parentName}.${inputName}` : inputName`. GF (renderFormInput) / ItdGrid (renderGI de celda) / AF lo bajan a los hijos → el rastro se arma descendente.
- **`field()`** (de `useBackend`) → el equivalente en **setup** (no hay computed ahí): arma el path desde `props.parentName` + `props.input.name`. Los lazy (ItdEmbedded, AF, SubsetDoc) piden su infra con `field()` → el back resuelve el sub-schema del nivel correcto.
- **`drawerWidth` + `reduceDrawerWidth`** (default 10) → ancho del drawer. El GF baja `drawerWidth - reduceDrawerWidth` por nivel → drawers anidados progresivamente más angostos. **El ItdGrid inicia** (drawerWidth 300 + viewType="filter").

## `inputName` vs `logName` (separación real/parchado)

- **`inputName`** = real (`localInput?.name ?? null`) → para el path nested y usos funcionales. El GF root no tiene name → `null` → no contamina el path.
- **`logName`** = parchado (`localInput?.name ?? "<ComponentName> UNKNOWN"`) → para logs/devtools (`devName`, header del loader `$log`, `vsLog`). Nunca null.

## Componentes

- **ItdGrid** (NUI) inicia el filter: pasa `viewType="filter"` + `drawerWidth` + `reduceDrawerWidth` al ItdFilter.
- **ItdFilter** = `GenericForm` + `viewType:"filter"`. Delgado pero es el **punto de extensión semántico** del filtro (donde crece la lógica de filter: colapsar true/between/{object}). **Se mantiene** — concepto, no implementación.
- **viewType transitivo**: el GF propaga su `viewType` a los hijos (filter→filter, input→input). Se eliminó el flag `filter` paralelo del GF (era rama duplicada del viewType).
- **GIWFilter ELIMINADO** — era implementación (wrapper drawer) absorbida en el GIW por flag.

## Por qué este diseño (build-to-last)

Cada pieza es **back-decide / front-aplica**: el front no conoce nombres de componentes ni lógica de negocio, solo lee flags (`nested`, `viewType`, `drawerWidth`). No hay componentes ni flags paralelos para filter: todo se unifica bajo flags transitivos del back.

**Contraste con el approach imperativo**: a mano habría que mantener el estado expandido/colapsado de CADA collapse + distinguir filter-vs-form en código del front. Acá el `n-collapse` maneja su propio estado (y `display-directive:"if"` da el lazy gratis), y el flag `nested` del back distingue el wrapper → **cero estado manual, cero lógica de distinción en el front**. Un wrapper declarativo simple reemplazó toda esa maquinaria imperativa.
