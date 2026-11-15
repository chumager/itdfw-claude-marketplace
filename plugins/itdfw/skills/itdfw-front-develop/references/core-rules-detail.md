# Reglas core — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto de cada regla vive en `SKILL.md`; aquí está la prosa completa, los casos y el origen.

## Traducción: `t`, `rt` y el `text` compuesto

- 🔴 **Traducción: los globales `t` y `rt` (core ≥ 7.1.0), no `$t` ni `<itd-wc-t>`.**
  `t(context, subcontext, text, {data})` **declara una Query y devuelve un ref reactivo** (se lee `.value`): se
  llama en `created`/`setup`, **nunca en el render** (smart-fetch corta "a Query cannot be declared inside render()";
  detalle en `references/translation-front.md`). Sirve para lo que no se dibuja como texto (título de columna, `Alert`, opciones de un select,
  labels de ECharts). `rt(context, subcontext, text, props)` devuelve el **VNode** de `ItdT` para JSX (title de
  `ContentWrapper`, labels de `GenericInputWrapper`, botones del form). Sin el plugin `translate` los dos son espejo
  (devuelven el texto). El web component `<itd-wc-t>` **salió del core en 7.1.0**: un site que lo use lo migra a
  `rt()`; el WC vive solo dentro del plugin `translate`.
  🔴 **Lo que NO se traduce: datos.** El nombre de un documento o cualquier valor que el usuario escribe en la BD
  pasa crudo. 🔴 **Excepción: `name`/`description` de una función del perfil son SEMIESTÁTICOS** (jcmunoz
  28-sep-2026, corrige la regla del 17-sep): nacen de la declaración del modelo o la punta y se escriben una vez;
  quedan editables porque un perfil puede recibir un acceso acotado a un administrador (deja de ser "Administración
  de X" y pasa a ser "Visor de X"). Uno es el *intent* (lo declarado) y el otro el que define al final (lo que el
  perfil fija), y **los dos se traducen siempre**, sobre su valor, con la coordenada `Interface` ·
  `name-<path>` / `description-<path>` (lo que llega son interfaces, no puntas). `checkLogin` los entrega crudos y
  declara esas coordenadas (`optionsTranslation`); quien los pinta (el select del menú, los atajos, el shell) traduce
  con ellas. Un select traduce sus opciones con la `optionsTranslation` que le declara quien las manda
  (`references/translation-front.md` §Opciones de un select). Nadie pasa los `name` de los modelos a español para
  "arreglar" el menú.
  🔴 **El `text` puede ser COMPUESTO, no solo un string** (core `init.js`, verificado 18-sep-2026). Tres formas:

  | Forma | Qué hace |
  |---|---|
  | `"texto"` | se traduce con `(context, subcontext)` y se rellena con `data` vía Mustache |
  | `[a, b, c]` | traduce cada item y los **une con el `separator`** del nivel que contiene el array (default `", "`) |
  | `{text, context?, subcontext?, data?, separator?, onlyTranslated?}` | descriptor: traduce `text` con lo que declare, heredando lo que no declare |

  Las tres se **anidan**: un array puede traer descriptores, y un descriptor puede traer otro array.
  **La herencia es por `??`, el más cercano gana**, y el default de `separator` solo aplica en la raíz — un
  descriptor hijo que no declara `context` usa el del padre, y así con `subcontext`, `data`, `separator` y
  `onlyTranslated`. Cada nivel pasa por `unref`, así que acepta refs y sigue siendo reactivo. Un `text` nulo
  devuelve `""` en vez de reventar. Sirve para un mensaje armado de partes con contextos distintos (un error
  del back + una aclaración de la UI) sin concatenar strings ya traducidos, que es lo que rompe el orden en
  otros idiomas. `ItdT` con un array pinta exactamente ese join, porque su `content()` llama a `t`.
  ⚠️ El relleno final es **Mustache sobre `data`**: si el `data` no trae la key, `{{loQueSea}}` sale vacío
  (hallazgo #201, 18-sep: `{{input.label}}` vacío en los mensajes de validación).

## Clone guards

- **🔴🔴 REGLA DE ORO — CLONE GUARDS (2026-07-13)**: todo dato que CRUZA una frontera viaja CLONADO,
  jamás por referencia compartida — y el clonador ES el helper **`GI.clone(v)`** (Blob/File pasan por
  ref — no son deep-clonables; el resto `cloneDeep`): memorias de comparación (`vModelLastEmitted`,
  old-values de guards), asignación de `input`/config a estado local, transferencia de objetos entre
  componentes (definir el dueño, clonar en la frontera). JAMÁS `cloneDeep` pelado en una frontera —
  saltarse la regla del Blob rompe campos File. El getter del VSV y vModelEmit/Sync ya lo usan. Una ref compartida entre dos dueños "se pierde en las pasadas": guards
  que se auto-actualizan (el GF no emitía JAMÁS — auth muerto), inputs que quedan reactivos y suben la
  cadena (sobrecargas en todos lados). Red flag: un `=` de objeto cruzando frontera sin clone; ante un
  bug raro de reactividad/transferencia, probar IDENTIDAD COMPARTIDA antes que nada. Excepción
  DELIBERADA: la mutación in-place del contenedor del GF (performance) — legítima porque sus observadores
  comparan contra snapshots CLONADOS (ambos lados se sostienen mutuamente).

## Un `watch` no se pisa con `extends`

- **🔴 Un `watch` NO se pisa con `extends`: Vue lo MERGEA** (`mergeWatchOptions` → `mergeAsArray` por key: corren el
  handler del padre Y el del hijo). Lo mismo para los hooks de ciclo de vida. Para REEMPLAZAR un watcher desde un
  nivel de arriba (site, plugin), se extiende una **copia superficial del objeto del padre sin esa key**
  (`const base = {...Parent, watch: {...Parent.watch}}; delete base.watch.x; export default {extends: base, watch: {x: …}}`).
  Los `methods` y `computed` sí se pisan (gana el hijo). Y si lo que hay que pisar vive INLINE en un `render()`
  monolítico, el seam mínimo (`renderX()`) se agrega en la capa dueña sin cambiar conducta y recién ahí se pisa
  (caso `ViewNUI.renderDeleteModal`, 21-sep-2026). Gap #45.

## Un valor con type pasa por la base de su type

- 🔴🔴 **REGLA DE ORO: un valor con type (monto, fecha, duración, porcentaje, teléfono, HTML…) pasa por la base de
  lógica del core de su type; la pintura es libre.** Se puede reimplementar o pisar el componente desde cualquier capa
  (decide la precedencia en la cascada), siempre extendiendo esa base. En una vista propia: `renderGI` en modo
  `detail`. Nunca un `Intl.NumberFormat` o un formateo a mano: la base (saneo, locale, moneda, máscara, VO) es lo que
  da las capacidades, y saltársela rompe en silencio reglas ya establecidas (rule `datos-por-sus-componentes`). Monto: `this.renderGI({name, key, type: "Currency", component: "ItdCurrency", currency: "CLP"}, valor,
  null, {viewType: "detail"})` (el componente declara `$renderGI: true`). Caso: la carta del restorán formateaba con
  `Intl` fijo en es-CL y al elegir otro idioma los precios no cambiaban (25-oct-2026).

## Todo HTML inyectado pasa por `ItdHtml`

- 🔴 **Todo HTML que se inyecta pasa por `ItdHtml` en modo `detail`**, **nunca `innerHTML` ni `v-html` directo**.
  Se monta con `this.renderGI({name, key, type: "Html", component: "ItdHtml"}, valor, null, {viewType: "detail"})`
  (el componente declara `$vModel` y `$renderGI`). Sin `plain`: esa opción aplica `all: initial` y le quita al
  contenido su formato. `ItdHtml.sanitizeHtml` sanea con DOMPurify (quita scripts, `on*` y links
  `javascript:`, conserva el formato) y deja pasar intacto el texto sin etiquetas, así que no hay que preguntarse si lo
  que llega es texto o HTML. El back además sanea el type `Html` al guardarlo (setter con `sanitize-html`). Vale para
  la ayuda de un modelo, alertas, acciones, traducciones y cualquier texto que venga del back o de un usuario.
  Origen: 20-oct-2026, XSS por campos Html y por textos redefinibles.

## `contextType`, `hasFormBus` y los buses

- **🔴 `contextType` + `hasFormBus`** (buses SOLO dentro de un form) — usa el computed SSoT `hasFormBus` (doble trap viewType + localContextType) para CUALQUIER condicional de bus, nunca `mode === "input"`. 🔴 **Los 3 buses (`root`/`parent`/`form`) son TRANSITIVOS por provide**: un GF los recastea (pasa los que tiene; si no los pisa, los hereda) y el GI recibe el provide generado → **si hay `formBus`, SIEMPRE hay `rootBus`/`parentBus`**. ⟹ un dato que vive en el ROOT (ej. `_currency`) se lee del **`rootBus`**, NUNCA del `formBus`: en un **embedded** (que es un GF con formBus PROPIO) el `formBus` local no tiene ese dato. (arrayForm no-GF "funcionaba" de casualidad: su formBus ES el del root.) Aplica al suscribir/usar formBus/rootBus. [mixins-model-context.md](references/mixins-model-context.md).

## Quien extiende una base de `lib/` la carga con `applyLoaders`

- **🔴 Quien EXTIENDE una base de `lib/` la carga con `applyLoaders`** — `const Base = await import("core/lib/X.jsx").applyLoaders().get("default")` (canon: GI NUI, 2026-07-05). Los loaders que la base DECLARA ($vModel, $emitter, $validateSelf…) se aplican A SU objeto (singleton de módulo → todo el universo hereda; el mixin queda en el nivel de precedencia correcto → un computed del front pisa legítimo al mixin del loader). Import directo pelado deja los loaders huérfanos (con hoist:false nadie los aplica); el hoist:true viejo los aplicaba en la HOJA y su mixin pisaba los computeds del front — así murió por meses la regla lazyFormatter⟹"value" (sobrevivía solo por estáticos `$vModelChildProp` por componente, vestigio junto al `delete $validateSelf` del NUI — ambos eliminados).

## Derivar datos: el contenedor crudo, nunca `validateSelfValue`

- **🔴 DERIVAR datos: el CONTENEDOR CRUDO, NUNCA `validateSelfValue`** — el getter del VSV **CLONA** para
  ser comparable (plugin `validateSelf`), y **clonar LEE TODAS LAS LLAVES** → quien lo lee queda
  dependiente del objeto ENTERO → una tecla en cualquier campo re-rinde a TODOS los hijos. El crudo se lee
  **por llave** y el proxy de Vue 3 (`WeakMap<objeto, Map<llave, Dep>>`) despierta solo al dueño.
  🔴 Se accede por su DECLARACIÓN: **`this[this.$options.$validateSelfValue]`** — `localValue` es solo el
  DEFAULT de esa opción (`:218`), es declarable por componente; escribir `this.localValue` a mano es bug
  latente. **VSV = COMPARAR/emitir/guardar (el todo como unidad); contenedor = DERIVAR (un dato de
  adentro).** Litmus: *¿necesito el objeto entero comparable, o UN dato?* Caso #115: 32 renders y 106 ms
  por tecla → 1 render y 1–3 ms.
  la doc de arquitectura «derivacion-vsv-vs-localvalue».

