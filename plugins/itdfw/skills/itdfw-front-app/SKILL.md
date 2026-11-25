---
name: itdfw-front-app
description: Use when working with an ITDFW SITE/APP layer — wiring a new site that consumes a front-library, understanding the cascade override system (localImport, customImport, customImportArray, customImportMerge), overriding components/mixins/controllers/stores via cascade, writing init.js for pack customization, configuring vite for a SITE, or debugging why a component loads from the wrong cascade level. NOT for creating a front-library itself (use itdfw-front-creation) or coding components inside one (use itdfw-front-develop).
---

# ITDFW Front & App Development

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [cascade-system.md](references/cascade-system.md) | Cascada de import: búsqueda vertical (basePaths) y horizontal (6 variantes), `localImport`/`customImport*`, `skipDefault`, CSS | Entender la búsqueda vertical + horizontal, skipDefault, o por qué algo carga del nivel equivocado |
| [init-pattern.md](references/init-pattern.md) | Patrón de `init.js`: estructura, contexto `this`, orden de ejecución, ejemplo del loader BVP, override de core | Escribes init.js, manipulas el pack o el loader BVP |
| [injection-system.md](references/injection-system.md) | Inyección de mixins por cascada (`injections/`), cuándo corre, ruta espejo de la base, casos de uso y gotcha | Auto-carga de mixins o directorio injections |
| [vite-setup.md](references/vite-setup.md) | Config de Vite: front extiende core, aliases, flujo del index.html, `skipDefault`, detección de plugin, salida | Configuras Vite, aliases, transformIndexHtml o detección de plugin |

## Overview

ITDFW uses a vertical cascade where each layer can override the one below. Files at higher levels shadow lower levels. The framework resolves everything via `localImport` which searches through the cascade automatically.

## Cascade Order (Priority)

```
@ (app/site)  →  default  →  plugin levels (<name>-<key>; suite plugins like nui last)  →  core
   highest                                                                                 lowest
```

🔴 There is **no `itdfw` alias** (TDD-cli, 4-oct-2026): NUI is the plugin `nui`. The core never imports `nui/…`; only a
plugin's `nui` folder may (it exists only when the suite is active). Anything the core loads from the levels goes
through the cascade (`localImport`, `frontLevels()`), never through a fixed alias.

`customImport`: first-return (app wins). `customImportArray`: accumulated (core first, app last). `customImportMerge`: merged object (app overwrites core).

## Quick Reference

