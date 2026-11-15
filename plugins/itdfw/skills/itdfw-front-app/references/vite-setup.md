# Vite Configuration

## Front Extends Core

```js
// fronts/my-front/vite.config.js
import createViteConfig from "core/vite.config.js";
export default createViteConfig(__dirname, myVitePlugin);
```

Core `createViteConfig(frontDir, plugin)` handles everything. Front only needs to pass its directory and framework plugin.

## What Core Config Provides

### Aliases (auto-generated)
- `@` → `process.cwd()/src` (app/site)
- `default` → `findFrontDir(documentRoot/DEFAULT)/src` (hoy `DEFAULT/site/src`; `DEFAULT/vue` es el fallback histórico)
- `itdfw` → `frontDir/src` (front base)
- `core` → `__dirname/src` (framework core)

### Dónde nace el flujo (verificado 2026-09-05)
🔴 Ya NO hay `transformIndexHtml` que inyecte `main.js`. El `index.html` que gana la cascada trae **explícito**
`<script type="module" src="/src/main.js">`, y Vite lo resuelve contra el `root` (el directorio de ese index).
Caso normal (site, DEFAULT y front sin `index.html`; NUI los soltó en 784cc87d): `root` = el **core** →
el `index.html` del core front → su `src/main.js` (`run()` de su `index.js`, el bootstrap).
El build lo dice: `[itdfw] index: <root>`. **DEFAULT y el site NO necesitan index ni main**: aportan por los alias de
la cascada (`default`, `@`) que resuelve `localImport`.

🔴 **Regla: donde vive `index.html` vive `src/main.js`, en el mismo nivel.** Un nivel que pone su propio `index.html`
(uno más vistoso en un front) gana el `root`, y el `/src/main.js` de ese index se resuelve contra ese `root`: sin su
`src/main.js` el build no arranca. `public/` en cambio SÍ se suma: el vite-plugin copia el `public/` de core → front →
plugins → default → site sobre `html/` (gana el site), así que un site cambia `splash.svg` o el favicon poniéndolo en
su `public/`, sin tocar `index.html`. El guard `itdfw-env-guard` tumba el build si al final falta `html/env.js`.

**Splash inicial** (core `index.html` enlaza `/splash.css`): CSS puro, cero JS, sin tokens del tema (no existen
todavía): `#app:empty { min-height: 100vh; background: url(/splash.svg) center no-repeat }` más el color por
`prefers-color-scheme`. Va en `public/splash.css` y no inline, para que la cascada de `public/` deje a un site
cambiar estilo e imagen sin pisar el `index.html`. Vue al montar llena `#app`, deja de matchear `:empty` y el splash desaparece solo.
🔴 `<div id="app"></div>` va pegado: un espacio o un salto de línea adentro es contenido y `:empty` deja de
matchear (el splash no sale nunca). El SVG animado sirve como `background-image` (CSS/SMIL corren; `<script>` no) y
puede traer su propio `@media (prefers-color-scheme: dark)`. El core trae `splash.css` y `splash.svg` genéricos; cada site pone los suyos en su `public/`.

### skipDefault
When `!configGet("withDefault")` OR `cwd === DEFAULT/vue/src`:
- Removes "default" from basePaths
- Sets `process.env.VUE_APP_NODEFAULT`
- Sets `__SKIP_DEFAULT__` define

### Plugin Framework Detection
Detects framework from vite plugins: `vite:vue2`, `vite:vue`, `vite:react`, etc. Maps to plugin aliases from `.itdfw.js` files.

## Root Cascade for index.html
```
[cwd (site), findFrontDir(DEFAULT), frontDir, __dirname (core)]  — first with index.html wins (and sets root + publicDir)
```

## Output
```js
outDir: path.resolve(process.cwd(), "../html")  — always absolute
```

## Customizing Front Config

```js
const coreConfig = createViteConfig(__dirname, plugin);
export default {
  ...coreConfig,
  plugins: [myPlugin(), ...coreConfig.plugins],  // prepend front plugins
  resolve: {
    ...coreConfig.resolve,
    alias: [...coreConfig.resolve.alias, {find: /^vuex$/, replacement: "..."}]
  }
};
```
