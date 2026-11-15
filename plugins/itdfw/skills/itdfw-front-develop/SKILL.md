---
name: itdfw-front-develop
description: Use when developing inside an ITDFW frontend — creating/modifying/extending components (Itd* inputs, ItdView grid, ItdBForm, ContentWrapper shell), migrating .vue to JSX, debugging render pipeline (slots, tag resolution), value/validation pipeline issues, loader registration, core→front cascade overrides, or applying ITDFW front patterns and anti-patterns. NOT for setting up a new front library (use itdfw-front-creation) or wiring a new app/site (use itdfw-front-app).
---

# ITDFW Front Develop

Manual de trabajo para componentes ITDFW. Este SKILL.md es el **ÍNDICE navegable**: cada regla queda corta (qué es + cuándo aplica + link). El detalle vive en `references/` por tópico — lee SOLO el reference que necesitas para tu tarea.

Render pipeline + slot/tag helpers (slotOrRender, resolveTags, resolveComp) aplican universal; value/validation aplica a inputs y composites.

> **Autenticación de modelos** (login de un modelo autenticable: `modelAuth`/`modelOption` del store, vista
> opcional, `meta.redirect`): el peso conceptual vive en el back → ver skill **`itdfw-api-system`**, sección
> "Autenticación de un modelo nuevo". Acá la pega es trivial (setear valores de store); no se documenta aparte.

## Reglas core

- 🔴 **Idioma del código: inglés.** Identificadores, funciones, variables, props, archivos y comentarios en inglés
  camelCase; nombres de componentes `Itd*`. Solo los textos visibles al usuario van en español, y por el sistema de
  traducción, nunca hardcodeados. (Un site entero escrito en español, 2026-09-13, no lo frenó ningún skill.)
- 🔴 **Traducción: los globales `t` y `rt` (core ≥ 7.1.0), no `$t` ni `<itd-wc-t>`.** `t(context, subcontext, text, {data})` **declara una Query y devuelve un ref reactivo** (se lee `.value`): se llama en `created`/`setup`, **nunca en el render** (smart-fetch corta "a Query cannot be declared inside render()"); sirve para lo que no se dibuja como texto (título de columna, `Alert`, opciones de un select, labels de ECharts). `rt(context, subcontext, text, props)` devuelve el **VNode** de `ItdT` para JSX (title de `ContentWrapper`, labels de `GenericInputWrapper`, botones del form). Sin el plugin `translate` los dos son espejo. 🔴 **Los datos no se traducen** (el nombre de un documento, lo que el usuario escribe): pasan crudos; excepción: `name`/`description` de una función del perfil son semiestáticos y **se traducen siempre**, sobre su valor, con la coordenada `Interface` · `name-<path>`/`description-<path>`. 🔴 El `text` puede ser un string, un arreglo (se une con el `separator`) o un descriptor `{text, context?, subcontext?, data?, separator?, onlyTranslated?}`, anidables; la herencia es por `??` y el más cercano gana. El relleno final es Mustache sobre `data`. Detalle: [references/core-rules-detail.md](references/core-rules-detail.md) §Traducción y `references/translation-front.md`.
- **`index.html` en cascada (site → DEFAULT → front → core)**: el nivel que lo pone gana el `root` y trae su `src/main.js` al
  lado; `public/` sí se suma entre niveles. El splash inicial es `#app:empty` en el `index.html` del core, con `#app`
  sin NADA adentro (ni un espacio). El build dice cuál ganó: `[itdfw] index: <root>`. Detalle: `itdfw-front-app` →
  `references/vite-setup.md`.
- **Menú lateral / drawer**: `ItdNav` ya lo trae (mobile-first, `closable`, scrim, 2026-09-05). Un site que necesita
  otro menú extiende/overridea `ItdNav`, no reescribe el shell del `ContentWrapper`.
- **Quitar partes del shell** (`nav`, `side`, `drawer`, `footer`): por **ruta** (caso dinámico) con `meta.shell`
  (`false` = ninguna, arreglo = solo esas; lo resuelven `hasSink`/`inShell` de `injections/App.js`, core ≥ 24-oct-2026);
  para **todo un site** (caso fijo) basta pisar el componente en la cascada del site con un `render() { return null; }`.
