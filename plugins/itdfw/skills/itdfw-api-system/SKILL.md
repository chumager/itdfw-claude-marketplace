---
name: itdfw-api-system
description: Use when adding a backend endpoint to ITDFW, choosing between APP/, schema.options.<verb> and schema.options.API, debugging endpoint resolution (UNKNOWN FUNCTION, 404, 401/403), wiring permissions for a route, understanding `this === Model` binding inside schema endpoints, AAA authentication flow (x-itd-access, JWT, session, anonymous), or working with `pool.API`, execEndpoint and the URL pattern `/APP/<func>.<ext>`.
---

# ITDFW API System

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [aaa-access.md](references/aaa-access.md) | `hasAccess` paso a paso (`x-itd-access`, JWT, sesión, anónimo), contrato de `getRef`, 401/403 como flujo, los 3 estados de acceso, qué es "anónima" de verdad | Dudas de quién puede llamar una punta, level, `getRef`/`getFile`/`getLogo`, `isAnonymous`, o 401/403 inesperados |
| [cache-policy.md](references/cache-policy.md) | Atributo `cache` de la punta o del modelo (`maxAge`, `swr`, `public`, función por `req`), middleware `aaa.cache`, tabla y sello de anónimas | Declaras o depuras `Cache-Control` de una punta o modelo |
| [call-levels.md](references/call-levels.md) | Los 3 niveles de llamada (función, por verbo, por verbo+ext), costo de seguridad del nivel 1, extensión obligatoria, coherencia declaración=existencia | Eliges el nivel de una punta nueva o ves permisos que no discriminan por verbo |
| [error-flow.md](references/error-flow.md) | `HTTPError` como único error del flujo, firma y extras, recorrido hasta el cliente, tabla de quién emite, formato de `ValidationError` | Lanzas o interpretas errores de una punta (404/401/403/400, errores no controlados) |
| [front-routes.md](references/front-routes.md) | Diferencia ruta del front vs punta, fallback SPA con `index.html` 200 y warn "404", rutas del front declaradas en el back | Un curl/cliente headless recibe HTML en vez de JSON, o declaras rutas del front desde el back |
| [history-and-findings.md](references/history-and-findings.md) | Deuda del prefijo `AAA/` vestigial y hallazgos abiertos de code review | Nombras el filename de un endpoint nivel 1 nuevo o revisas deuda conocida |
| [levels-detail.md](references/levels-detail.md) | Nivel 4: `options.API` en `mongooseTypes/<Type>.js`, ejemplo canónico `Password.checkStrength` | Declaras una punta atada a un type (validar, decodificar, formatear) |
| [model-administration.md](references/model-administration.md) | Contrato back↔front de administración: View (`tableFields`, `formFilter`, `tableData`), Form `{type, model, method}`, `ItdRowDetail`, `setRoute`, `req.changeMethod`, filtro `send`/`hidden`, 3 modos, `myProfile`, `toRef`, checklist | Haces administrable un modelo: filtros `filter[campo]=valor`, POST vs PUT, "guardé y no pasó nada", espejos GET, modelo sin Mongoose, o el checklist de un modelo nuevo |
| [model-auth-register.md](references/model-auth-register.md) | Modelo autenticable y registrable como clon de User (`authForm`, `checkLogin`, `recovery`), sesión tras alta, frontera back↔front | Creas un modelo que se loguea o se registra públicamente |

🔴 **Quién puede usar qué lo decide el AAA**: funciones asignadas a perfiles; un modelo autenticable clonado de User
nace con su perfil base, que se llama como el modelo (`itdfw-models` → `references/authenticatable.md`); para
administrar usuarios, el level (solo a los de level más alto que el propio, `references/aaa-access.md`). Una punta
que decide en su código qué rol puede usarla es hallazgo. Filtrar lo que el que llama puede ver o mover (lo suyo) es
scope de negocio, y ese sí va en la punta.

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

Declarado en `mongooseTypes/<Type>.js` → `options.API` (ejemplo canónico: `Password.checkStrength`, `isAnonymous: true`, `defaultMethods: ["GET"]`). La punta se registra al cargar el type, existe **una vez** (`/APP/checkStrength.json`, sin prefijo de archivo) y todo schema que use el type la hereda gratis. Úsalo para lo intrínseco al TYPE (validar fuerza, decodificar, formatear): si 5 schemas usan el type, se declara una vez. Ejemplo completo y casos de uso: [references/levels-detail.md](references/levels-detail.md).