| Need to... | Do this |
|------------|---------|
| Override a component | Create same filename in your level's `components/` |
| Add behavior to existing component | Create `injections/<base>/CompName.js` — 🔴 la ruta ESPEJA la base del componente, y `App` se carga con base **vacía** → `injections/App.js`. Path malo = silencio total, sin error. Ver [injection-system.md](references/injection-system.md) |
| Add init logic | Create `init.js` exporting `async function(pack)` |
| Override store module | Create same filename in `store/modules/` (deep-merges) |
| Add routes | Create `router.js` exporting route array — 🔴 **SOLO para rutas que NO van al menú** (un detalle al que se llega desde otra pantalla). Las que van al menú se declaran en el **back** (`schema.options.route` o la `route` de la punta), porque el menú se arma desde `userData.functions`: skill `itdfw-api-system` §"Rutas del front se declaran en el BACK". Un router.js con la pantalla principal del site = pantalla inalcanzable desde el menú (caso real 2026-09-15) |
| Afinar estilos desde tu nivel | `src/css/mergedStyle.css` — se ACUMULA (core → … → site). 🔴 NO uses `cascadeStyle.css`: es first-return y **reemplaza el del core**. Un CSS de UN componente va en su SFC (`<style src="core/css/x.css">`), no acá. Detalle: [cascade-system.md](references/cascade-system.md) |
| Add a static asset (PWA icons, `assetlinks.json`, favicon) | Put it in `public/` at ANY level: the vite-plugin copies `public/` of core → front → plugins → default → site onto `html/` at `closeBundle` (site wins). Vite alone only copies the root's `public/` (2026-09-07) |
| Override controller | Create same filename in `controllers/` |
| Add service-worker logic | `sw.js` in your level's folder (next to `components/`): the core's `vite.config` lists every level that has one (`frontLevels()`) and its SW imports them statically, core first and site last. Plugins' levels included (20-oct-2026) |
| Cambiar el LOGO del site | 🔴 NO es un archivo ni un deploy: es **Config** (modelo, se edita en el admin del site); `App.js` lo lee de ahí. El favicon SÍ es archivo: `public/favicon.*` en el nivel del site (fila de arriba) |
| Menú / barras / drawer | NO reescribir el shell del `ContentWrapper`. Las barras son sinks (`nav`, `side`, `drawer`) y todo lo que va en ellas es un ítem del store `app`, incluidos logo, hamburguesa, login, avatar y menú (skill `itdfw-nui` §5). Otro aspecto de un ítem: su componente por cascada (`components/`) o cambiado en el ítem |
| Barra lateral, sin nav, solo hamburguesa, sin login | 🔴 Es configuración, no cirugía del shell: en el `init.js` del site, `this.store.commit("app/setDisplay", {xs: ["nav", "drawer"], xl: ["nav", "side"]})` (sinks por breakpoint, mobile-first) y los ítems con su `sink` (string, arreglo o función de `{atLeast, breakpoint, touch, store, route}`). Sacar algo es `removeNavItem(key)`; un front sin barras es `setDisplay({xs: []})`. Si el site saca el login, no hay login: es su decisión. Contrato: el TDD de nav-items de NUI (enmienda 4) |
| Algo al CENTRO de la barra (un buscador) | ítem del store con `position: "center"` (skill `itdfw-nui` §5): queda centrado en la barra; sin ítems center la barra queda igual |
| Otro menú, o el menú con otra fuente | el menú lee `app.menu`: un `init.js` enchufa `commit("app/setMenu", {ref: "…"})` o `{options: [...]}` y el core ya no pone las funciones del usuario. Otra presentación: otro componente en el ítem `menu`. Contrato: el TDD de menu de NUI |
| Saber en qué tramo de pantalla estoy, en cualquier componente | `store.state.app.breakpoint` y el getter `app/atLeast(nombre)` (tramos `xs`…`5xl` en px CSS, pisables con `setBreakpoints`): reactivos y solo cambian al cambiar de tramo. El ancho exacto no está en el store: se mide |
| Saber en qué barra está un componente | `inject: {sink: {default: "nav"}}`: cada barra hace `provide("sink")` |
| Overlay de "cargando" | `ItdOverlay` (core dummy + NUI con `n-spin`), montado en `App.vue`: visible mientras hay requests **bloqueantes** en vuelo (store `loading.loadCount`, que alimenta la option `pending` de smart-fetch desde el init; la baja va diferida 250 ms, el orden del reflejo humano: con menos solo se ve flicker, y una ráfaga se ve como una sola aparición). Se apaga o se ajusta **en el `init.js` del site**, que corre después de crear los stores y antes de cualquier request (`store.state.loading.enabled = false`; también `showCount`, `spinner`), no pisando el módulo del store (jcmunoz 26-sep: un override de store obliga a documentar y buscar en otro lado). El componente se reemplaza por cascada. 🔴 Todo request de FONDO va con `noBlock: true` (traducciones, revisiones, pings): no cuenta y no tapa la pantalla |
| Idioma del código | 🔴 Identificadores, funciones, variables, archivos y comentarios en **inglés**, camelCase. Solo los textos que ve el usuario van en español (y por el sistema de traducción, no hardcodeados) |

## Horizontal Search (6 Name Variants)

`localImport("string")` tries at EACH cascade level:
`string`, `string` (camel), `String` (pascal), `itd-string`, `itdString`, `ItdString`

First match wins. Be consistent with naming.

## Vite Configuration

Front extends core config:
```js
import createViteConfig from "core/vite.config.js";
export default createViteConfig(__dirname, myVitePlugin);
```

Core handles: aliases (@, default, one per plugin level, core), transformIndexHtml (auto-injects main.js), skipDefault logic.

## El CLI: `dev` y `build` son AUTÓNOMOS (2026-08-19)

🔴 **Ni `dev` ni `build` necesitan el back.** No hay que tenerlo corriendo, ni en dev, ni en absoluto.

