# ContentWrapper — Shell estructural de App

Componente shell que vive en `App.vue` envolviendo `<router-view />`. Rendea title + description + botón de ayuda contextual al modelo de la ruta actual. Es **estructural** (no input), pero sigue el patrón core/front + tags configurables del FW.

## Ubicación

- **Core**: la vista `ContentWrapper` del core front
- **Uso**: `App.vue` lo importa via `localImport("ContentWrapper", "views")` y envuelve el `<router-view />` del root.
- **Override por front**: cada front (NUI, BV, futuros) crea su propio archivo en `views/ContentWrapper.jsx` que `extends Core` + `data()` con tags propios. Patrón documentado en `front-pattern.md`.

## Contrato — `$route.meta`

ContentWrapper es **pure receiver** del `$route.meta`. Lee tres campos, todos seteados desde el back (vía mongoose plugins en el armado de rutas — fuera de scope de este skill, viene resuelto al front):

| Campo | Uso |
|-------|-----|
| `meta.title` | h1 del header. **Gate del header**: sin title no rendea (ni botón help). |
| `meta.description` | `<p>` debajo del título. Gate propio: rendea solo si existe y `!== title`. |
| `meta.model` | Key del help system (cheap check + lazy fetch). Independiente del title. |

**Fallback chain del título** (en el computed `title`): `meta.title ?? meta.name ?? null`. `meta.name` = `route.name` de Vue Router (info de infra del router, no del shape de negocio). Sin `path` como fallback — mostrar el path crudo es feo y nunca es correcto.

**Title y model son conceptos distintos**: una ruta puede tener `title` sin `model` (página estructural con título: "Acerca de", "Términos") o `model` sin `title` (raro pero válido). El render gateа cada cosa por su propia presencia, no por la presencia de las otras.

**`title`, `description`, `model` son computed sobre `$route.meta`**, no estado interno. Reactividad gratis al navegar — no hay watcher poblando data, solo el watcher de `$route` que dispara `checkHelpExists()`.

**`document.title`** NO lo maneja ContentWrapper. Vive centralizado en el `index.js` del core front con `router.afterEach(to => document.title = to.meta?.title ?? firstTitle)`.

## Pipeline dinámico — De dónde viene el meta

Las rutas del FW se generan **dinámicamente** desde los schemas (back). En el back, mongoose plugins copian las options del schema (`name`, `description`, etc.) al `meta` de la definición de ruta. El front recibe rutas con meta poblada via store auth, y Vue Router cascadea `meta` parent→child por `matched`.

**Clave para el front dev**: nunca tocas la generación de rutas. Cambias `description` en el schema → afecta directo lo que rendea ContentWrapper en runtime. Si falta info en `meta` → arreglar back, no agregar fallback en front.

## Help system

ContentWrapper integra el sistema universal de Help (FWPlugin `Helper.js`):

- `checkHelp` (cheap, boolean): el watcher de `$route` lo dispara en cada navegación → store `Helper/checkHelp` → endpoint `/AAA/<Model>.checkHelp` → setea `helpExists`. Decide si mostrar el botón sin traer payload.
- `getHelp` (lazy, content full): solo al click → store `Helper/getHelp` → endpoint `/AAA/<Model>.help` → abre modal. El content puede pesar megas (imágenes, videos), no se trae hasta que el user lo pide.
- **Cache vive en el store Helper** (key = nombre del modelo). Invalidación = recarga del browser. No hay TTL ni endpoint de invalidación; el modelo de uso es "el help cambia rara vez, recarga si lo editaste".
- Endpoints son **universales** (plugin global mongoose en FWPlugin `Helper`), no requieren registro per-schema.

## Tags configurables (data)

Idéntico al patrón input — cada front sobrecarga en su propio `data()`:

| Data | Default core |
|------|--------------|
| `headerTag` + `headerProps` + `headerClass` | `"div"` + `{}` + `content-wrapper-header` |
| `titleTag` + `titleProps` + `titleClass` | `"h1"` + `{}` + `content-wrapper-title` |
| `descriptionTag` + `descriptionProps` + `descriptionClass` | `"p"` + `{}` + `content-wrapper-description` |
| `buttonTag` + `buttonProps` + `buttonClass` | `"button"` + `{type:"button"}` + `content-wrapper-help-btn` |
| `dialogTag` + `dialogProps` + `dialogClass` | `"dialog"` (HTML5 native) + `{}` + `content-wrapper-help-dialog` |
| `iconTag` + `iconProps` | `"ItdIcon"` + `{name:"info-circle", size:16}` |
| `buttonText`, `closeText` | `"Ayuda"`, `"Cerrar"` |

## `renderHelp()` — Override estratégico

Method override-able. Por default rendea `<dialog>` HTML5 con `showModal()/close()` + ref `help`. Fronts que prefieran modal imperativo (composables tipo `useDialog`) pueden sobrecargar `renderHelp()` a `null` y sobrecargar `showHelp()` para invocar el modal de su librería. Bridge a composables externos via `setup()` retornando el handle.

## Render guard

```jsx
{this.title && <Header...>}            // header solo si hay title
{this.description && <Description...>} // description solo si hay (computed gateа === title)
{slot.default}                         // siempre
{renderHelp()}                         // siempre (sobrecarga a null si front usa modal imperativo)
```

Cada elemento gateа por su propia presencia, no por la del modelo. Ruta sin title (Home, Login antes de auth) → no rendea header, va directo al slot. Ruta con `model` pero `title=null` → no rendea botón help (vive dentro del header).

## Antipatrones

- ❌ Tocar `route.meta` desde el front o agregar fallbacks que inventen info (front pure receiver). Si falta info → arreglar el back.
- ❌ Extender el fallback chain del title con `path` u otros guesses ("ya hay fallback chain, sumar uno más es consistente"). El chain actual usa solo info de router/path crudo, NO inventa shape de negocio.
- ❌ Hardcodear endpoints de help per-schema (FWPlugin Helper.js los inyecta universal).
- ❌ Replicar el seteo de `document.title` en el componente (vive centralizado en index.js).
- ❌ Renderear modal/dialog declarativamente cuando el front-UI tiene API imperativa — sobrecargar `renderHelp()` a null + bridgear el composable en setup.
