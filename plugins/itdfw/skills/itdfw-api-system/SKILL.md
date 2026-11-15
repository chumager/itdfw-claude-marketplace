---
name: itdfw-api-system
description: Use when adding a backend endpoint to ITDFW, choosing between APP/, schema.options.<verb> and schema.options.API, debugging endpoint resolution (UNKNOWN FUNCTION, 404, 401/403), wiring permissions for a route, understanding `this === Model` binding inside schema endpoints, AAA authentication flow (x-itd-access, JWT, session, anonymous), or working with `pool.API`, execEndpoint and the URL pattern `/APP/<func>.<ext>`.
---

# ITDFW API System

## 🔴 Índice por SÍNTOMA — entra por acá si vienes de un problema, no de una definición

Este skill es una referencia larga y se lee por el lado por el que uno ya sabe entrar. Si llegaste con un síntoma:

| Síntoma | Sección |
|---|---|
| "mi pantalla no aparece en el menú" / "la ruta del `router.js` del site queda oculta" | §Rutas del front se declaran en el BACK |
| "¿pongo `inNav` para que salga en el menú?" | §Rutas… → tabla de los tres flags |
| "la sección anidada del formulario sale vacía" / "guardar borró lo que había" | `references/model-administration.md` §setRoute (el `id` sale de `route.params`) |
| "el formulario manda POST cuando debería mandar PUT" | `references/model-administration.md` §setRoute (`meta.method` → `formBundle`) |
| "guardé y no pasó nada, sin error" | `references/model-administration.md` §Filtro de emisión → campos omitidos en silencio · y el límite del cuerpo (`bodyParser`, skill `itdfw-deploy-config`) |
| "filtré `tableData` y me devuelve todo" | `references/model-administration.md` §Las puntas del contrato (`filter[campo]=valor`) |
| "mi error de validación llega como 500" | §Flujo de errores (`HTTPError` es global; se tira desde `pre save`) |
| "en las pruebas responde 200 o 401 al azar" / "`getConfig` da 401 en el arnés" | §AAA → JWT es headless, el front espera sesión |
| "¿le muestro el 403 al usuario?" | §AAA → 401/403 son flujo, no fallas |
| "UNKNOWN FUNCTION" / 404 en una punta que existe | §Executor (falta la ext) · §Coherencia estructural |
| "¿esta punta va en `APP/`, en `options.<VERB>` o en `options.API`?" | §Decision Tree |
| "un webhook de un tercero no pasa" | §CSRF (`skipCSRF`) · §AAA (`Authorization` ajeno) |
| "el nombre del archivo subido llega con caracteres raros" | resuelto en back 7.3.6 (`defParamCharset: "utf8"`); antes, latin1 |

## Overview

ITDFW exposes HTTP via four implementation levels that all collapse into a single `pool.API` registry consumed by `execEndpoint`. URL shape is `/APP/<func>.<ext>` where `<func>` is the registered key in `pool.API`.

