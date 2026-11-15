# La política de cache: atributo `cache` — detalle y tabla

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

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