## 🔴 Una RUTA no es una PUNTA; las rutas del front se declaran en el BACK

- El back solo conoce las puntas `/APP/<func>.<ext>` y los estáticos de `html/`. **Cualquier otro path** es una ruta del router del front: se sirve `index.html` con **200** y un `Log.warn("404 …")` normal de SPA. Pedir una ruta por curl/MCP devuelve el HTML. Litmus: *¿tiene `/APP/` y extensión?* No → es ruta, se prueba en el browser (Playwright).
- El menú se arma desde el back (`Profile.getFunctions` → `userData.functions[]`, cada función trae su `route`). **El `router.js` del site NO es el lugar de una pantalla que va al menú**: sirve solo para rutas que no deben salir en él. Dos caminos: **`schema.options.route`** (la ruta es de un modelo: `setRoute` arma View/Create/Update/Upload y hace deep merge; los `children` se mergean por `path`) o la **`route` completa en la punta libre** (`APP/` u `options.API`).
- Flags: estar en el perfil ya la pone en el menú; `hidden: true` existe pero **no sale** en el menú; `inNav: true` agrega además un link directo en la barra superior; `noProfile: true` no es asignable a perfiles.

Ejemplos, lo que recibe el front al autenticarse y las funciones del que llama: [references/front-routes.md](references/front-routes.md).

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

🔴 **El único error aceptado en el flujo es `HTTPError`** (`new HTTPError(msg, status, extras)`): es **global** (no se importa), sus `extras` viajan al JSON del cliente, y se tira desde `pre("validate")`/`pre("save")` llegando con su status y texto. Un `throw new Error` pelado llega como **500** (no es el FW traduciendo mal). Cómo emitir: una **punta** hace `res.json(new HTTPError(...))` o `throw`; un **helper** hace `throw`; un **middleware transitivo** (como `auth`) hace `next(new HTTPError(...))` (en Express 4 el throw de un middleware async no se captura y el request cuelga). El terminal es único (el mid de 4 args de `server.js`). **4XX es respuesta: no se loguea. 5XX: `Log.error("UNCONTROLLED", url, err)` una vez, en el terminal.**

Recorrido hasta el cliente, la tabla de quién emite y el formato de `ValidationError`: [references/error-flow.md](references/error-flow.md).

## Niveles de llamada, verbo, extensión y status

- Los 3 niveles del executor: `API[func]` función = **composición** (la discriminación vive en TU código; permite dinamismo por BD); `API[func][method]` y `[method][ext]` = **estructura** (la discriminación es declarativa, la hace el FW).
- 🔴🔒 **El AAA gatea por verbo solo en estructura (niveles 2-3).** En el nivel 1 hay un solo handler: con permiso `GET`, un atacante dispara lógica de mutación → **escalada de privilegio**. Tu factory DEBE re-discriminar `req.method`/`req.requestedMethod` antes de cualquier mutación; si la lógica cruza verbos con efectos distintos, **prefiere nivel 2-3**.
- 🔴 **La extensión es SIEMPRE obligatoria** en la llamada (`/APP/<func>.<ext>`): en nivel 3 discrimina el handler; en 1-2 es decorativa. Anti-patrón: `/APP/register/form` (path con slash, sin ext) o querer `skipCSRF` "porque es anónima".
- **Coherencia estructural — declaración = existencia.** Lo que el modelo niega (`noCreate`/`noUpdate`/`noCRUD`, Upload sin `transform`) **no existe** a nivel HTTP: `checkAndLoadEndpoint` no registra la punta y el executor responde 404 UNKNOWN FUNCTION. `setRoute` es presentación (un 404 del FRONT, sin tráfico). Los checkers (`checkCreate`/`checkUpdate`/`checkDelete`/`checkUpload`) viven siempre.