- **🔴🔴 REGLA DE ORO — CLONE GUARDS**: todo dato que CRUZA una frontera viaja CLONADO, jamás por referencia compartida, y el clonador ES **`GI.clone(v)`** (Blob/File pasan por ref; el resto `cloneDeep`). JAMÁS `cloneDeep` pelado en una frontera (rompe campos File). Ante un bug raro de reactividad o transferencia, prueba IDENTIDAD COMPARTIDA antes que nada. Excepción deliberada: la mutación in-place del contenedor del GF. Detalle: [references/core-rules-detail.md](references/core-rules-detail.md) §Clone guards.
- **🔴 NO romper la CADENA al override** — pisar una función heredable (cadena `GI→GF→hoja` o `core→front→site`) sin llamar al original deja huérfanas a las hojas; el síntoma aparece lejos de la causa. Sobrecarga el `defaultX`, no el wrapper `X`. Aplica al tocar cualquier método heredable. [override-chain.md](references/override-chain.md), [value-pipeline.md](references/value-pipeline.md).
- **🔴 En el front, la UBICACIÓN es la declaración** — un nivel de la cascada (core / front-lib / DEFAULT / app / **y la carpeta de framework de un FWPlugin**) aporta cosas por **dónde las pone**, sin registrar nada: `router.js` en la raíz → sus rutas entran al router; `store/modules/*.js` y `store/plugins/*.js` → al store; `components/X` · `views/X` · `mixins/` · `controllers/` · `injections/` → resuelven por nombre (🔴 `loaders/` NO: van por función, deliberadamente fuera de la cascada para que nadie los pise). La cascada es *first-return* con la app arriba ⟹ **nombrar igual PISA al de abajo, en silencio** (en rutas hay un `console.warn` por `name` duplicado, pero igual gana el último). Es la contracara del back, donde declaras keys y el espejo de carpetas es solo coherencia. Detalle y tabla completa: skill **`itdfw-fwplugin`** §"En el FRONT el espejo es IMPERATIVO".
- **🔴 Un `watch` NO se pisa con `extends`: Vue lo MERGEA** (corren el handler del padre Y el del hijo; igual los hooks de ciclo de vida). Para REEMPLAZAR uno desde un nivel de arriba se extiende una **copia superficial del objeto del padre sin esa key**; `methods` y `computed` sí se pisan. Si lo que hay que pisar vive INLINE en un `render()` monolítico, primero se agrega el seam mínimo (`renderX()`) en la capa dueña. Detalle y receta: [references/core-rules-detail.md](references/core-rules-detail.md) §watch.
- **GI ya lo hace**: GI maneja render, value flow, validation, events, lazy, state. Verifica defaults antes de override.
- 🔴🔴 **REGLA DE ORO: un valor con type (monto, fecha, duración, porcentaje, teléfono, HTML…) pasa por la base de lógica del core de su type; la pintura es libre.** En una vista propia: `renderGI` en modo `detail`, p. ej. `this.renderGI({name, key, type: "Currency", component: "ItdCurrency", currency: "CLP"}, valor, null, {viewType: "detail"})`. Nunca un `Intl.NumberFormat` ni un formateo a mano (rule `datos-por-sus-componentes`). Detalle y caso: [references/core-rules-detail.md](references/core-rules-detail.md) §Valor con type.
- 🔴 **Todo HTML que se inyecta pasa por `ItdHtml` en modo `detail`**, nunca `innerHTML` ni `v-html`: `this.renderGI({name, key, type: "Html", component: "ItdHtml"}, valor, null, {viewType: "detail"})`, **sin `plain`**. `ItdHtml.sanitizeHtml` sanea con DOMPurify y el back también sanea el type `Html`. Vale para cualquier texto que venga del back o de un usuario. Detalle y origen: [references/core-rules-detail.md](references/core-rules-detail.md) §HTML.
- **🔴 FLUJO DE VALORES SELLADO (2026-07-13)** — los gates del ciclo raw→VSV→VSR→emisión (forceDisplay, corte de eco, assignVSR puro, snapshot de emisión, lazy ortogonal) están CONGELADOS: solo cambios idempotentes pasan; NO tocar sin tema MUY fuerte. Operación: [value-pipeline.md](references/value-pipeline.md); declaración canónica: la doc de arquitectura «value-flow-sealed».
- **🔴 Contrato VO↔GI** — si el campo tiene un Value Object, se ENCHUFA (`data.VO` + pseudoDoc `this.doc`) y el GI delega los hooks espejo 1:1 con fallback nativo + warn onDev. 🔴 Hooks de clase SOLO SIN externalidades (los valores deben existir REALMENTE en doc y GI — `_currency` sí; `locale`/`mask` JAMÁS: son del USUARIO, nunca se parchan al pseudoDoc); externalidades → **WRAPPER del VO** en el componente (`class extends VO` + `setLocale(vm.staticLocale)` — snapshot PLANO, nunca el getter reactivo: getter-tubo). SSoT del flujo = VSR (nada de revertir display). La herencia por similitud MUERE cuando el VO suple la implementación. [vo-gi-contract.md](references/vo-gi-contract.md).
- **🔴 Contrato de capacidades por viewType (`support`)** — la tabla `data.viewTypes` (keys homologadas 1:1 a la punta: validateSelf/assignVSR/formBus) es la SSoT de qué puede hacer cada modo. LA PUNTA discierne (`support(cap, silent?)`: forma rota EXPLOTA siempre; capability false → false + weeo default); el CONSUMER llama PELADO — NUNCA `if (viewType === ...)` en un componente (whitelist ad-hoc = invariante replicado). [viewtype-contract.md](references/viewtype-contract.md).
- **GenericInput SIEMPRE global**: `/*global GenericInput*/`. Import directo = sin loaders. **Vive en `lib/GenericInput.jsx`, NO en `components/`** — GI no se usa como componente renderizable, es base de extensión cargada como global (loadFormFactories); `components/` es solo para lo que rinde/cascadea. (Mismo criterio GF/GFMin.)
- **Front pure receiver — back es shape SSoT**: front NO transforma shape (`component`, `type`, `subComponent`, `filter`, `inputs`, `fields`). Detalle + excepción Vista: [front-pure-receiver.md](references/front-pure-receiver.md).
- **🔴 De dónde lee un componente su CONFIG (atributos del back)**: en modo input (FORM) los atributos custom del campo llegan LAXOS → `localInput` directo (`localInput.miConfig`). NO `localInput.attrs` (eso se spreadea al control interno, GI:388). La grilla (`tableFields`) es RESTRICTIVA → la config del type ahí necesita `forceAttrs`. Mecánica completa (pick/whitelist vs omit/blacklist por endpoint): skill `itdfw-mongoose-types` → toinput-pipeline.md §5.
- **🔴 LA CADENA — todo lo que viene de `input`/`localInput`/`localConfig` viene de la DEFINICIÓN DEL INPUT** (la base estructural de los componentes GI). Para entender CUALQUIER atributo que leas de ahí, cruza DOS skills, NO el core: (1) **`itdfw-mongoose-types`** → cómo se DEFINE (option del type, cómo se aplica al SchemaType, `forceAttrs`); (2) **`itdfw-api-system`** → qué PUNTA lo entrega y con qué rigor (grilla `tableFields` = RESTRICTIVA/whitelist → necesita `forceAttrs`; forms `formCreate`/`formUpdate`/`formFilter` = LAXOS → entregan los attrs custom solos). `forceAttrs` SOLO si un contexto restrictivo consume el attr; "por si acaso" es flaw. Si te ves grepeando el core para saber de dónde sale un attr de `localInput` → PARA, está en types+API.
- **Tags/classes en `data()`**: no props, no globals mutables. Front overrides en su propio `data()`.
- **`mode` en data**: GI=`"input"`, GF=`"form"`, GF children=`"input"`.
- **🔴 `readContext(field)` — LA punta FCC pa leer datos de CONTEXTO** (2026-07-15/17): un dato del root
  (capital, `_currency`, cualquier campo del crédito/form padre) se lee SIEMPRE vía `this.readContext(field)`
  del GI — discierne solo: form → `rootBus.getValue` / grilla-view (sin bus) → `row[field]`. NUNCA bus
  pelado (en view no existe → computed explota mudo) ni row pelado (en form la fila no es la fuente viva).
  Nació del canon localCurrency; consagrada en ItdQuotes (celda muda cazada 2026-07-17).
