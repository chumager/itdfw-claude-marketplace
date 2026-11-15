# AAA: autenticación y permisos — detalle completo

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

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
