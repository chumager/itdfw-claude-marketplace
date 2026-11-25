# Una RUTA no es una PUNTA y las rutas del front se declaran en el BACK

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle y los casos.

## 🔴 Una RUTA no es una PUNTA: el fallback SPA y el warn "404" del log

El back solo conoce dos cosas: las puntas `/APP/<func>.<ext>` y los archivos estáticos del `html/`. **Cualquier
otro path** (`/auth`, `/Members`, `/Places/123`) es una ruta del router del front: el último middleware de
`server.js` la sirve con **`index.html` y status 200**, y deja en el log un `Log.warn("404 <url> not found")`. Ese
warn es el fallback normal de una SPA, no un error: la decisión de si la página existe la toma el router del
front, ya en el browser (`ItdComponentNotFound` si no la tiene).

⟹ Pedir una ruta por curl, MCP o cliente headless devuelve el HTML del index, nunca JSON. Quien lo hace y lee el
warn del log concluye "el back tira 404 en /auth" (p. ej. en un site de demo). Lo mismo con `AAA/getConfig` y
`AAA/checkLogin` llamados desde el MCP: son puntas de **bootstrap de la sesión del browser** (el front las pide al
cargar); desde un cliente que ya se autenticó por su propia vía no prueban nada.

| Path | Quién responde | Status |
|---|---|---|
| `/APP/AAA/checkLogin.json` | `execEndpoint` | lo que diga la punta |
| `/APP/noExiste.json` | `execEndpoint` | 404 `UNKNOWN FUNCTION` |
| `/auth`, `/Members` | fallback SPA → `index.html` | **200** + warn "404" en el log |

Litmus: *¿tiene `/APP/` y extensión?* No → es ruta, se prueba en el browser (Playwright), no por HTTP crudo.

## 🔴 Rutas del front se declaran en el BACK

**El `router.js` del site NO es el lugar para declarar una pantalla que va al menú.** El menú se arma desde el
back: `Profile.getFunctions` → `userData.functions[]`, y cada función trae la `route` que el back armó. El
`router.js` del site sirve **solo** para rutas que no deben salir en el menú (un detalle al que se llega desde
otra pantalla). Una pantalla puesta ahí funciona escribiendo la URL a mano y **nunca aparece en el menú** — un
site entero implementado así se reporta como defecto del FW.

**Camino 1 — la ruta es de un modelo: `schema.options.route`.** `setRoute` (`FrontEnd.js`, static del plugin
`FrontEnd`) arma el árbol base —`View` raíz, `Create/:mode?`, `Update/:id/:mode?`, `Upload` si hay `transform`— y
hace **deep merge** con lo declarado. Los `children` se mergean **por `path`**: se agrega uno sin tocar los otros.

```js
// options del schema — agrega /Places/:id sin perder View/Create/Update
route: {
  children: [{path: ":id", component: "PlaceDetail", props: true, meta: {type: "Detail"}}]
}
// un string en vez de objeto solo cambia el componente del View raíz:
route: "PlaceGrid"
```

El path raíz lo pone el FW desde el modelo; `meta.model`/`modelName` se inyectan al root y caen en cascada a los
hijos; el `component` es un **string** que la cascada del front resuelve desde `views/`/`components/`.

**Camino 2 — la ruta es de una punta libre** (`APP/` u `options.API`): la punta lleva la `route` completa (ejemplo
real: `AAA/recovery` en `User.js`):

```js
"places/detail": {
  GET: {json(req, res) {/* … */}},
  defaultMethods: ["GET"],
  name: "Detalle de sucursal",           // lo que muestra el menú
  component: "PlaceDetail",
  route: {path: "/Places/:id", name: "placeDetail", props: true, component: "PlaceDetail", meta: {model: "Place"}}
}
```

**Los tres flags, tres efectos distintos** (ninguno "pone" la pantalla en el menú: llegar en el perfil la pone):

| Flag | Efecto |
|---|---|
| (la función está en el perfil) | **ya está en el menú**: `userData.functions` la trae |
| `hidden: true` | existe y se puede llamar, pero **no sale** en el menú |
| `inNav: true` | **además** un link directo en la barra superior (`nav`). Ponérselo a todo solo llena el nav |
| `noProfile: true` | no es asignable a perfiles (puntas de infraestructura) |

**Desde una punta, las funciones del que llama** son las mismas que ve su menú: `const user = await
req.getUser()` (null si anónimo) y `(await user.userData(req)).functions` — `path` ya prefijado
(`/APP/AAA/User`), con `hidden`, `route.children[].meta.type` (View/Create/Update). Ejemplo: el ref-función
`User.intent` del plugin `typesafe`.

**Lo que recibe el front al autenticarse** (`checkLogin` → `{user, userData, forceLink}`; las funciones sin
`route` no son pantallas). Cada función: `path`, `name`,
`defaultMethods`, `inNav`, `hidden` y su `route`. La de un modelo llega así:

```js
route: {component: "baseModel", props: {model: "PlanExercise"}, children: [
  {path: "",                  component: "View", meta: {method: "GET",  type: "View"}},
  {path: "Create/:mode?",     component: "Form", meta: {method: "POST", type: "Create"}},
  {path: "Update/:id/:mode?", component: "Form", meta: {method: "PUT",  type: "Update"}}
]}
```