- **🔴 `contextType` + `hasFormBus`** (buses SOLO dentro de un form): usa el computed `hasFormBus` para CUALQUIER condicional de bus, nunca `mode === "input"`. Los 3 buses (`root`/`parent`/`form`) son **transitivos**: si hay `formBus` siempre hay `rootBus`/`parentBus`; un dato del ROOT (ej. `_currency`) se lee del **`rootBus`**, nunca del `formBus` (en un embedded, que es un GF con formBus PROPIO, el local no lo tiene). [mixins-model-context.md](references/mixins-model-context.md); detalle: [references/core-rules-detail.md](references/core-rules-detail.md) §buses.
- **🔴 `size` es PROP transitiva — un componente NO fija su tamaño**: `localSize = forceSize ?? localConfig?.size ?? size` (componente → back → prop, con el default del front; el core no opina). Baja por DOS vías: el GF en `renderFormInput`, y el loader **`renderGI`** para los hijos rendidos a mano (Address, doubleCheck) que nacen fuera de esa cadena. Imponerlo por construcción = `forceSize` (hermano de `forceLazy`).
- **Patrón `localX`**: UN computed `local + Pascal(prop)` componiendo métodos puros, sin cascadas. [local-pascal-pattern.md](references/local-pascal-pattern.md).
- **Siempre localImport**: loaders solo via localImport. Direct import solo si nada de la cadena necesita loader. [data-props.md](references/data-props.md), [cascade-inheritance.md](references/cascade-inheritance.md).
- **🔴 Quien EXTIENDE una base de `lib/` la carga con `applyLoaders`** — `const Base = await import("core/lib/X.jsx").applyLoaders().get("default")` (canon: GI NUI): los loaders que la base declara (`$vModel`, `$emitter`, `$validateSelf`…) se aplican a su objeto; un import directo pelado los deja huérfanos. Detalle: [references/core-rules-detail.md](references/core-rules-detail.md) §applyLoaders.
- **Setup vs Options API**: `setup` corre antes de `created` → `this` no existe; nada que dependa de `this` vive ahí. Aplica al escribir setup/composables o loaders. [setup-lazy-async.md](references/setup-lazy-async.md), [anti-patterns.md](references/anti-patterns.md).
- **🔴 DERIVAR datos: el CONTENEDOR CRUDO, NUNCA `validateSelfValue`** — el getter del VSV **clona** (lee todas las llaves) y una tecla en cualquier campo re-rinde a TODOS los hijos. El crudo se lee **por llave**, accediendo por su declaración, `this[this.$options.$validateSelfValue]` (no `this.localValue` a mano). **VSV = comparar/emitir/guardar; contenedor = derivar.** Litmus: *¿necesito el objeto entero comparable, o UN dato?* Detalle, el caso #115 y la doc de arquitectura: [references/core-rules-detail.md](references/core-rules-detail.md) §Derivar.
- **🔴 NO asumir dato-on-create (paradigma lazy/async)**: "creado ⟹ dato disponible" está ROTO (formBundle SWR lazy). `setup`/`created` no debe leer value/options/form esperando que ya esté; declara la punta y lee vía reactividad. Revisa esos 2 hooks al tocar cualquier componente. Incluye la 🪄 magia negra de `formBus.getValue` (reactivo en vivo / muerto si snapshoteas) y cross-field reactivo. [setup-lazy-async.md](references/setup-lazy-async.md), [value-pipeline.md](references/value-pipeline.md).
- **🔴 Prefijo `Itd`** — `name:` del componente Vue SIEMPRE `Itd*`; declaración back (`component:"X"`) prefijada SOLO si colisiona con HTML built-in (Code/Select/Form/Input/Button…). Aplica al nombrar componentes o declarar `component` en schemas. [itd-prefix-resolve-tag.md](references/itd-prefix-resolve-tag.md).

