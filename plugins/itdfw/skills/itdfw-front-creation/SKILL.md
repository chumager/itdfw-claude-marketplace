---
name: itdfw-front-creation
description: Use when creating a new ITDFW frontend LIBRARY (eslabón) — a new `fronts/itdfw-X` package wrapping a UI framework (BV, NUI, PrimeVue, etc.) so the core can cascade through it. Triggers: package.json/vite.config.js/main.js setup, dependency rules for the front library, framework-specific component overrides with tags. NOT for site-level wiring (use itdfw-front-app) or day-to-day component development (use itdfw-front-develop).
---

# ITDFW Front Creation

## Core Concept

A front is NOT an app — it's a **library (eslabón)** in the chain: `core → front → DEFAULT → @(sitio)`. The site runs, not the front.

## Structure

```
fronts/itdfw-{nombre}/
├── package.json
├── vite.config.js
└── src/
    ├── main.js           (una línea: import "core/main.js")
    └── components/       (overrides de core con tags del UI framework)
```

## Package.json Rules

- **Name**: `@chumager/itdfw-front-{nombre}` — obligatorio, el back busca este prefijo
- **Dependencies** (NUNCA devDeps — biblioteca que transiciona):
  - `@chumager/itdfw-site-vue-core` (workspace)
  - Vue ecosystem: `vue`, `vuex`, `vue-router`, `vue-async-computed`
  - Plugins vite: `@vitejs/plugin-vue`, `@vitejs/plugin-vue-jsx`
- **Peer**: `vite` (el sitio lo instala)
- **Bin**: `"itdfw": "./node_modules/.bin/itdfw"` (transfiere CLI)
- **NUNCA** editar package.json para módulos — siempre `pnpm add`/`pnpm remove`

## vite.config.js

```js
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));

import createViteConfig from "@chumager/itdfw-site-vue-core/vite.config.js";
import plugin from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";

const coreViteConfig = createViteConfig(__dirname, plugin);
export default {
  ...coreViteConfig,
  plugins: [
    vueJsx({isCustomElement: tag => tag.startsWith("itd-wc-")}),
    ...coreViteConfig.plugins
  ]
};
```

- Core genera config base via `createViteConfig(__dirname, vuePlugin)`
- Front extiende con spread + agrega JSX plugin
- `isCustomElement` en JSX plugin (no en vue plugin — JSX no pasa por template compiler)
- Los aliases de vuex/vue-router/vue-async-computed YA están en core — NO duplicar

## src/main.js

```js
import "core/main.js";
```

## Sitio (consumidor)

```
/var/www/{sitio}/DEFAULT/site/
├── package.json     (front como dep + vite)
└── .itdfw.js        (config plugins)
```

El sitio instala el front + vite. Nada más.

## Lo que NO va en el front

- No `index.html` (viene de la cadena, el que tiene index tiene main)
- No router/store (vienen del core)
- No dependencias del FW (logger, config-loader — transitivas del core)
- No vite como dep (peer — el sitio lo instala)
- No alias de vuex/vue-router (ya en core)

## Components (override de core)

El front solo agrega componentes que overridean tags/clases del core para el UI framework (BV, PrimeVue, etc.):

```jsx
import CoreComponent from "core/components/ItdX.jsx";
export default {
  extends: CoreComponent,
  data() {
    return { inputTag: "PrimeInputText", iconProp: "class" };
  }
};
```

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