```sh
pnpm itdfw dev                      # el site sale del DIRECTORIO PADRE
pnpm itdfw dev --host <site>        # solo desde DEFAULT
pnpm itdfw build -C <deploy>       # la extensión la resuelve el config-loader
```

| Flag / env | Qué define |
|---|---|
| `-c` · `ITDFW_CONFIG_PATH` | la **ruta** de los configs (default `/etc/itdfw`) |
| `-C` · `ITDFW_CONFIG_FILE` | el **archivo** de config |
| `--host` (solo dev) | **qué site** — NO es una interfaz de red |

🔴 **Los flags se traducen a env, y no es capricho**: vite **se come** los flags que no conoce, y la
función del `vite.config` solo recibe `{command, mode, isSsrBuild, isPreview}` — la CLI no le llega.
Lo único que cruza esa frontera es el entorno.

### Las tres capas del "host", que NO son la misma

Confundirlas es el error que costó la mañana del 2026-08-19:

| | Quién lo resuelve |
|---|---|
| **Qué site soy** (para leer la config) | el directorio padre, o `--host` desde DEFAULT → `ITDFW_SITE` |
| **En qué interfaz escucho** | `server.host = "0.0.0.0"` — todas, siempre |
| **Qué Host llega al back** | `changeOrigin: true` lo reescribe al target |

⟹ Pasarle `--host <site>` a **vite** revienta con `ENOTFOUND`: el nombre del site no es un DNS
resolvible. El que sí lo es (y solo sirve para el proxy) es el `devHost` del YAML.

**La URL de dev** (el target del proxy, y la misma contra la que corren las suites) es
`<protocolo>://<devHost>:<devPort ?? Port>` (`devTarget()` en el `vite.config` del core, ≥ 7.3.0). El protocolo es
`https` si `Protocol` lo es o si hay `fakeHTTPS`. Detrás de un proxy reverso en dev (nginx terminando TLS) se declara
`fakeHTTPS: true` y `devPort` con el puerto del proxy; `devHost` es el nombre público, que también es por donde se
entra al vite (`<devHost>:8080`). `devPort` puede ir en la raíz del yaml si todos los sites entran por el mismo
puerto. 🔴 Un `devHost` en el `.itdfw.js` del site le gana al del yaml.

### Dos traps que hoy fallan RUIDOSO (antes fallaban en silencio)

1. **Config equivocada** → el `vite.config` corta al arrancar si el site no trae `devHost`. `devHost`
   vive **solo en el bloque del site** y la búsqueda es laxa (site → root): que falte **es la prueba**
   de que cargaste otra config. Antes: proxy a `http://undefined:undefined` y a debuggear el front.
2. **Host equivocado** → guard en `configureServer` que responde **421** con el host correcto. El server
   escucha en `0.0.0.0`, así que sin esto `pepito.localhost:8080` te devuelve otro site sin avisar —
   letal con varios sites levantados. Solo se soporta el `devHost`: usarlo como `localhost` es decisión
   de quien configura.

### Qué desapareció

El mini-servidor del puerto **8877** (`if (onDev)` en `server.js`) que devolvía por HTTP un script shell
con el comando de vite. Era **vestigio**: nació cuando el front no podía resolver solo qué config leer.
Y además era **incorrecto** — devolvía la config **con la que arrancó el back**, no la del site donde
está parado el dev; si el back corría con otro deploy, te daba la config equivocada sin decir nada.

### Deploy (esto no cambió)

Se transpila en un entorno dev → se versiona el `html/` resultante → se despliega ese `html/` ya
transpilado en producción, que **sirve** el transpilado sin regenerarlo. Por eso `html/` SÍ se versiona.
`firstTime` es ortogonal: solo libera permisos de los modelos base (bootstrap anónimo).

## Anti-Patterns

| WRONG | RIGHT | Why |
|-------|-------|-----|
| Create front file that only extends core | Don't create it | Noop = waste, cascade finds core |
| `import X from "bootstrap-vue"` for one export | Wrapper in `lib/` with named imports | Loads entire library |
| Modify pack after applyPack | Modify in init.js | the pack is only handed to init.js |
| Assume core init ran before app init | Core runs LAST in init cascade | `@ → default → ... → core` |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