## 🔴 Mixins globales: model / contextType (cimiento del flujo, NO loaders)

Dos mixins globales (init.js) se aplican a TODO componente: `modelTransitivity` y `contextTypeTransitivity`. Resuelven `localModel`/`localContextType` por cascada `prop → inject → route.meta`, con auto-reconfiguración reactiva. Usa `localModel`/`localContextType` (nunca crudos), NO declares `model`/`contextType` como props locales, override = pasar el prop. 🔴 Red flag: el mixin YA inyectó model/contextType aunque el componente no los declare — `props.model === undefined` NO es bug. Detalle completo (tabla, transparencia props↔provides↔meta, `hasFormBus`, resolución en setup): [mixins-model-context.md](references/mixins-model-context.md).

## 🔴 Índice por SÍNTOMA (entrada rápida; el skill es largo)

| Síntoma | Dónde |
|---|---|
| "mi pantalla no aparece en el menú" | no es del front: `itdfw-api-system` §Rutas del front se declaran en el BACK |
| "voy a construir un componente de archivos / preview / descarga" | **ya existe `ItdFile`** (abajo) |
| "¿le muestro el 401/403 al usuario?" | no: son flujo (`itdfw-api-system` §AAA) |
| "el value no llega / llega tarde al componente" | `value-pipeline.md` · `sync-create-to-lazy-async` |
| "el componente compila y no rinde nada" | `$NUI` no declarado (`itdfw-nui`) |
| "el override del site no toma" | `itdfw-front-app` (cascada, `injections/` espeja la base) |
| "`r.data` sale undefined" / "reading 'map'" tras subir el front | `$http` resuelve con el CUERPO (core ≥ 7.1): `http-error-traps.md` §primera |
| "un botón por fila / una acción sobre la selección de la grilla" | ya existe: back, la capa `mongooseDB` (`addActionButton`/`addToggleButton`) y `tableSpecs.buttons`; front `ItdActionButton`/`ItdActionToggleButton`/`ItdBulkButton`; la grilla NUI provee `itdGridRefresh` e `itdGridMerge` (= `ItdGrid.mergeRow`); banco onDev `TestActionButton`. Contratos: los TDD de action-buttons y bulk-actions del core front |

## `ItdFile` existe — no lo construyas de nuevo (gap #21)

`ItdFile` (core front) + `ItdFile` (NUI):

- **Modos**: `input` (uploader + botón ojo), `view` (grilla), `detail` (preview inline directo).
- `loadPreview()` resuelve el descriptor (`/APP/File/fileDesc.json?id=`, o directo si el value ya trae `URL`), baja el
  blob y devuelve un sub-componente que pinta **sync** con todo cerrado en closure: cero estados intermedios, cero fetch
  en la grilla.
- Preview por `contentType`: imagen, video, pdf/json en iframe; lo demás cae en "tipo no soportado" **pero igual entrega
  nombre y botón Descargar**.