**Crítico — cómo se construye `<func>` para archivos de `APP/`**: el loader `api.loadAPI` (`addToTreeGeneric` en el loader de APIs del core) hace `path.join(filename_sin_ext, exportedKey)`. **El filename del archivo entra como prefijo automático del path**. Un export `setVersion` en `APP/AAA.js` queda registrado como `pool.API["AAA/setVersion"]` y se accede en `/APP/AAA/setVersion.<ext>`. Si estuviera en `APP/payment/webpay.js` quedaría en `/APP/payment/webpay/<key>.<ext>`. **El filename ES literalmente el scope**, no es solo agrupación lógica — viaja al path.
🔴 **Dos escapes para acortar** (`addToTreeGeneric`, no estaban en este skill hasta 2026-09-09): (a) a nivel de
ARCHIVO, un archivo llamado **`APP.js`** no pone prefijo: sus exports quedan en `/APP/<punta>` en vez de
`/APP/APP/<punta>`; (b) a nivel de PUNTA, la propiedad **`__name`** en el objeto exportado **reemplaza la KEY
del export, no el prefijo del archivo**: el loader hace `path.join(name, funcName)` con `funcName = __name || key`,
así que `__name: "x/y"` en `APP/bank.js` queda en `/APP/bank/x/y`. El único escape del prefijo es llamar al archivo
`APP.js` (gap #39, cazado 20-sep-2026 armando el banco de smart-fetch: se creía que `__name` fijaba el path literal).
⚠️ Esto es SOLO para archivos cargados por `loadAPI` (la carpeta
`APP/` de un site/deploy). **La key `API` de un FWPlugin NO lleva prefijo**: `Object.assign(pool.API, value)`
copia las claves tal cual, así que el plugin escribe el path completo (`"openid/token"`, como
`"notifications/vapidKey"`); con la clave pelada da 404 (cazado 2026-09-09, plugin `openid`).

🔴 **Idioma del código: inglés.** Nombres de puntas, funciones, parámetros, campos y comentarios en inglés camelCase
(`getActiveOffers`, no `obtenerOfertasActivas`). Solo los mensajes que ve el usuario van en español, por traducción.

Choice of level is driven by **two axes**: ownership of permissions and structural relation to data (Model, Type, file group, or none). Encapsulación baja hasta el dato mismo: `mongooseTypes` declaran APIs que cualquier schema usando ese tipo hereda gratis.

## 🔴 Premisa: puntas dinámicas con ORIGEN en el back

El front es **receptor puro** de las puntas dinámicas. "**Qué pido**" lo determina `contextType` (Create/Update/Register/Profile/View); "**cómo lo pido/envío**" lo determina `method` (POST/PUT). AMBOS viajan del back al front vía la ruta (`setRoute` → `route.props.{contextType, method}`). El front NUNCA deriva ni decide esto — es la hermana de "front pure receiver" (que aplica al *shape* de inputs) pero para las *puntas*.

**🔴 Red flag** ("enanito del bosque"): si un componente front **mapea o deriva** el verbo o el tipo — ej. `methodMap = {Create:"post", Update:"put"}` indexado por `contextType` — es un **parche que usurpa la decisión del back**. Fix: borrar el mapeo, leer de la ruta (`route.props.method`). Caso real 2026-05-30: methodMap en `views/Form.jsx` (combinado con firma posicional de `setForm`) → submit mandaba siempre POST, sin datos → CRUD roto.

**Único contrato INVERSO** (front→back): el front puede pedir **SWR sobre una mutación** (cache GET respetando permisos del verbo real). El back provee **puntas GET espejo** (ver `req.changeMethod` en "Administración de Modelos") y el front se compromete a mandar **TODO por QS, nunca body** (body en GET rompe el contrato HTTP W3C).

## Decision Tree: which level?

| Need | Level | Why |
|------|-------|-----|
| Cross-model report, integration, dashboard, RPC, dev tool | **APP/ file** | No Model bond, free to design permissions per endpoint |
| CRUD/list/filter/specs over ONE Model, follows model's permission gate | **`schema.options.<VERB>`** | Inherits `Model.canSee` permissions; `this === Model` |
| Action ON a Model that must NOT inherit Model permissions (per-user, per-doc, public form) | **`schema.options.API`** | Cuelga del schema (`this === Model`) but registered as a free endpoint with its own `isAnonymous`/`auth` |
| Operation intrinsic to a DATA TYPE (validate strength, decode, hash check, format) — inherited by every schema using that type | **`mongooseTypes/<Type>.js options.API`** | Encapsulation lives with the type itself; cero replicación entre modelos que usan el tipo |
| Endpoint shipped by a plugin (Currency, PDF, MCP) | FWPlugin `API` key | Same as APP/ but injected by plugin → REQUIRED skill `itdfw-fwplugin` |

**Litmus test for `options.API` vs `options.<VERB>`:**
- "User must have permission on the Model to use this" → `options.<VERB>`
- "User edits THEIR OWN data / unauthenticated form / per-doc capability check" → `options.API`

Canonical example of `options.API`: `AAA/myProfile` in `User.js` — every authenticated user edits their own profile without holding User-model permissions. `isAnonymous: "auth"` (any authenticated user passes).

## Level 1 — APP/ file (free endpoints)

Files in the `APP/` folder of the cascade (core `SITE/`, DEFAULT, site) export an object whose keys become endpoint names. **El filename del archivo se concatena como prefijo del path** (ver Overview).

```js
// APP/AAA.js — el filename "AAA" entra al path
const getRef = {
  POST: { async json(req, res) { /* ... */ } },
  defaultMethods: ["POST"],
  hidden: true,
  name: "Obtener Referencias"
};
export default { getRef, getIcon, getConfig, logout, setVersion, /* ... */ };
```

Resultado:
- `getRef` → `pool.API["AAA/getRef"]` → `POST /APP/AAA/getRef.json`
- `setVersion` → `pool.API["AAA/setVersion"]` → `GET /APP/AAA/setVersion.json`

Si el archivo fuera `APP/payment/webpay.js` con export `pay`, el path sería `/APP/payment/webpay/pay.<ext>`. El loader hace `path.join(name, funcName)` donde `name` es la ruta del archivo sin `.js`.

Loaded by `api.loadAPI([localAPI, defaultAPI, siteAPI])` cascade in `AAA.start()` (`AAA.js`, `const APIfolders`).

Use cases: cross-model RPC, dev tooling (`Slow`, `logLevel`), session lifecycle (`logout`), version negotiation (`setVersion`), anonymous lookups (`getSimpleName`, `getRef`, `getCSRF`).

## Level 2 — `schema.options.<VERB>` (Model-bound CRUD)

Verbs `GET|POST|PUT|DELETE` declared on the schema's options. AAA's `Schema.on("model")` binds every handler with `value.bind(Model)` so `this === Model` (`AAA.js`, `Schema.on("model")`). Permissions are gated by `Model.canSee(req)` via the AAA model route — same gate as the auto-CRUD.

Canonical example: the `FrontEnd` mongoose plugin registers all the model-aware endpoints (`tableForm`, `formFilter`, `tableData`, `formSpecs`, `formCreate`, `formUpdate`, etc.) via `schema.checkAndLoadEndpoint({GET:{...}, POST:{...}, ...})`. Helper `checkAndLoadEndpoint` only sets the extension if not already present — letting later plugins/schemas override.

URL: `/APP/AAA/<ModelName>.<ext>` (e.g. `/APP/AAA/User.json?type=update`).

## Level 3 — `schema.options.API` (Model-attached, own permissions)

Same `this === Model` binding (`AAA.js`, `Schema.on("model")`: `const localAPI = schema.get("API")`), but registered as **free endpoints** in `pool.API` under their own path key. Each endpoint declares its own `isAnonymous`, `auth`, `defaultMethods`. Path key is literal (e.g. `"AAA/myProfile"`, `"AAA/recovery"`).

```js
// User.js options.API
"AAA/myProfile": {
  PUT: { async json(req, res) { /* uses req.session.user, NOT User permissions */ } },
  isAnonymous: "auth",   // any authenticated user, regardless of User-model perms
  hidden: true,
  defaultMethods: ["PUT"]
}
```

When to choose this over an APP/ file: the logic is intrinsically about the Model (needs `this`, virtuals, statics, schema introspection) but the **caller is not gated by Model permissions**.

## Level 4 — `mongooseTypes/<Type>.js options.API` (Type-attached, inherited by all consumers)

Custom Mongoose types declared in the `mongooseTypes/` folder of the cascade can ship their own `options.API`. The endpoint is registered at type-load time and any schema using that type gets the API gratis — no need to redeclare in each model. This is the **lowest encapsulation level**: the API lives with the data definition itself.

Canonical example: `mongooseTypes/Password.js`:

```js
export default {
  Password: {
    cast(val) { /* ... */ },
    options: {
      component: "Password",
      keepOnEmpty: true,
      forceAttrs: ["minUpper", "minLower", "minNumber", "minSymbols", "minStrength"],
      API: {
        checkStrength: {
          validate: true,
          isAnonymous: true,
          hidden: true,
          defaultMethods: ["GET"],
          GET(req, res) {
            const {password} = req.query;
            const result = zxcvbn(password);
            res.json({score: result.score, feedback: result.feedback});
          }
        }
      }
    }
  }
};
```

URL: `/APP/checkStrength.json` (or whatever path key declared). Independent of any schema — the endpoint exists once for the type, accessible globally. Cualquier form que use type Password puede llamar `checkStrength` desde el front sin que el modelo padre lo redeclare.

Use cases:
- **Validation utilities** intrinsic to the type (Password strength, Email DNS check, URL reachability).
- **Decoding/encoding** services (cipher-decipher of refs, Base64 of File metadata).
- **Type-specific format helpers** (Currency conversion endpoint, Date parsing).

When to choose this over `options.API` of a model: the logic doesn't need a specific Model — it's about the TYPE itself. If 5 schemas use type Password, all 5 need the same `checkStrength` → declare once at type level.

## 🔴 Una RUTA no es una PUNTA: el fallback SPA y el warn "404" del log (gap #26 — 2026-09-17)

El back solo conoce dos cosas: las puntas `/APP/<func>.<ext>` y los archivos estáticos del `html/`. **Cualquier
otro path** (`/auth`, `/Members`, `/Places/123`) es una ruta del router del front: el último middleware de
`server.js` la sirve con **`index.html` y status 200**, y deja en el log un `Log.warn("404 <url> not found")`. Ese
warn es el fallback normal de una SPA, no un error: la decisión de si la página existe la toma el router del
front, ya en el browser (`ItdComponentNotFound` si no la tiene).

⟹ Pedir una ruta por curl, MCP o cliente headless devuelve el HTML del index, nunca JSON. Quien lo hace y lee el
warn del log concluye "el back tira 404 en /auth" — caso real 2026-09-17 (demo). Lo mismo con `AAA/getConfig` y
`AAA/checkLogin` llamados desde el MCP: son puntas de **bootstrap de la sesión del browser** (el front las pide al
cargar); desde un cliente que ya se autenticó por su propia vía no prueban nada.

| Path | Quién responde | Status |
|---|---|---|
| `/APP/AAA/checkLogin.json` | `execEndpoint` | lo que diga la punta |
| `/APP/noExiste.json` | `execEndpoint` | 404 `UNKNOWN FUNCTION` |
| `/auth`, `/Members` | fallback SPA → `index.html` | **200** + warn "404" en el log |

Litmus: *¿tiene `/APP/` y extensión?* No → es ruta, se prueba en el browser (Playwright), no por HTTP crudo.

## 🔴 Rutas del front se declaran en el BACK (gaps #13, #14, #15 — 2026-09-15)

**El `router.js` del site NO es el lugar para declarar una pantalla que va al menú.** El menú se arma desde el
back: `Profile.getFunctions` → `userData.functions[]`, y cada función trae la `route` que el back armó. El
`router.js` del site sirve **solo** para rutas que no deben salir en el menú (un detalle al que se llega desde
otra pantalla). Una pantalla puesta ahí funciona escribiendo la URL a mano y **nunca aparece en el menú** — caso
real: un site entero implementado así y reportado como defecto del FW.

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
(`/APP/AAA/User`), con `hidden`, `route.children[].meta.type` (View/Create/Update). Caso real: el ref-función
`User.intent` del plugin `typesafe` (gap #41, 2026-09-20).

**Lo que recibe el front al autenticarse** (`checkLogin` → `{user, userData, forceLink}`; verificado en vivo:
34 de 38 funciones con `route`, las 4 sin `route` no son pantallas). Cada función: `path`, `name`,
`defaultMethods`, `inNav`, `hidden` y su `route`. La de un modelo llega así:

```js
route: {component: "baseModel", props: {model: "PlanExercise"}, children: [
  {path: "",                  component: "View", meta: {method: "GET",  type: "View"}},
  {path: "Create/:mode?",     component: "Form", meta: {method: "POST", type: "Create"}},
  {path: "Update/:id/:mode?", component: "Form", meta: {method: "PUT",  type: "Update"}}
]}
```

## Executor: `execEndpoint`

`execEndpoint` (`AAA.js`). Cascade resolution by `func`, `method`, `ext`:

```
API[func] is function       → call it
API[func][method] is fn     → call it (e.g. ANY-style)
API[func][method][ext] fn   → call it (typical: .json, .csv, .pdf)
fallback chain              → API[func][method].any
                            → API[func].any
                            → API[func][method].UNKNOWN
                            → API[func].UNKNOWN
                            → 404 { err: "UNKNOWN FUNCTION" }  (estructural; era 500 hasta 2026-06-10)
```

Debug "UNKNOWN FUNCTION": missing extension handler — add `any` or the specific `ext` to the verb block.

## Flujo de errores — el gate es `HTTPError`

🔴 **El ÚNICO error aceptado en el flujo es `HTTPError`** (`new HTTPError(msg, status, extras)`, global de
`server.js`). Es el **gate de control**: viaja con su `status`, es flujo ESPERADO (404/401/403/400…).
Cualquier OTRO error es **UNCONTROLLED** — se coló sin controlar, problema más profundo a **subsanar**
(envolverlo en HTTPError en su origen).

**La firma, y tres cosas que no se adivinan** (gap #16):

```js
global.HTTPError = class HTTPError extends Error {
  constructor(message, status = 500, extras = {}) { super(message); this.status = status; Object.assign(this, extras); }
};
throw new HTTPError("sucursal no encontrada", 404, {placeId, code: "PLACE_NOT_FOUND"});
```

1. **Es GLOBAL** (`server.js`): no se importa. Buscarla para importarla es el primer tropiezo.
2. **Los `extras` viajan**: se asignan al error y salen en el JSON que recibe el front (`code`, ids, lo que sea).
3. **Se tira desde `pre("validate")` / `pre("save")` de un modelo y llega al cliente con su status y su texto.**
   Un rechazo de regla de negocio que "llega como 500" es un error pelado (`throw new Error`), no el FW
   traduciendo mal. Envoltura de errores ajenos: `if (err instanceof HTTPError) throw err; throw new
   HTTPError(err.message, err.status ?? 500);`.

**Quién emite y cómo:**

| Quién | Cómo emite | Por qué |
|---|---|---|
| **Punta** (handler) | `res.json(new HTTPError(...))` **o** `throw` | `execEndpoint` **awaitea** el handler dentro de un try/catch → atrapa el throw (sync o async). Convención: la punta emite (`res.json`); `throw` también es válido (execEndpoint lo atrapa). |
| **Helper de una punta** | `throw new HTTPError(...)` | corre DENTRO del handler → el throw sube al try/catch de `execEndpoint`. No necesita conocer `res`. |
| **Middleware transitivo** (ej. `auth`) | **`next(new HTTPError(...))`** | 🔴 NO pasa por `execEndpoint` — es middleware Express directo. En **Express 4 el `throw` de un middleware *async* NO lo captura Express** (→ `unhandledRejection` → el request **CUELGA**). La vía es `next(err)`. |

**Recorrido hasta el cliente (terminal ÚNICO, back ≥ 7.3.9):**
1. Punta tira/emite → `execEndpoint` catch hace `res.json(err)` **sin loguear** (o la punta llama `res.json(err)` directo).
2. `res.json` es **pipe**: si el arg es Error → **`next(err)`** (NO lo tira; lo reenvía). Si el arg es una
   **promesa que rechaza**, el `catch` del sender también hace `next(err)`; si los headers ya salieron (stream a
   medias) no hay a quién mandar JSON: `Log.error` + `res.end()`.
3. **Mid de 4-arg** (`server.js`) = terminal único (el mismo de `auth`): lee `err.status` (o lo deriva:
   ValidationError/CastError → 400, JWT → 401, CSRF → mensaje + `deleteAllCookies`, resto 500), borra el stack
   fuera de dev → responde el JSON tal cual, sin pasar por `res.json` (o lo emite por SSE si el request es SSE). Un
   `ValidationError` responde `{name, message, errors: {path: mensaje}}`: `message` son los mensajes de los campos,
   sin el resumen de mongoose ni el nombre del modelo (back ≥ 7.6.0). El resto, `SE(err)`.

**Logging — 4XX es respuesta, 5XX es error (jcmunoz 17-sep-2026):**

| Status | Qué es | Log |
|---|---|---|
| **4XX** | respuesta válida: el que llamó metió mal los dedos o no tiene permiso. Es flujo. | **ninguno** (ni silly) |
| **5XX** | error interno, algo se coló sin control | `Log.error("UNCONTROLLED", url, err)` **una vez**, en el terminal → correo al admin → subsanar |

Nadie más loguea errores: ni `execEndpoint` (hasta 7.3.8 duplicaba con "UNCONTROLLED ERROR"), ni el JWT (un 401
no es error del sistema). Ejecutor permanente: punta onDev `test/errorTerminal` (`?status=418|500`, `&viaJson=1`)
en `SITE/APP/test.js`. Detalle: la doc de arquitectura «error-terminal» (#193).

## Los 3 niveles de llamada de una punta — composición vs estructura

Las tres ramas de resolución del executor (arriba) NO son "granularidad creciente" — son una decisión de diseño sobre **DÓNDE vive la discriminación** del request. El dispatcher las resuelve igual; lo que cambia es quién decide qué corre.

| Nivel | Forma | Discriminación vive en | Eje HTTP |
|-------|-------|------------------------|----------|
| **1** | `API[func]` = función | **TU código** (factory interno) | recurso |
| **2** | `API[func][method]` = `GET(req,res)` | el **dispatcher FW** (por verbo) | recurso + método |
| **3** | `API[func][method][ext]` = `GET:{form,data}` | el **dispatcher FW** (verbo + ext) | recurso + método + representación/MIME |

**Niveles 2-3 = modo ESTRUCTURA.** La discriminación es **declarativa**: el FW resuelve por verbo/ext. Handlers fijos al boot, explícitos en la declaración. El dev afín a estructura prefiere esto: se ve qué puntas hay sin leer el cuerpo.

**Nivel 1 = modo COMPOSICIÓN.** La discriminación vive en **tu código**: `GET(req) → factory(req)` y el factory decide internamente (por ext, por QS, o **por info de la BD**). El dev afín a composition prefiere esto.

🔑 **El superpoder del nivel 1 que el 2-3 NO pueden: dinamismo.** Un factory que lee la BD define **funciones dinámicas en runtime** — endpoints cuyo comportamiento depende de datos. Con `GET:{funcA,funcB,funcC}` los handlers están hardcodeados en el objeto al boot; no puedes inventar `funcD` porque apareció un registro en Mongo. Con el factory, sí. Es **database-native llevado a la capa de routing** (coherente con schemas-como-datos del FW).

**Caso real**: el `json` con `switch(req.query.type)` de `FrontEnd.js` (form/specs/value por QS) ES composición pura. Funciona, pero ahí se eligió migrar a extensiones separadas (`tableForm`, `formSpecs`, `formCreate`… = estructura) porque salía más barato/legible. Prueba viva de que **ambos caminos son válidos** — es diseño, no jerarquía donde uno gana.

### 🔴🔒 El costo de seguridad del nivel 1: el AAA discrimina por VERBO

El AAA gatea permisos **por verbo** — `GET`/`POST`/`PUT`/`DELETE` son capacidades separadas en el profile. Esto cambia radicalmente entre niveles:

- **Niveles 2-3 (estructura) → AAA por verbo GRATIS y a prueba de balas.** El dispatcher resuelve `API[func][method]`: al handler `DELETE` SOLO se llega si pasaste el gate `DELETE`. El verbo del request ya fue validado contra el permiso de ESE verbo antes de tocar tu código. Imposible ejecutar lógica de mutación con permiso de solo-lectura.
- **Nivel 1 (composición) → el candado por verbo se ROMPE.** Hay un solo handler para todos los verbos → el AAA solo gatea a nivel `func`, no por método. Si tu profile da permiso `GET` y tu factory ejecuta lógica de mutación según body/QS **sin re-discriminar el verbo internamente**, un atacante con permiso `GET` dispara lógica `POST`/`PUT`/`DELETE` → **escalada de privilegio**. La discriminación de seguridad por verbo, que en estructura hace el FW, en composición **es responsabilidad del dev** — fallarla es un hoyo.

> **Regla**: si eliges nivel 1 (composición), tu factory DEBE re-discriminar el verbo (`req.method`/`req.requestedMethod`) antes de ejecutar cualquier lógica con efecto de mutación, replicando el gate que el FW te daría gratis en nivel 2-3. La cara B del dinamismo: ganas factory dinámico que lee BD, pero asumes el AAA por verbo a mano. Si la lógica del endpoint cruza verbos con efectos distintos, **prefiere nivel 2-3** y deja que el FW cuide el gate.

### 🔴 La extensión es SIEMPRE obligatoria en la llamada

Toda punta se llama **con extensión en la URL**, en los 3 niveles, sin excepción. Lo que varía es si el back la USA:
- **Nivel 3**: la ext **discrimina** el handler (`.form` ≠ `.data`) → tiene significado.
- **Nivel 1-2**: la ext es **decorativa/MIME** → cae al handler del verbo (o al factory) sin importar cuál pongas. "Coherencia de chiche", no funcional.

**Doble razón de la obligatoriedad**:
1. **Sintáctica**: la regex del router (`/APP/:func.:ext`) la exige. Es decisión de diseño (se podría relajar a ruta sin ext), pero no aporta.
2. **Semántica**: coherencia REST — todo request declara la representación que espera (es el `Accept`/content-type, pero en la URL). Aunque en nivel 1-2 no discrimine, **declara intención de formato** → el request tiene sentido completo por sí solo. Esa coherencia es la que habilita el nivel 3 sin casos especiales: la ext ya está siempre, solo cambia si el back la lee o la ignora.

> **🔴 Anti-patrón** (error real 2026-06-09): proponer una punta como `/APP/register/form` (path con slash, sin ext) o querer `skipCSRF` "porque es anónima". (a) La estructura correcta es `/APP/register.form` — `form` es el handler-ext (nivel 3) o `GET(req,res)` con ext decorativa (nivel 2). (b) CSRF aplica a TODO POST de browser, anónimo incluido (protege contra forgery cross-site; el front anónimo pide `getCSRF` y manda el token igual que `checkLogin`). `skipCSRF` es solo para machine-to-machine/webhooks que no pueden obtener token — nunca para un form de browser.

## Coherencia ESTRUCTURAL: declaración = existencia (2026-06-10)

Las operaciones CRUD que el modelo NIEGA (`noCreate`/`noUpdate`/`noCRUD`, o Upload sin `transform`)
**NO EXISTEN** a nivel HTTP — no son un 401/403 de permisos. 🔴 Pero OJO a qué capa lo produce (no
confundir presentación con definición):
- **`setRoute` = PRESENTACIÓN, no declaración.** No construye el child (Create/Update/Upload) → el router
  del front no lo tiene → si por bug se filtra el botón y lo pinchas, caes en un **404 del FRONT = un
  COMPONENTE 404**, NO un HTTP 404. Cero tráfico al back. **No razones el status HTTP desde acá.**
- **`checkAndLoadEndpoint` = DEFINICIÓN: es el que CAPEA las puntas.** noXXX → la punta de delivery
  (espejos GET formCreate/formUpdate/formData, POST formCreate/upload, exts funcionales) **no se registra**
  → headless → `execEndpoint` UNKNOWN FUNCTION → **HTTP 404 real**. Esta es la "coherencia de capado":
  el 404 lo da el EXECUTOR sobre una punta capada por capacidad, **nunca una punta viva diciendo "no existo"**.
- **Los CHECKERS viven SIEMPRE** (`checkCreate/checkUpdate/checkDelete/checkUpload`): son el aviso al
  front de qué parte del CRUD tiene el modelo.

**La tríada semántica de status (NO confundir los planos):**
| Status | Significa | Lo decide |
|---|---|---|
| **401** | la punta EXISTE pero no estás autenticado | AAA (hasAccess) |
| **403** | estás autenticado pero NO tienes permiso | AAA/perfiles |
| **404** | la punta no está registrada — capada por capacidad (noXXX en `checkAndLoadEndpoint`) o nunca declarada | el **EXECUTOR** (UNKNOWN FUNCTION) |

> 🔴 Una punta VIVA (que se ejecuta) **nunca** responde 404 sobre sí misma — sería incoherente. El 404 de
> "no existe la punta" lo da SIEMPRE el executor sobre algo no registrado. Caso aparte: una punta viva
> puede responder 404 de **RECURSO** (`documento por id no encontrado`) — eso SÍ es coherente (el recurso
> pedido no existe, no la punta).

`execEndpoint` responde **404** ante ext inexistente (UNKNOWN FUNCTION — era 500 hasta 2026-06-10).
Los statics internos (`FWcreate`/`FWupdate`/`FWdelete`) sobreviven siempre — los usan callers
internos (saveRefs).

> 🔴 Gotcha histórico (Hallazgo #71): los handlers de endpoint declarados en plugins NUNCA deben
> clausurar sobre `schema` — operar SIEMPRE vía `this` (el Model bindeado post-model). Durante años
> `checkAndLoadEndpoint` compartió UN set de handlers entre TODOS los schemas (objeto `verbs` a nivel
> de módulo, fixed 2026-06-10) y solo la disciplina del `this` mantuvo el FW correcto encima del bug.

## AAA: authentication & permissions

`hasAccess(req)` en `AAA.js`. Orden (el detalle real, paso a paso, está en la sección siguiente):

1. **`x-itd-access` header** — firma cifrada `${url};${method};${dateString}` (la emite `directRequest` en el server para llamadas worker→worker, god-access). `hasAccess` valida las **3 partes**: `url` == `req.fullURL`, `method` == `req.method`, y `dateString` < **5 s** (anti-replay). El token queda atado a punta+verbo+tiempo → robarlo no sirve para otra punta, otro verbo, ni pasada la ventana. Migración a JWT pendiente (TODO «directaccess-jwt»).
2. **`req.auth` (JWT)** — `req.db[auth.model].canSee(req)`.
3. **Session** (`req.session.auth`) — `req.db[session.model].canSee(req)`.
4. **Anonymous** — `Profile.canSee(req)` if Profile model exists; otherwise endpoint's `isAnonymous` (boolean | function | "auth").

`x-itd-access` existe para **repartir carga entre workers**: un worker le pasa a otro una petición ya autorizada y
esa vía **salta perfiles**. No es una vía de cliente ni sirve para preguntar permisos.

**`req.hasAccess(func, verb)`** (inyectado por `shareData`, como `changeMethod`): **pregunta** al AAA si el que llama
puede correr `func` (el path de `pool.API`, p.ej. `"AAA/Profile"`) con `verb`, **sin despachar nada**. Sale del mismo
gate que una petición real (perfil, `isAnonymous` true/"auth"/función) y **restaura el `req`** al volver: la punta en
curso conserva su `params.func`, `method` y `requestedMethod`. `func` es obligatorio (sin él lanza: la punta en curso
ya pasó su gate, preguntar por sí misma no significa nada); sin `verb` vale el de la petición.
Sirve desde cualquier código que tenga un `req` (punta, ref, hook con `setReq`): mostrar u ocultar una acción,
decidir qué ofrecer. Los comparadores de `Profile` leen `req.requestedFunc ?? req.params.func` y
`req.requestedMethod ?? req.method`. Ejecutor: la prueba de back `hasAccess` (punta onDev `test/hasAccess`).

`isAnonymous: "auth"`: cualquier usuario **autenticado** pasa sin asignación; un anónimo no (`Profile.getAnonymousFunctions` la cuenta solo si `req.isAuth`, y sin modelo `Profile` queda cerrada). Úsalo en puntas tipo `myProfile`; la punta puede además leer `req.session`/`req.auth`.

**Getters de identidad**: `req.isAuth` (cualquier vía; lo instala `User.installIdentity` dentro del middleware `auth`)
y los **consultores inmutables** de `server.js` (`req.setImmutableAttr`, al inicio de la cadena: un getter calcula al
leerse, no al definirse; asignarlos o redefinirlos lanza): **`req.sessAuth`** (boolean: autenticado por la cookie de
sesión, ni JWT ni anónimo) y `req.browserAuth` (abajo). Ojo: el autenticador de sesión corre primero y también llena `req.auth`, así que `req.auth` no
distingue la vía; para eso está `req.sessAuth`, no `req.session.auth` a mano. Para el origen de la petición:
`req.sameOrigin` (Referer/Origin contra `req.baseURL`, getters de URL en skill `itdfw-deploy-config`).
**`req.browserAuth`** = `sessAuth && sameOrigin`: sesión por cookie pedida desde una página de este mismo origen (el
front en un browser). 🔴 Un ref o punta que paga un servicio externo (IA, SMS, mapas) lee `req.browserAuth` y decide
su propio respaldo cuando es false (rechazar, cuota, cache): el FW no decide por él.
Ejecutor: la prueba de back `reqFlags`.

🔴 **El `Authorization` NO es siempre del FW** (2026-09-09): web-push firma `vapid t=…, k=…` (RFC 8292) y un
cliente OIDC o MCP manda su propio `Bearer`. `expressjwt` está montado global y con 3+ partes lanzaba 500
**ignorando `credentialsRequired: false`**, antes de llegar a la punta. Hoy `readFWToken(req)`, en
`AAA.js` y usado por el autenticador `FWJWT`, filtra por partes, esquema `Bearer` y **`model` en el payload** —esa
es la firma de que el token es nuestro, y el headless client lo manda siempre— y devuelve `undefined` para lo
ajeno, que sigue su camino. ⟹ una punta anónima **sí puede** recibir un webhook firmado de un tercero.
Detalle: la doc de arquitectura «jwt-gate».

### 🔴 El acceso paso a paso — quién decide de verdad (verificado contra el código, 2026-11-09)

El middleware `auth` (`AAA.js`, primero de la ruta `/APP/`) corre en este orden: **(1)** 404 si la punta no existe en
`pool.API`; **(2)** `runAuthenticators`: recorre `pool.authenticators` (primero la sesión, luego el JWT del FW, luego los
de los FWPlugins por su key `auth`; `pos` `"^"`/`"$"`/número los reordena, y un `"^"` de plugin queda **antes** de la
sesión). Cada uno decide con `claims(req)`, síncrono y barato; si reclama, `User.auth(req, authenticate)` resuelve al
usuario (por `_id` si es hex de 24, si no por `username`; un usuario `blocked` no resuelve) y **es el único que escribe
`req.auth`**: el primero que lo deja corta, uno que lanza corta la petición con su error, y si ninguno resuelve la
petición sigue como anónima; **(3)** `User.installIdentity` instala `req.isAuth`, `req.model`, `req.getUser()`
(memoizado por petición) y `req.actualUser` (sale de la sesión); **(4)** `hasAccess`: sin permiso responde **403 si
`req.isAuth` y 401 si no**.

`hasAccess` decide así: con `x-itd-access`, solo la firma (url + verbo + 5 s) y sin perfiles; si no, con `req.isAuth`, el
`canSee` del **modelo con que se autenticó el caller** (`req.model`, no el modelo destino de la punta) junta `profile` +
`profiles` del usuario y pregunta a `Profile.canSee`; si ninguno concede, **cae a las funciones anónimas**. Un anónimo
solo tiene estas. Un perfil concede una función cuando `path === <func>` **y** el verbo está en el `defaultMethods`
**guardado en el perfil** (una copia que se hizo al asignarla: si la punta cambia sus verbos después, el perfil no se
entera). Las anónimas se leen del `defaultMethods` de la punta: una punta anónima también tiene que declararlo.

**Level** (0 a 10000, menor = más poder, por omisión 10000): a un usuario o perfil de level igual o menor al tuyo no lo
editas ni lo borras; el 0 edita a todos; nadie se borra a sí mismo, y solo el 0 se edita a sí mismo. Un level solo se
asigna estrictamente mayor al propio (el 0 asigna cualquiera), y los perfiles que puedes repartir son los de level
estrictamente mayor al tuyo. Además, un usuario nunca guarda un perfil de level menor al suyo. En el arranque con
`firstTime` todo esto queda libre y los modelos `User` y `Profile` son anónimos.

**`getRef` y `getSimpleName`** (FWPlugin `names`) son `noProfile` y `hidden`, solo `GET`, con `isAnonymous: "auth"` en
producción (`true` únicamente en `onDev` o con `firstTime`): los recibe cualquier autenticado, de cualquier modelo
autenticable, sin asignación. Un modelo marcado `internal` (la opción vale `true` por omisión) responde 403 a un
autenticado que no sea `User`; `internal: false` lo abre (el plugin `restaurant` lo usa en lo que ve su dueño).

### 🔴 JWT es headless; el front espera SESIÓN (gap #17)

JWT es el camino **headless / MCP**: ya viene autenticado y no pasa por el flujo del navegador. **El front espera
sesión**: un 401 **corta, encola las peticiones pendientes y pide identificarse**; al volver la sesión, se reanudan.
Eso solo existe en el navegador. ⟹ Un arnés de pruebas que habla por JWT **no reproduce el flujo del front** y
produce falsos defectos: "lecturas que responden 200 o 401 al azar", "`getConfig` responde 401". Caso real
2026-09-15: dos defectos reportados contra el FW que eran el arnés. Para probar lo que ve el usuario, se prueba con
sesión (Playwright con login), no con el headless client.

### 🔴 401 y 403 son FLUJO, no fallas que se muestran (gap #18)

El sistema pregunta "¿puedo?" y la respuesta "no" es un **403**: queda en consola y **no se le muestra a la
persona**. El **401** dispara el login, no un mensaje de error. Diseñar la pantalla para mostrar todo error que
vuelva termina exhibiendo operación interna.

### 🔴🔒 Los 3 estados de acceso — el descenso se JUSTIFICA, el default no

La seguridad del FW no duele porque la provee el framework: **una punta nace perfilada** y sin asignación en
el perfil no pasa nadie. Poner `isAnonymous` es un acto DELIBERADO — no hay forma de abrir una punta por
descuido. ⟹ lo que hay que justificar no es por qué una punta es segura, sino **por qué alguna deja de serlo**.

| Estado | `isAnonymous` | Qué significa | Cuándo |
|---|---|---|---|
| **Perfilada** | falsy (default) | la punta está asignada en el perfil del que llama | siempre, salvo demostración en contra |
| **Anónima autenticada** | `"auth"` | no exige asignación, **pero sí un usuario autenticado detrás** | la regla general de todo lo que se abre |
| **Anónima sin autenticar** | `true` / `fn` | abierta a internet | solo si el ORIGEN no puede tener usuario todavía |

🔴 **La zona gris está entre las dos últimas, y la tendencia natural es irse a la de abajo** (funciona igual y
no hay que pensar). La norma es la inversa: **todo lo anónimo es anónimo AUTENTICADO**, salvo que se demuestre
que el origen no espera un usuario autenticado — pantalla de login, registro público, un webhook de un tercero,
un `.well-known`. "Es más cómodo" o "así funciona igual" no es demostración.

**El caso canónico (jcmunoz 2026-09-10, HECHO 22-sep):** `getFile` es anónimo **autenticado** (`"auth"`): un
archivo por id es un recurso de alguien. El único origen que necesita un archivo antes del login es el **logo del
nav**, y tiene su propia punta **`File/getLogo?_id=`**: anónima, **con clausura**: recibe el id (así la URL sigue
siendo cacheable un año, `public`; cambiar el logo cambia el id y la URL) pero solo sirve si ese id ES el
`Home.homeLogo` de la Config; cualquier otro id, 404. Un anónimo alcanza exactamente un archivo. Sin id en la URL
se perdía el cache (una URL fija no se puede invalidar), y con `getFile` abierto se abría el recurso completo para
una capacidad de una línea — lo que prohíbe la rule `access-vs-capability`. Ejecutor: la prueba de back `getLogo`.

🔴 **Por qué este error no se nota NUNCA:** `getFile` cachea un año cuando le pasan id. El usuario anónimo pide
el logo, falla, se autentica, lo pide de nuevo, funciona — y queda cacheado. El error existe durante cinco
minutos de la vida de cada usuario y nadie lo ve jamás. Un bug invisible sigue siendo un bug.

**El test que se deriva solo**: una punta anónima-sin-autenticar prueba que **no acepta un identificador
arbitrario**. Si lo acepta, es `getFile` con otro nombre.

⚠️ Y cruzar SIEMPRE permiso × verbos: `isAnonymous: true` + `defaultMethods: [GET, POST, PUT, DELETE]` es CRUD
abierto a internet. Si algo es anónimo, sus verbos se justifican uno por uno.

#### 🔴🔴 Lo que "anónima" significa DE VERDAD — dos cosas que no son obvias (medido 2026-09-10, hallazgo #189)

**1. Una punta anónima NO se puede gobernar por perfil.** El anónimo no consulta perfiles de la BD: usa un
**perfil por defecto** que `Profile.canSee` arma con la API ENTERA filtrada por la declaración
(`getDefaultProfile` + `sift`). ⟹ declarar `isAnonymous: true` **es** la autorización; no hay asignación que
la limite, ni asignación que haga falta. Verificado: una punta anónima asignable, sin estar en ningún perfil,
responde 200 a un anónimo puro.

**2. 🔴 `anonymousStates = [true, "auth"]`, y para un AUTENTICADO el filtro acepta los dos** ⟹ **cualquier
usuario autenticado entra a cualquier punta `isAnonymous: true`**, tenga o no la función en su perfil. Una
punta anónima no se puede restringir a un subconjunto de autenticados: **si es anónima, es de todos.** En un
sitio con usuarios externos (socios, clientes) eso es literalmente cualquiera con cuenta.

⟹ Si una operación necesita ser abierta EN ALGÚN escenario y perfilada en el resto, **son dos puntas**: una
perfilada (permanente) y otra anónima acotada a ese escenario, que se niega sola cuando el escenario no
aplica. No una anónima con el chequeo adentro: ahí el candado es una línea de código que nadie vuelve a
mirar.

✅ La forma **función** (`(req)=>bool`) OPERA (back ≥ 7.3.8, `Profile.getAnonymousFunctions`, #189 resuelto):
la lista de funciones con `isAnonymous` `true`/`"auth"`/función se arma desde `req.API` en **cada llamada**, sin
memo (cuesta menos de 1 ms; el memo dejaba fuera las puntas registradas después, #235), y la función se **evalúa por
request** (`await isAnonymous(req)`); si el handler revienta, cierra SOLO su punta y el resto sigue. La rama
`typeof isAnonymous === "function"` de `hasAccess` es código muerto (solo corre sin modelo `Profile`): no la
leas como "la vía". 🔴 Una ESCRITURA no se abre así aunque se pueda: `Translation/redefine` fue anónima por una llave
de la Config hasta el 20-oct-2026 y se cerró, porque un `t-href` redefinido mandaba a todos los visitantes a otro
sitio y sobrevivía a cerrar la llave. La forma función es para capacidades sin efecto persistente o acotado (catalogar).

## Autenticación de un modelo nuevo (autenticable = clon de User)

**🔴 Premisa: NO se implementa NADA de auth para un modelo nuevo.** Si un modelo es **autenticable**
(sus instancias se loguean) se declara como **clon de User** (`User.safeClone(...)`). Con eso hereda
TODO el aparato de auth del back, gratis y sin una línea nueva:
- `authForm.json` — genera el form de login según `{model, option}`.
- `checkLogin.json` — valida credenciales, puebla sesión, devuelve `userData` + `link` (página del perfil).
- `recovery.json` — recuperación de contraseña.
- Los paths con `auth: "password"` (username/email/identidad) ya son las opciones de login.
- Perfil forzado (en `pre("validate")` el modelo asigna su perfil único — buscar por **`profileName`**
  camelCase, verificado vía MCP `modelFields Profile`, NUNCA copiar `profile_name` snake de un corpus viejo).

### La frontera back↔front (zona gris)
El **back provee el flujo completo**; el **front solo lo activa con valores de store** (módulo `auth`):

| Valor (store `auth`) | Qué hace | Cómo se setea |
|----------------------|----------|---------------|
| `modelAuth` | Modelo a autenticar (default `"User"`) | `commit("auth/setAuthMode", {modelAuth: "Member"})` |
| `modelOption` | Método de login fijo → salta el select de "forma de autenticar" | mismo `setAuthMode`, `{modelOption: "email"}` |

**La pega del front es trivial (~5 min) y opcional**: basta setear esos valores de store **en cualquier
parte** (el botón Auth del nav ya dispara el flujo — no es obligatorio crear una vista ni una ruta
dedicada). Si se quiere una ruta/portal propio (ej. `/Member`), la ruta lleva **`meta: {redirect: true}`**
→ tras autenticar, el FW manda al socio al `link` (página principal) de su perfil. Las rutas "puerta"
(login/register/recovery/home) llevan ese meta; es polimórfico (cada perfil define su `link`).

`forceLink` (state del store) es OTRO caso (DelegatedUser fuerza redirect al cambiar a modo delegado);
su branch en el store está comentado (deuda). Para login normal el mecanismo es `meta.redirect`.

> Detalle de cómo construir el MODELO autenticable (clon, perfil forzado, multitenant): ver
> Doc «principios-modelos» §1.

## Registro público de un modelo (registrable = clon de User + flag)

**🔴 Premisa hermana de la anterior: NO se implementan puntas de registro para un modelo nuevo.** Las
puntas globales YA existen (`User.options.API` key `register`, anónimas, nivel 2):
- `GET /APP/register.json?model=X` → `{form, specs}` (form filtrado por contexto register).
- `POST /APP/register.json?model=X` → `FWregister` → `setData("register")` → `pickRegister` filtra el body.

Para hacer registrable un modelo (que DEBE ser clon de User):
1. **`registrable: true`** en sus schema options — gate ESTRUCTURAL de la punta (no AAA; el QS no puede
   volver registrable a un modelo que no lo es). User NO la lleva (internos, sin registro público).
2. Campos propios que el registrante no debe tocar → `hidden:["register"]` (los de User ya vienen
   blindados de la raíz).
3. Front: ruta `{path:"/Register", component:"Register", props:{authModel:"X"}}` — **SIN `meta.model`**
   (activaría el shell → pide help AAA-gated → 401 en anónimo → login indebido). La vista resuelve
   `props.authModel ?? store.auth.modelAuth` (frontoffice usa el store; landing pasa el prop). La vista
   `Register` (core/views) es sobrecargable por cascade; monta `ItdRegister` (core/components) que consume
   `getRegisterForm()`/`setRegister({data})` de BackEnd.js (model del closure, sin argumento).

**CSRF normal** (el front manda token como checkLogin) — `skipCSRF` NUNCA para forms de browser.
**Anti-vestigio**: register como CRUD del modelo (child Register en setRoute, espejos formRegister,
`case "register"`) fue eliminado 2026-06-09 — si aparece en un corpus viejo (código legacy), NO imitarlo.
Capas pendientes del flujo: verificación de correo (doble opt-in, patrón recovery) + captcha (Config).

> Enseñanza completa: doc «principios-modelos» §6. Ruta real: la bitácora del register (2026-06-09).

## URL → handler

**Regla del `<ext>`**: la extension en la URL es **literalmente el nombre de la función registrada** bajo el verbo. Si el handler se llama `tableFields(req,res)`, la URL es `.tableFields` (sin `.json`). Si el handler se llama `json(req,res)`, la URL es `.json`. **NO se concatenan**.

| URL | Resolution |
|-----|------------|
| `/APP/AAA/User.tableFields` | `API["AAA/User"].GET.tableFields` — handler nombrado `tableFields` |
| `/APP/AAA/User.formSpecs` | `API["AAA/User"].GET.formSpecs` — handler nombrado `formSpecs` |
| `/APP/AAA/User.json?type=update` | `API["AAA/User"].PUT.json` — handler nombrado `json` (legacy switch internal) |
| `/APP/AAA/getIcon.json` | `API["AAA/getIcon"].GET.json` — Level 1, handler nombrado `json` |
| `/APP/AAA/setVersion.json` | `API["AAA/setVersion"].GET.json` — Level 1, handler ext `json` declarado via `GET: {any: handler}` (cascade fallback) |
| `/APP/AAA/myProfile.json` | `API["AAA/myProfile"].PUT.json` — Level 3 |
| `/APP/AAA/recovery.json` | `API["AAA/recovery"].GET.json` — Level 3 anonymous |
| `/APP/checkStrength.json?password=X` | `API.checkStrength.GET.json` — Level 4 (sin prefijo de archivo) |

**Anti-patrón frecuente**: agregar `.json` a una ext que ya tiene nombre propio (ej: `User.tableFields.json` → 404). La función `tableFields` ya ES la ext, no se sufija.

## CSRF: cómo se salta y cuándo se justifica (`skipCSRF`)

`skipCSRF` NO es una option de la punta: es un **arreglo global de predicados** (`global.skipCSRF` en `server.js`,
`global.skipCSRF = []`). Antes del router, si `configGet("csrf")` está activo, el middleware corre
`skipCSRF.some(fn => fn(req))`: si alguno devuelve true la request pasa sin token; si no, `csrfProtection`.
Predicados de fábrica: `GET` que no sea `getCSRF` · request autenticada por **JWT** (`req.auth`) · rutas
conocidas (`getFile`, `getIcon`, `Pago.json`, status page).

Un plugin que expone una punta para un tercero que NO puede mandar el token (webhook) **empuja su
predicado**, lo más acotado posible — nunca por verbo ni por prefijo ancho:
```js
/*global skipCSRF*/
skipCSRF.push(req => !!req.headers["x-telegram-bot-api-secret-token"]);   // plugin telegram: por header propio
skipCSRF.push(req => req.path.includes("/MCP/"));                          // plugin mcp: por path, y va con JWT igual
```
El error CSRF en el log de un flujo normal **no es falla**: es el trapping de flujos de la replicación
(diseño). Solo se investiga si la punta es la que se está llamando a mano.

## 🔴 Si la punta ESCRIBE: `save()` o te haces cargo

Una punta que modifica datos con `updateOne`/`findOneAndUpdate`/`bulkWrite` **se salta todos los plugins
del FW** (bitácora, `__history`, `updateUser`, multitenant, cast de types, validación) y no avisa.
Saltárselo es legítimo cuando se necesita —el propio FW lo hace— pero entonces son tuyos los hooks que no
corrieron y la coordinación entre procesos.

⟹ Regla completa, con la medición y el caso donde saltárselo es obligatorio: **`itdfw-models` §4c**.

## Anti-patterns

| Anti-pattern | Fix |
|--------------|-----|
| Giant `switch (req.query.type)` inside `.json` (form/specs/value bundled per type) | Split into separate extensions (`tableForm`, `formSpecs`, `formCreate`) — see the `//FIX` markers in the `FrontEnd` plugin |
| Prefixing API key with `APP/` | Router already mounts `/APP/`. Use bare key: `getRef`, `AAA/myProfile` |
| Putting per-user logic in `options.<VERB>` and then bypassing perms inside | Wrong level — use `options.API` with own `isAnonymous` |
| Putting Model-introspecting logic in APP/ and importing the Model manually | Use `options.API` to get `this === Model` binding for free |
| Forgetting `defaultMethods` | Endpoint won't be assignable in profiles, plus method validation breaks |
| POST without CSRF skip when needed | `skipCSRF.push(req => req.path.includes("/rpc."))` (REQUIRED skill `itdfw-fwplugin`) |
| Mutating `pool.API` after `Schema.process()` | All registration must happen during `Schema.on("model")` or before |

## Quick endpoint shape

```js
{
  GET(req, res) {},                  // simple: any extension
  POST: {                             // by-extension
    json(req, res) {},
    upload(req, res) {},
    any(req, res) {}                  // fallback for missing ext
  },
  PUT: { UNKNOWN(req, res) {} },     // fallback when only some ext supported
  defaultMethods: ["GET", "POST"],   // declared verbs
  isAnonymous: false,                 // or true | "auth" | (req)=>bool
  hidden: true,                       // hide from profile UI
  noProfile: true,                    // not assignable in profiles
  name: "...", description: "...",    // UI metadata
  aiDescription: "...",               // 🔴 required: what it does and when to use it, for an LLM (MCP, palette); English
  hasFiles: ["fieldName"],            // multer fileFilter gate
  cache: {maxAge: 0, swr: 604800, public: true},  // cache policy → Cache-Control (see below; no Vary, ever)
  component: "MyComp", route: {...}, // optional front route
  init(db, Schema, key) {}           // once at load; key = its name in pool.API (see below)
}
```

**`init(db, Schema, key)`** corre una vez cuando la punta se registra, con la MISMA firma en los cinco caminos:
archivo `APP/`, key `API` de un FWPlugin, `options.API` de un schema (además con `this` = el Model), `options.API` de
un type, y `DBAPI` (en la BD: corre en cada compilación, y si tira, la compilación queda `FAILED` y la punta no se
publica). `key` es la clave con que quedó en `pool.API` (con el prefijo del archivo ya puesto): una fábrica de puntas
no necesita que le repitan su nombre. Puede ser `async`; un error se loguea y no detiene a las demás. Regresión:
la prueba de back `apiInitKey` (K1-K4; el del FWPlugin lo cubre el plugin `conversation`).

## 🔴 La política de cache se DECLARA en la punta: atributo `cache` (back ≥ 7.4.0, gap #40)

Nadie escribe `Cache-Control` a mano. El middleware `aaa.cache` (cadena `auth → cache → sse → multer →
execEndpoint`, `server.js`) lee el atributo `cache` **de la raíz del descriptor** (`API[func].cache`, al lado de
`isAnonymous`; 🔴 nunca bajo un verbo: ahí el ejecutor lo resolvería como una ext llamable, `/APP/func.cache`) y
pone los headers estándar **antes** de correr el handler; el handler puede pisarlos con `res.set` si sabe más.
Como `isAnonymous`, acepta **función `(req) => política`** para decidir por quién pide (anónimo vs
autenticado: `cache: req => req.isAuth ? {maxAge: 0, swr: 60} : {maxAge: 3600, public: true}`). Los nombres son
nuestros; el header es de la RFC 9111 / 5861. 🔴 **Un MODELO también lo declara, en sus schema options** (`cache:
{maxAge: 0, swr: 60}` junto a `defaultMethods`): `AAA.js` lo copia a `API["AAA/<Modelo>"]` como `isAnonymous`/`auth`
(back ≥ 7.4.1, gap #44). Sin eso `tableData`/`formUpdate` responden `no-store` y ninguna grilla ve el stale.

**Por ext, con la misma raíz (jcmunoz 20-sep-2026: "la estructura es fija, los datos son SWR").** La función recibe
`req` y `req.params.ext` es la punta concreta, así que UN `cache` en la raíz decide por punta; `undefined` cede al
**default del deploy**, que es un **mapa por ext** en la config (`cache: {tableFields: {maxAge: 60}, tableData:
{maxAge: 0, swr: 60}, "*": null}`: la estructura de todo modelo es fija, sus datos son SWR, sin que cada modelo lo
repita), y sin nada es `private, max-age=0`:

```js
// schema options de un modelo (o raíz de una punta libre con varias ext)
cache: req => ({tableData: {maxAge: 0, swr: 60}, tableFields: {maxAge: 300}})[req.params.ext]
```

Regla: *si quieres el default, devuelve `undefined`*. Solo GET/HEAD reciben el header; otros verbos lo ignoran, por
eso el mapa va por ext y no por verbo. Una punta libre que quiera su política ajustable sin código registra su
`setConfigDefinition` y la lee desde la Config dentro de esa función. Ejecutor: la prueba de back `cacheHeaders`
(`test/cacheByExt.{fields,data,count}`).

| `cache` | Header que sale |
|---|---|
| ausente (y sin default del deploy) | `Cache-Control: private, max-age=0` — **se guarda pero nunca se usa sin revalidar**: cada repetición es un 304 barato (back ≥ 7.4.1, 21-sep-2026; antes era `no-store`, que mataba la copia y con ella el `If-None-Match`) |
| `{noStore: true}` | `private, no-store` — opt-in para lo que no puede quedar en disco |
| `{maxAge: 0, swr: 604800, public: true}` | `public, max-age=0, stale-while-revalidate=604800` (catálogo de traducciones: el locale va en el QS) |
| `{maxAge: 0, swr: 60}` | `private, max-age=0, stale-while-revalidate=60` (`tableData`, `tableFields`: de sesión) |
| `{maxAge: 3600}` | `private, max-age=3600` (CF pura) |
| `vary: …` | **se ignora**: nunca sale `Vary` desde la política de cache (ver abajo) |

Reglas: **`private` es el default** (se parte de la restricción y se suelta con `public`). 🔴 **Sello (back ≥ 7.4.0):
una punta anónima legal (`isAnonymous: true`, o su función devuelve `true`) sale SIEMPRE `public`**, diga lo que
diga la política, pida quien pida: `private` es de sesión y un anónimo legal no es sesión de nadie (sin el sello, el
401 contractual de un visitante, p.ej. `Translation/redefine.check`, le borraba la copia vía `clearPrivate`). `"auth"`
y las perfiladas quedan como las declara el dev. Ejecutor: `cacheHeaders.test.js` (`test/cacheSealed*`). `private`/`public` no le
dicen nada al browser (RFC 9111: son para intermediarios); son la marca de sesión del SW de smart-fetch: **al
logout, y ante un 401 en cualquier revalidación (sesión caída por timeout), borra todo lo `private`** (SWR o CF, da
igual) y lo `public` sobrevive; **nada se borra por TTL**, una copia
vencida se revalida (304) · 🔴 **`Vary` NO EXISTE en el FW** (jcmunoz 22-sep-2026): la Cache API de todo browser
(spec WHATWG, medido en Chrome 153) indexa por URL y nunca guarda dos variantes de una URL: `Vary` ahí solo valida
el `match` y el `put` pisa. Un cache que respeta `Vary` a veces es peor que uno que nunca lo mira, así que `aaa.cache`
no lo manda nunca y el SW de smart-fetch indexa **por URL, estricto, siempre**. **Lo que cambia el contenido va en
la URL** (translate: `?locale=`); `X-Locale` sigue viajando solo para `req.locale` y lo que se genera en el back. Se
revisa el día que WHATWG e IETF se pongan de acuerdo · valores en segundos.
**`req.locale`** (getter en `server.js`): `headers["x-locale"] ?? configGet("Locale") ?? "es-CL"`: el header manda
(el front ya manda el forzado cuando hay `forceLocale`), la config del site es el fallback. Un cliente sin header (el
MCP, un curl) cae al `Locale` del site: si quiere otro idioma, manda `x-locale`. Antes del 22-sep-2026 el getter
prefería la config y anulaba el header en todo deploy con `Locale` (gap #56).
Ejecutor permanente: la prueba de back `cacheHeaders` sobre las puntas `test/cache*` de `SITE/APP/test.js`.

## 🔴 Archivos: la punta DEBE declarar `hasFiles` (capa de seguridad)

`AAA.js` → `multer.fileFilter`: si `req.API[func].hasFiles` es falsy, **cualquier archivo en el multipart se rechaza
con 403** `not allowed to upload file to <url>`. No hay subida "por defecto".

| Punta | `hasFiles` |
|---|---|
| `AAA/<Modelo>` (CRUD del modelo) | **derivado** por `mongoosePlugins/02hasFiles.js`: la lista de paths `File` del schema (+ virtuals `File` con setter, + nested). Un modelo con campos `File` no declara nada |
| `schema.options.API` / `APP/` (punta custom) | **hay que declararlo** (`hasFiles: true` o la lista de paths). Nadie lo deriva por ti — aunque la punta escriba en un modelo que sí tiene `File` |

El front manda los archivos como **multipart** con el path del campo como `fieldname` + el JSON en el text field
`__data` (el form y el registro; ver la doc «multipart-flow»); `setData` los lee de `req.files`.
🔴 Si el front manda JSON con el `Blob` adentro, el archivo llega como OBJETO: `saveRefs` lo toma por "ref con payload",
llama `File.FWcreate` y revienta con `req.files undefined`. Caso real 2026-08-27: punta `myFolder` de un deploy.

## Deuda histórica: prefijo `AAA/` vestigial

⚠️ El prefijo `AAA/` que aparece en muchos paths actuales (`/APP/AAA/getIcon`, `/APP/AAA/setVersion`, `/APP/AAA/User.tableFields`) **NO es semánticamente significativo** — es deuda histórica:

1. El FW partió con un único controller llamado `AAA`.
2. Todo se acumuló bajo `AAA/` por inercia.
3. Cuando se agregaron otros modelos, se forzó la convención `AAA/<model>` para que el front siguiera funcionando.
4. Después se introdujo `route.meta.model` en el front → el `AAA/` quedó vestigial pero nadie limpió.

**Implicación para nuevos endpoints**: NO sigas la inercia. Cuando crees un nuevo endpoint nivel 1 (APP/), elige un filename que refleje SCOPE SEMÁNTICO real:
- ❌ `APP/AAA.js` con `getIcon` → path `/APP/AAA/getIcon`
- ✅ `APP/icons.js` con `getIcon` → path `/APP/icons/getIcon`
- ✅ `APP/utils/icons.js` con `getIcon` → path `/APP/utils/icons/getIcon`

Y para nivel 3 (`schema.options.API`), también vale revisar la convención: `"AAA/myProfile"` es vestigial, podría declararse simplemente `"myProfile"` (decisión de migración pendiente).

Migración completa documentada en el TODO «aaa-prefix-cleanup».

## Hallazgos (code review for jcmunoz)

- Plugin `FrontEnd` — `//FIX` markers acknowledge the `switch(type)` antipattern (combos `form+specs+value` in `?type=create|update|register|check`). Pending split into discrete extensions.
- `AAA` — commented block transferring `schema.statics` to `route.meta` (saved 57KB payload). Confirm definitive removal.
- `User` — `myProfile` exists in `options.API` while a duplicate (commented) lives in `APP/AAA`. Decide canonical home.
- `execEndpoint` swallows missing methods silently (no `case "undefined"` for the outer `typeof API[func][method]` switch) — `POST` to a `GET-only` endpoint hits no branch and returns nothing. Worth an explicit 405.

## References

- The core `AAA` — `start()`, `Schema.on("model")` binding, `execEndpoint`, `hasAccess`.
- The `FrontEnd` mongoose plugin — canonical Level 2 example.
- The `User` schema — canonical Level 3 (`options.API`) examples.
- The `Password` type — canonical Level 4 (type-attached `options.API` con `checkStrength`).
- The `AAA`, `WebPay` and `Log` files of `APP/` — Level 1 examples.
- The `mongooseDB` layer — `checkAndLoadEndpoint` helper.
- REQUIRED skill `itdfw-fwplugin` for plugin-injected endpoints (FWPlugin `API` key).
- Related: skill `itdfw-mongoose-types` for types referenced by endpoint payloads.

## Administración de Modelos → [`references/model-administration.md`](references/model-administration.md)

Contrato declarativo back↔front para administrar entidades: View (cerrado, 9 puntas), Form (abierto,
`{type, model, method}`), ItdRowDetail (2 puntas). Léelo cuando toques una de estas cosas:

| Necesitas… | Sección del reference |
|---|---|
| saber qué puntas pide cada componente (`tableFields`, `formFilter`, `tableData`, `form<Type>`, `formData`…) | §Las puntas del contrato |
| filtrar `tableData` (🔴 `filter[campo]=valor`; un `?campo=` pelado se ignora y responde TODO) | §Las puntas del contrato |
| entender por qué el Form manda POST o PUT, o de dónde sale el `id` | §setRoute |
| declarar espejos GET con `req.changeMethod` | §req.changeMethod |
| que un valor no viaje al front, o por qué "guardé y no pasó nada" | §Filtro de emisión (`send` vs `hidden`) |
| honrar el contrato sin Mongoose o sin modelo (DB externa, `myProfile`) | §3 modos · §Patrón model-virtual |
| extender View/Form, o devolver un ref desde un method | §Extender View y Form · §Patrón `toRef` |
| la lista de pasos para un modelo administrable nuevo | §Checklist |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