| Status | Significa | Lo decide |
|---|---|---|
| **401** | la punta EXISTE pero no estás autenticado | AAA (hasAccess) |
| **403** | estás autenticado pero NO tienes permiso | AAA/perfiles |
| **404** | la punta no está registrada (capada por capacidad o nunca declarada) | el **EXECUTOR** (UNKNOWN FUNCTION) |

Una punta VIVA **nunca** responde 404 sobre sí misma; sí puede responder 404 de **RECURSO** (documento por id no encontrado). Los handlers declarados en plugins operan SIEMPRE vía `this`, nunca por clausura sobre `schema` (hallazgo #71).

Detalle, el costo de seguridad del nivel 1 y el caso de FrontEnd: [references/call-levels.md](references/call-levels.md).

## AAA: authentication & permissions

`hasAccess(req)` decide en este orden: (1) **`x-itd-access`** (firma cifrada `url;method;date`, valida las 3 partes, ventana de 5 s; reparte carga entre workers y **salta perfiles**: no es vía de cliente); (2) **`req.auth`** (JWT); (3) **sesión**; (4) **anónimo** (`Profile.canSee`; sin modelo `Profile`, el `isAnonymous` de la punta). El middleware `auth` corre antes: 404 si la punta no existe → `runAuthenticators` (sesión, JWT del FW, FWPlugins por su key `auth`) → `User.installIdentity` → `hasAccess`, que sin permiso responde **403 si `req.isAuth` y 401 si no**. Un perfil concede una función cuando `path === func` y el verbo está en el `defaultMethods` **guardado en el perfil** (copia al asignar); las anónimas leen el `defaultMethods` de la punta. **Level** 0–10000 (menor = más poder).

- **`req.hasAccess(func, verb)`**: **pregunta** al AAA si el que llama puede correr `func` con `verb`, **sin despachar nada**, y restaura el `req`. `func` es obligatorio; sin `verb` vale el de la petición. Sirve desde cualquier código con un `req`.
- Identidad: `req.isAuth`, `req.sessAuth` (cookie de sesión) y `req.browserAuth` (= `sessAuth && sameOrigin`; úsalo para decidir el respaldo de una punta que paga un servicio externo).
- 🔴 El `Authorization` no es siempre del FW: `readFWToken` filtra por partes, esquema `Bearer` y `model` en el payload; lo ajeno sigue su camino (una punta anónima **puede** recibir un webhook firmado de un tercero).
- 🔴 **JWT es headless; el front espera SESIÓN**: un 401 corta, encola y pide login, algo que solo existe en el navegador. Un arnés por JWT no reproduce el flujo del front y produce falsos defectos ("200 o 401 al azar", "`getConfig` da 401"): lo que ve el usuario se prueba con sesión (Playwright con login).
- 🔴 **401 y 403 son FLUJO**: el 403 queda en consola y no se le muestra a la persona; el 401 dispara el login.
- `isAnonymous: "auth"`: cualquier **autenticado** pasa sin asignación; un anónimo no.

### 🔴🔒 Los 3 estados de acceso — el descenso se JUSTIFICA, el default no

| Estado | `isAnonymous` | Qué significa | Cuándo |
|---|---|---|---|
| **Perfilada** | falsy (default) | la punta está asignada en el perfil del que llama | siempre, salvo demostración en contra |
| **Anónima autenticada** | `"auth"` | no exige asignación, **pero sí un usuario autenticado detrás** | la regla general de todo lo que se abre |
| **Anónima sin autenticar** | `true` / `fn` | abierta a internet | solo si el ORIGEN no puede tener usuario todavía |

La norma: **todo lo anónimo es anónimo AUTENTICADO**, salvo que el origen no espere un usuario (login, registro público, webhook de un tercero, `.well-known`). Una punta anónima-sin-autenticar **no acepta un identificador arbitrario** (si lo acepta, es `getFile` con otro nombre: el logo tiene su punta propia, con clausura). Cruzar siempre permiso × verbos: `isAnonymous: true` + todos los verbos es CRUD abierto a internet.

🔴🔴 **Lo que "anónima" significa DE VERDAD**: (1) **no se gobierna por perfil**: declarar `isAnonymous: true` **es** la autorización; (2) `anonymousStates = [true, "auth"]` y para un autenticado el filtro acepta los dos ⟹ **cualquier usuario autenticado entra a cualquier punta `isAnonymous: true`**: si es anónima, es de todos, y no se puede restringir a un subconjunto de autenticados. Si una operación debe ser abierta en un escenario y perfilada en el resto, son **dos puntas**. La forma **función** `(req)=>bool` opera (back ≥ 7.3.8, se evalúa por request) pero **no se abre una ESCRITURA así**.

🔴 **`getRef` está cerrado por construcción**: una referencia directa a un modelo exige su token de origen (403 sin él),
y el token solo lo entrega el form a quien tiene acceso al modelo dueño. Las custom (pool y `Model.x`) van libres y son
responsabilidad de quien las escribe. Solo es hallazgo una directa que responda sin token (`references/aaa-access.md`
§Contrato de `getRef`).

Paso a paso del acceso, level, `getRef`, el caso `getFile`/`getLogo` y la forma función: [references/aaa-access.md](references/aaa-access.md).

## Autenticación y registro de un modelo nuevo

🔴 **No se implementa NADA de auth para un modelo nuevo.** Un modelo **autenticable** se declara **clon de User** (`User.safeClone(...)`) y hereda `authForm.json`, `checkLogin.json` y `recovery.json`. El front solo activa el flujo con valores del store `auth` (`modelAuth`, `modelOption`); una ruta/portal propio lleva `meta: {redirect: true}`.

🔴 **Registro público**: las puntas globales YA existen (`register.json`, anónimas). Para hacer **registrable** un modelo (clon de User): (1) **`registrable: true`** en sus schema options (gate estructural); (2) campos propios que el registrante no debe tocar → `hidden:["register"]`; (3) front: ruta `{path:"/Register", component:"Register", props:{authModel:"X"}}` **SIN `meta.model`**. CSRF normal: `skipCSRF` nunca para forms de browser.

Detalle y la frontera back↔front: [references/model-auth-register.md](references/model-auth-register.md).

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

## 🔴 La política de cache se DECLARA en la punta: atributo `cache` (back ≥ 7.4.0)

Nadie escribe `Cache-Control` a mano. El atributo `cache` va en la **raíz del descriptor** (`API[func].cache`, al lado de `isAnonymous`; 🔴 **nunca bajo un verbo**) o en las schema options de un modelo; acepta una **función `(req) => política`** (`req.params.ext` decide por punta; `undefined` cede al default del deploy, un mapa por ext en la config). **Sin declarar nada sale `private, max-age=0`** (se guarda pero se revalida con 304). `{noStore: true}` → `private, no-store`; `{maxAge: 0, swr: N, public: true}` → `public, max-age=0, stale-while-revalidate=N`. 🔴 Una punta **anónima legal** (`isAnonymous: true`) sale SIEMPRE `public`. 🔴 **`Vary` NO EXISTE en el FW**: nunca sale, `vary:` se ignora, y lo que cambia el contenido va en la URL (`?locale=`). Solo GET/HEAD reciben el header. `req.locale` = `x-locale` ?? config `Locale` ?? `es-CL`.

Tabla completa, el sello de las anónimas y las razones: [references/cache-policy.md](references/cache-policy.md).

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

## Deuda histórica y hallazgos

El prefijo `AAA/` de muchos paths es **vestigial**: en un endpoint nuevo de nivel 1, elige un filename con SCOPE semántico real (`APP/icons.js`, no `APP/AAA.js`). La historia y los hallazgos abiertos: [references/history-and-findings.md](references/history-and-findings.md).

## References

- The core `AAA` — `start()`, `Schema.on("model")` binding, `execEndpoint`, `hasAccess`.
- The `FrontEnd` mongoose plugin — canonical Level 2 example.
- The `User` schema — canonical Level 3 (`options.API`) examples.
- The `Password` type — canonical Level 4 (type-attached `options.API` con `checkStrength`).
- The `AAA`, `WebPay` and `Log` files of `APP/` — Level 1 examples.
- The `mongooseDB` layer — `checkAndLoadEndpoint` helper.
- REQUIRED skill `itdfw-fwplugin` for plugin-injected endpoints (FWPlugin `API` key).
- Related: skill `itdfw-mongoose-types` for types referenced by endpoint payloads.

---

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