- `ItdFileNUI` sobrecarga `togglePreview` y abre un **modal** (`NUIdialog`, 80vw) en vez del preview inline.
- El "PDF que en realidad es JSON" (DocDefinition → pdfMake en el front) es un caso previsto: se verifica que el primer
  byte sea `%`. Principio del FW: el back compone el JSON, el documento se genera en el cliente (`itdfw-models`
  §Archivos).

## Architecture

```
Back (z99base.js) → Core (libs/.../components/Itd*.jsx) → Front (fronts/.../components/Itd*.jsx)
   type defaults     extends GenericInput                extends Core, overrides data
```

Front imports core: `import CoreX from "core/components/ItdX.jsx"` (direct, NOT localImport).

## resolveTags / resolveComp / resolveTag

`resolveTags("button")` (suffix "Tag" automático), `this.resolveComp(tag)` (method), `resolveTag(name)` (GLOBAL: registra global + retorna). En render JSX, componente fijo → `const X = resolveTag("itdX")` directo, NUNCA `components: ci(...)` (JSX no lee `components`). Detalle + anti-patrón Form.jsx: [itd-prefix-resolve-tag.md](references/itd-prefix-resolve-tag.md).

🔴 **`ref` en JSX dentro del contenido de otro componente → ref de FUNCIÓN, nunca string.** En Vue 3 un
`ref="canvas"` se ata a la instancia que está renderizando cuando se crea el vnode; los hijos de un
componente en JSX son slot functions y corren dentro del hijo, así que el ref queda en el `n-card`/`n-element`
y `this.$refs.canvas` sale vacío, sin error. Se escribe `ref={el => { if (el) this.canvasEl = el; }}` (así lo
hace `ItdTimeFrame.jsx` en NUI). Es Vue, no el FW (caso demo, 14-sep-2026: gráficos que no se dibujaban).

## Complexity Decision Tree

| Tu input es... | Level | Configure | Skeleton |
|----------------|-------|-----------|----------|
| Text + formatting | 1 | Methods | `methods: {formatter, keypress}` |
| Text + type validation | 2 | data + validator | `{type:"email"}` + `addValidator` |
| Non-text HTML (checkbox) | 3 | data props | `{lazy:false, type:"checkbox", valueProp:"checked", targetValue:"checked"}`: the click is the commit; lazy would wait for a blur that a checkbox outside a form never gets (20-oct-2026) |
| Numeric con locale | 4 | Extend ItdNumber | Override `numberFormatStyle()`, `afterSetNumberData()` |
| Display ≠ stored | 4b | initVal + emitter | `initVal(stored)→display`, `emitter(display)→stored` |
| Typeahead libre vs estricto (Datalist) | 4c | validador declarativo | libre por default; estricto = `validate` (valor ∉ options → error). NUNCA gatear emisión por validación ([validate-self.md](references/validate-self.md) §carriles) |
| Select con una sola opción (NUI) | 4d | `autoSelect` (data / attr del input) | `ItdSelectNUI` asigna sola una opción única (UX de typeahead). Correcto para un DATO; una ACCIÓN (command palette que navega, 20-sep-2026) se elige aunque sea la única: el input declara `autoSelect: false` |
| GI que es una ACCIÓN y no un dato (menú, buscador, paleta, un filtro rápido) | 4e | `validate: false` en su input | `validateSelf` corta antes de validar y `validateState` queda `null`: sin color de éxito ni de error. Sin validadores un input queda VERDE (coherencia de un form bien llenado); por eso lo que no se valida se declara, no se deja sin reglas |
| Object value (sub-form) | 5 | Extend GF directly | `extends GenericFormCore` + `innerForm` + `initVal/emitter`. [gf-direct-extension.md](references/gf-direct-extension.md) |
| Widget custom ultra-complejo (file/editor/mapa) | 6 | Subcomponente como `this.tag` | sub con `$vModel:true` + `vModelEmit`, asignado a `this.tag`; UI encapsulada, GI intacto; override-able por framework. [tag-subcomponent.md](references/tag-subcomponent.md) |

## Configurar (data)

