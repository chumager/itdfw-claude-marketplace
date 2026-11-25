# Flujo de errores — el gate es `HTTPError`

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle y los casos.

## Flujo de errores — el gate es `HTTPError`

🔴 **El ÚNICO error aceptado en el flujo es `HTTPError`** (`new HTTPError(msg, status, extras)`, global de
`server.js`). Es el **gate de control**: viaja con su `status`, es flujo ESPERADO (404/401/403/400…).
Cualquier OTRO error es **UNCONTROLLED** — se coló sin controlar, problema más profundo a **subsanar**
(envolverlo en HTTPError en su origen).

**La firma, y tres cosas que no se adivinan**:

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

**Logging — 4XX es respuesta, 5XX es error **

| Status | Qué es | Log |
|---|---|---|
| **4XX** | respuesta válida: el que llamó metió mal los dedos o no tiene permiso. Es flujo. | **ninguno** (ni silly) |
| **5XX** | error interno, algo se coló sin control | `Log.error("UNCONTROLLED", url, err)` **una vez**, en el terminal → correo al admin → subsanar |

Nadie más loguea errores: ni `execEndpoint` (hasta 7.3.8 duplicaba con "UNCONTROLLED ERROR"), ni el JWT (un 401
no es error del sistema). Ejecutor permanente: punta onDev `test/errorTerminal` (`?status=418|500`, `&viaJson=1`)
en `SITE/APP/test.js`. Detalle: la doc de arquitectura «error-terminal».
