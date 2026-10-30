# HTTP error traps — el flujo de status del `$http`

El cliente `$http` (`@chumager/request`, bloque `$http` de `init.js` del core) se configura UNA vez
en bootstrap con un objeto `options`. Dentro vive `status: {...}`, un mapa **código HTTP → handler**.
Cada handler corre **en runtime, por cada request** que termine en ese código. `this` dentro del
handler = la función de reintento de axios (`this(config)` reintenta); para llegar a Vars se usa la
variable `vars` capturada por closure arriba del objeto.

## 🔴 Qué resuelve `$http` (core ≥ 7.1, smart-fetch 7): el CUERPO, no la respuesta

`$http.get/post/put/delete(...)` y `$http(config)` resuelven con **el cuerpo** (`dataOnly: true` por defecto).
El código viejo que hace `.then(r => r.data)` recibe `undefined` sin error, y el síntoma aparece lejos
("Cannot read properties of undefined (reading 'map')", la lista vacía).

| Necesito | Cómo |
|---|---|
| los datos | `const rows = await this.$http.get(url, {params})` |
| status o headers | `{dataOnly: false}` en esa llamada → la respuesta completa (`{data, status, headers}`) |
| el error | rechaza con la respuesta entera: `err.status`, `err.data` |

No se vuelve al comportamiento viejo con un interruptor global: el contrato es el cuerpo. Gap #69, cazado por la
sesión de coop2 en demo al subir al front 7.1.1 (27-sep-2026): tres pantallas del DEFAULT de demo lo usaban.

## La matriz de traps (estado actual)

| Código | Qué significa | Qué hace el trap | Opt-out |
|---|---|---|---|
| **401** | No autenticado | Abre el modal de auth (`auth/showAuth`), espera `auth:correct` y **reintenta** el request original. Idempotente entre requests paralelos. | `config.noAuth` |
| **400** | El consumer mandó input inválido | `Alert/error` con el mensaje parseado + `reject`. Por DEFAULT lo muestra (el front decide alert/modal). | **`config.noError`** |
| **403** | CSRF o no autorizado | Si es `EBADCSRFTOKEN` → pide token y reintenta. Si no → alerta "no autorizado". | `config.noAuth` |
| **423** | Machine lock | Alerta de bloqueo (con anti-spam: una sola vez). | — |
| **404** | No encontrado | `loading/notFound`. | — |
| **429** | Rate limited | Reintenta con backoff progresivo (`retry-after` × intento, hasta `maxRetries`). Agotado → warning. | — |
| **500** | Error interno del FW | Si `response.data.action` → ejecuta `window.actions[action]`; si no → `Alert/error`. `throw`. | — |
| `fallBack` | Error de red / timeout (sin respuesta HTTP) | Texto inglés hardcoded, o **override** del front/site (ver abajo). | — |

## El opt-out `noError` (patrón del 400)

`noError` se pasa en el **config del request**, no es global:

```js
$http.get(url, {noBlock: true, noError: true})
```

🔴 `noError` es config de los TRAPS del core, no de smart-fetch (2-oct-2026, 8b8cff5d): smart-fetch solo la
transporta. La respetan los traps de los 4xx de contenido (400, 404, 423, 429; 401/403 son de sesión y siguen su
camino): sin alerta, y la respuesta completa queda en el `error` de la Query (`result` en su default). Quien quiera
un texto ante el error lo pone mirando `error` (caso `simpleName`: "Value not found").

El trap 400 lee `config.noError`: si es truthy, **NO** dispara el `Alert/error` visual, pero
**igual** hace `Promise.reject(response)`. Así el caller conserva su propio `.catch` para manejar el
caso localmente. Caso canónico: `store/modules/SimpleName.js` — un 400 del `getSimpleName` es
ESPERADO ("valor no encontrado" no es un error a gritar en pantalla), así que el store pide `noError`
y su `.catch` pone el texto en la celda. El error sigue visible en la consola de red del browser
(eso es el debugger, no el FW).

> Semántica del nombre: el flag es **`noError`**, no `noAlert`, porque el front podría decidir
> mostrar el error de otra forma (modal, toast). `noError` = "no lo trates como error a notificar".
> Mismo molde que `noAuth` en el 403.

## 🪄 Por qué el body del 400 es un STRING (y no `{message, errors}`)

El resto del FW devuelve errores como **objeto** (`{message, errors, errmsg}` — formato Mongoose).
`getSimpleName` es la excepción: devuelve un **string plano** (contenido VISUAL, no se parsea — el
status ES la señal para el consumer automático). El parser `processErrors`→`findKey` recursa sobre
objetos buscando esas 3 keys; al recibir un string, `findKey` corta en la raíz
(`if (typeof obj === "string") return [obj]`). Como `processErrors` itera las 3 keys, el mismo
string llega triplicado a `res` → el `[...new Set(res)]` lo colapsa a uno. **Ese `Set` ya estaba**
desde antes: Mongoose manda el mismo mensaje repetido en varios atributos del error, y el `Set`
deduplica. El caso string se beneficia gratis de esa limpieza.

> Lección transversal (no solo HTTP): una función que **llama** a otra en otro scope necesita que la
> dependencia esté en un scope COMÚN. El handler 400 llamaba `processErrors` cuando estaba declarada
> dentro del scope del 500 → `undefined` en runtime. Se sube `processErrors` al scope de
> `async options()` para que TODOS los handlers la vean por closure.

## Override del front/site — lo que se puede hoy

El `fallBack` (error de red, sin HTTP) consulta `appComponent`:
- `appComponent.requestFallback(error)` — UI custom completa.
- `appComponent.requestFallbackText(error)` — solo el texto (i18n sin cambiar UI).

Es el único punto del pipeline hoy sobreescribible desde capas superiores. El resto de las options
(incluido el mapa `status`) se sella en bootstrap del core.