🔴 **REGLA lazy para FORMATEADORES (jcmunoz 2026-07-04, edge de edición 2026-07-05)**: si el formateo
**cambia la estructura HACIA ADELANTE del cursor** → el componente DEBE ser `lazy`. 🔴 **La dirección es
RELATIVA AL CURSOR, no propiedad del formato**: el MISMO formateo de agrupación (Rut, miles) es
hacia-atrás ESCRIBIENDO (append: los puntos se insertan detrás, cursor feliz) y hacia-ADELANTE al
**EDITAR un dígito INTERMEDIO** (la re-agrupación re-acomoda desde el punto de edición → cursor a la
cola). ⟹ el DEFAULT se decide por el TIPEO NORMAL (empírico: la gente NO edita al medio — borra
desde el error y re-escribe): **rompe tipeando ⟹ lazy obligatorio** (Currency/Number: el decimal);
**hacia-atrás en append (Rut) ⟹ sin lazy por default**, y si un deploy/cliente sufre la edición
intermedia → perilla declarativa (`types.Rut.set("lazy", true)` o en el type del plugin), cero código.
Con la CADENA REACTIVA COMPLETA del GF (2026-07-05: formValues/VSV
directo a los hijos, sube y baja viva) esto es REQUISITO ESTRUCTURAL, no UX: la re-bajada mid-tipeo
re-alimenta el input controlled y repinta. El lazy corta el ciclo en el único punto seguro: el blur.
(Bonus descubierto: campos con validación remota — Password/checkStrength — se vuelven naturalmente
lazy: UN request al blur en vez de throttle sufriendo por tecla.)
🔴 La prueba OBLIGADA de todo formateador: **tipeo SECUENCIAL real (no fill) en TODOS los niveles de
nesting + EDICIÓN de un dígito INTERMEDIO de un valor existente** — fill/paste/append no gatillan
estos bugs; solo el tipeo real y la edición al medio los cazan.

🔴 **FCC — DESPLAZAMIENTO DE FORMATEO: `lazyFormatter` + emitter formateador** (descubierto emergente
2026-07-06, ItdString; consagrado como patrón): el formato NO se aplica al display mid-tipeo (lazy)
sino EN LA SALIDA — `defaultEmitter(v) { return this.formatter(v) }` — el dato viaja SIEMPRE canónico.
La composición con la cadena reactiva completa produce la UX perfecta SOLA: (1) tipeas libre (display
raw, lazy no formatea el VSV); (2) el emitter sube el canónico (espacios trailing → trim → MISMO valor
canónico); (3) la re-bajada es el ECO de mi propia emisión → el corte de eco del watcher EV
(`isEqual(this.emitter(val), this.validateSelfRaw)` — 2026-07-13, [value-pipeline.md](references/value-pipeline.md))
la corta ANTES de tocar VSV → tu display intacto y CERO over-render; (4) solo cuando el canónico CAMBIA el watcher pisa y el display
converge al formato. Resultado: **display "eventualmente canónico"** — data SIEMPRE consistente,
cambios de display solo cuando es necesario, cursor sano. Aplica igual en componente puro (formatter
del componente) y DDD (`vo.emitter`). Contraejemplo vivo: Email emite RAW (sin defaultEmitter) → la
re-bajada formatea → lowercase EN VIVO ("no te deja meter mayúsculas") — correcto pa formatos
no-disruptivos, letal pa disruptivos (trim). Regla: **formato DISRUPTIVO (cambia length/estructura) ⟹
lazyFormatter + defaultEmitter formateador; no-disruptivo ⟹ puede formatear vivo**.

| Data | Default | Set when |
|------|---------|----------|
| `tag` | `inputTag` | Non-input: `"select"`, native: `"input"` |
| `lazy` | `false` | Componente DEPENDE de emisión deferred; 🔴 formateadores hacia-adelante (regla arriba) |
| `childrenLazy` | `false` (GF) | 🔴 NESTED-LAZY (2026-07-13): el CONTENEDOR (Embedded/SubdocRow) declara que sus HIJOS son lazy SIN ser lazy él — su canal queda libre, solo recibe valueUpdate. renderFormInput pasa `lazy: childrenLazy \|\| localLazy`. JAMÁS lazy en el GF padre (gatea su assignVSR → bloquea todo) |
| `forceLazy` | `undefined` (GI) | 🔴 VETO declarativo: boolean → localLazy lo retorna DIRECTO (manda sobre el OR del arrastre). Pa componentes donde lazy rompe por construcción: ArrayAdd (infra de crecimiento sin blur), Radio/CheckboxGroup NUI (grupos sin punto de delivery) |
| `type` | `"text"` | Diferente HTML input: `"email"`, `"checkbox"` |
| `valueProp` | `"value"` | DOM usa `"checked"` (checkbox) |
| `targetValue` | `"value"` | Event usa `"checked"` |
| `iconProp` | `"name"` | Front overrides: `"icon"` (BIcon) |
| `inputDefaults` | none | Merge en localInput on created |

## Override (methods)

| Method | Override when |
|--------|---------------|
| `initVal(v)` | Object values, type coercion |
| `emitter(v)` | Clean/coerce output |
| `formatter(v)` | Intl, trim, lowercase |
| `keypress(e)` | Numbers-only, max length |

Value vía `this.validateSelfValue` (computed get/set) — ese es el valor PROPIO del input (escalar o su
objeto completo), correcto acá. 🔴 Pero para **derivar** un dato de adentro (el valor de UNA llave, p.ej.
un GF pasándole su valor a cada hijo) va el contenedor declarado (`this[this.$options.$validateSelfValue]`), NO el VSV — el clon arrastra el objeto entero (ver
regla arriba). [value-pipeline.md](references/value-pipeline.md).

## Transient (display ≠ stored)

```
External (ObjectId) → initVal → validateSelfValue (display) → emitter → validateSelfRaw (ObjectId)
```

## Render Pipeline

`preInput + InputGroup(prepend + mainInput + append) + postInput`

Slots via slotOrRender: `preInput`, `postInput`, `prepend`, `append`, `children`, `extra`, `doubleCheckSeparator`. Direct (infrastructure): `content`, `mainInput`, `renderInput`. **buttonRight/Left** en `inputDefaults`, GI rendea en append/prepend auto. Iconos via `iconProp`. [render-methods.md](references/render-methods.md).

**Copy declarativo — 2 concerns separados** (2026-07-06): `copy: true` = botón copy en **view/detail** (`renderCopy`, junto a getTableViewValue); `copyInput: true` = botón copy en **modo INPUT** (`renderCopyInput`, compuesto como FRAGMENT en `renderAppend: [renderSide("right"), renderCopyInput()]` — hermanos directos del input-group, componible con `buttonRight`, ej. Password ojo+copy). Ambos van al `copyValue()` (delega al VO si existe) con `copyIcon` overrideable. 🔴 copyInput NO hereda el `disabled` del input a propósito — un campo read-only (access_token) DEBE poder copiar. Se declara en el schema del back y viaja solo (forms laxos, sin forceAttrs). NO sobrecargar `copy` pal input — arrastre de concern.

## Layout de columnas (container-driven)

El form NO usa breakpoints de viewport. Mide su **container** y deriva cuántas columnas caben:
`N = floor(containerWidth / colWidth)`. Dos perillas en el GF (definibles vía **specs del back** o
**prop directa** — cualquier dev acota el ancho): `colWidth` (ancho ideal de columna, default 280) y
`fit` (input mide colWidth vs llena el slot, default true). El span del input es `cols`
(ausente=1 slot, ≤1=%, >1=cantidad de columnas). Contenedores (Embedded/ArrayForm) → `cols:1`+`fit:false`
desde z99base. Drawer del filter → `filterWidth` (cascada -10/nivel). [layout-columns.md](references/layout-columns.md).

## DoubleCheck

DC rendea como instance independiente via `resolveComp(inputDC.component ?? inputDC.type)`. `inputDC` creado en GI's `created()` (non-reactive). Cada instance: own localInput, own buttonRight, own toggle. Sin shared state.

## Validación

Type validators: `addValidator("type", "type", fn)`. Composite: form validator itera `$refs.inputs`. [validate-self.md](references/validate-self.md).

## Front

Extends core, overrides tags/classes en `data()`. Sin Object.assign a globals.

```js
data() { return { inputTag: "BFormInput", iconProp: "icon" } }
```

[front-pattern.md](references/front-pattern.md).

## Componentes Estructurales

No-input components que viven en `views/` y participan del shell de App. Mismo patrón core/front + tags configurables, distinto rol.

| Componente | Rol | Reference |
|------------|-----|-----------|
| `ContentWrapper` | Shell envolviendo router-view: title + description + help button contextual al modelo. Lee `$route.meta` (pure receiver). Meta se popula dinámico desde schemas via `setRoute()`. | [content-wrapper.md](references/content-wrapper.md) |
| `ItdEmbedded` / `ItdFilter` | Sub-form anidado (lazy por punta) + el contexto Filter (drawer recursivo, wrapper GIWF). Un front nuevo puede necesitar su propio embedded y/o wrapper de filter. | [embedded-and-filter.md](references/embedded-and-filter.md) |

## References (cuándo leer)

- [core-rules-detail.md](references/core-rules-detail.md) — detalle de las reglas core: traducción (`t`/`rt`, `text` compuesto), clone guards, `watch` con `extends`, valor con type, HTML inyectado, buses, `applyLoaders`, derivar del contenedor crudo
- [vo-gi-contract.md](references/vo-gi-contract.md) — 🔴 contrato VO↔GI: data.VO + pseudoDoc, dispatch espejo 1:1, voOptions, reactividad del doc (push vs getter-tubo), por qué mata la herencia por similitud
- [viewtype-contract.md](references/viewtype-contract.md) — 🔴 contrato de capacidades por viewType: tabla data.viewTypes, support/supportOrThrow (weeo en el auxiliar, silent por punta), puntas disciernen/consumers pelados, fallback por componente, deps de loader en su mixin
- [controllers.md](references/controllers.md) — 🔴 sistema de controllers: controller (propiedades de inputs) vs generalController (modifica el FORM: componentes/estructura); corren en created bindeados a this; ubicación = traza del origen; disabled de SCHEMA ≠ disabled de UI (disableFields); catálogo
- [override-chain.md](references/override-chain.md) — 🔴 NO romper la cadena al override; sobrecargar defaultX, no el wrapper; caso emitter/between
- [mixins-model-context.md](references/mixins-model-context.md) — mixins globales model/contextType, cascada 3 puntas, transparencia props↔provides↔meta, `contextType`+`hasFormBus` (doble trap)
- [setup-lazy-async.md](references/setup-lazy-async.md) — setup vs options API (lifecycle), paradigma lazy/async (dato-on-create roto), 🪄 `formBus.getValue` reactivo/muerto, cross-field reactivo
- [itd-prefix-resolve-tag.md](references/itd-prefix-resolve-tag.md) — prefijo Itd (name vs declaración back), resolveTags/resolveComp/resolveTag, render JSX `resolveTag` directo vs `components: ci`
- [front-pure-receiver.md](references/front-pure-receiver.md) — front shape contract, excepción Vista
- [validate-self.md](references/validate-self.md) — validators, inner form, Mustache, endpoints
- [front-pattern.md](references/front-pattern.md) — front overrides, BV resets, **🔴 PRINCIPIO: formatter de entrada en FW con modo controlled/uncontrolled por prop ⟹ bindear por `value` (componente sin auto-gobierno)** — nuestra alimentación es imperativa (sin v-model), un componente auto-gobernado nunca muestra el formato; síntoma: "el formatter corre pero no se ve"
- [render-methods.md](references/render-methods.md) — getInputProps, resolveTags, render pipeline
- [layout-columns.md](references/layout-columns.md) — sistema de columnas container-driven: `colWidth`/`cols`/`fit`, `filterWidth`, contenedores cols:1+fit:false, n-ellipsis en celda
- [examples.md](references/examples.md) — código completo Level 1-5
- [checklist.md](references/checklist.md) — componente desde cero
- [value-pipeline.md](references/value-pipeline.md) — value flow, initVal/emitter/cast, viewType (render/emisión/validator), renderGI composite, cross-field `formBus.getValue`
- [data-props.md](references/data-props.md) — tag/event resolution, localImport cascade
- [anti-patterns.md](references/anti-patterns.md) — WRONG/RIGHT mistakes
- [deadlock-initval.md](references/deadlock-initval.md) — initVal lee child data → silent death
- [over-render.md](references/over-render.md) — linear flow, value en render
- [migration-workflow.md](references/migration-workflow.md) — .vue a JSX
- [cascade-inheritance.md](references/cascade-inheritance.md) — core extending core, top-level await, localImport vs directo, **setup transitividad** (named export + re-export, no lib-cascade)
- [slot-or-render.md](references/slot-or-render.md) — slotOrRender mixin, scoped slots
- [gf-direct-extension.md](references/gf-direct-extension.md) — Level 5: extend GF, innerForm, puntas
- [tag-subcomponent.md](references/tag-subcomponent.md) — Level 6: subcomponente Vue como `this.tag` para widgets ultra-complejos (file/editor/mapa); `$vModel:true`+`vModelEmit`, UI encapsulada sin tocar el render del GI, override-able por framework (caso ItdFile core/NUI)
- [embedded-and-filter.md](references/embedded-and-filter.md) — ItdEmbedded (sub-form lazy dual), contexto Filter, ItdFilter + GIWF drawer recursivo, layout label↔input — ⚠️ el "GIWF drawer recursivo" quedó OBSOLETO (ver nested-wrappers.md)
- [nested-wrappers.md](references/nested-wrappers.md) — 🔴 collapse/drawer por flag `nested` del back (front pure receiver); GIW único (absorbió GIWFilter, eliminado); transitividad `parentName` + `drawerWidth`/`reduceDrawerWidth`; `field()` en setup; lazy real (collapse no monta→no pide→no viaja); `inputName` real vs `logName` parchado; viewType transitivo (mató el flag `filter`)
- [back-end.md](references/back-end.md) — z99base.js type defaults, forceAttrs
- [local-pascal-pattern.md](references/local-pascal-pattern.md) — `localX` computed sin cascadas
- [loaders.md](references/loaders.md) — crear loaders (`addLoader`, factory pattern)
- [timeframe-postmortem.md](references/timeframe-postmortem.md) — build from scratch vs extending GI
- [content-wrapper.md](references/content-wrapper.md) — shell estructural, contrato `$route.meta`, pipeline dinámico schema→ruta, help system, NUI quirks
- [http-error-traps.md](references/http-error-traps.md) — mapa de traps de status del `$http` (401/400/403/423/404/429/500/fallBack), opt-out `config.noError` (400 esperado, ej. getSimpleName), por qué el body del GSN es string (findKey + Set dedup), override `appComponent.requestFallback`, feature pendiente de override total de options
- [translation-front.md](references/translation-front.md) — puertas `rt`/`t`/`useTranslation` (globales del pack, sin import: sus llamadores solo por grep), declarar en `created` y leer en render, norma de coordenadas y `childrenModel`, placeholder nace en el back y lo consume solo `GenericInput`, form suelto con `ItdForm`, cómo apuntar al lápiz y a los inputs desde un spec

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.

