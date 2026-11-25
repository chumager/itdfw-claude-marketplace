# `fastResponse` y los getters del `req` — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los ejemplos y el inventario.

## 5. `fastResponse` — la config que ES código

La prueba de que el `.itdfw.js` no es un yaml con otra sintaxis. `fastResponse` declara respuestas HTTP de
bajo nivel **sin rutas ni métodos**: se evalúa antes que la app, contra el `req` crudo.

### 🔴 Los dos problemas que resuelve (y que casi nadie ve venir)

**1. Open Graph en una SPA.** Al compartir un link, el crawler de WhatsApp/Facebook/X pide el HTML y lee
los `<meta property="og:…">`. Una SPA sirve **un solo `index.html`**, así que todos los links muestran la
misma preview — y templetear el index para arreglarlo es caro. Con `fastResponse` se inyectan los tags
correctos según la URL o el User-Agent del crawler, sin tocar el build. **Para eso existe `type: "tag"`.**

**2. Healthcheck de un balanceador (ALB/ELB).** El balanceador pega a `/` **sin cabecera `Host`**, y un FW
multi-site no tiene cómo saber qué servir → 404 → el target queda `unhealthy` aunque el servicio esté
perfecto. Un `fastResponse` le contesta 200 sin involucrar a la app:

```js
{
  name: "AWS ELB",
  cond: {"headers.user-agent": /^ELB-HealthChecker/},   // SOLO el UA: no ates la cond al path
  response: {type: "string", data: "Pong"}
}
```

🔴 **No agregues `path` a esa condición.** El balanceador se identifica por su User-Agent; amarrar el match
a un path lo rompe el día que alguien cambie el health check de ruta.

Otros usos del mismo mecanismo: `robots.txt`, `.well-known`, metas de verificación de dominio.

### 🔴 El `req` llega COMPLETO — incluido `req.db`

Es lo que convierte a `fastResponse` en algo más que respuestas estáticas: la respuesta puede **consultar
la base** y armarse con datos reales. Ejemplo, el Open Graph:

```js
{
  name: "facebook link",
  cond: {
    "headers.user-agent": /^facebookexternalhit/,
    url: /^\/APP\/Empresa\/Proyecto\//          // dos condiciones → sift las aplica en AND
  },
  async response(req) {
    const id = req.url.replace("/APP/Empresa/Proyecto/", "");
    const proyecto = await req.db.Project.findById(id);      // ← la BD, disponible acá
    const {background, impact, impact_value} = proyecto;
    // req.baseURL da protocolo://host respetando fakeHTTPS; la punta es del MODELO File
    const img = new URL(`/APP/File/getFile.json?xhr=true&_id=${background}`, req.baseURL).toString();
    return {
      type: "tag",
      data: [
        {tag: "meta", attributes: {property: "og:type", content: "article"}},
        {tag: "meta", attributes: {property: "og:title", content: "Doble Impacto"}},
        {tag: "meta", attributes: {property: "og:description", content: `${impact} - ${impact_value}`}},
        {tag: "meta", attributes: {property: "og:image", content: img}}
      ]
    };
  }
}
```

⟹ Cada link compartido muestra la preview **de su propio contenido**, con la imagen y los datos que salen
de la BD — en una SPA que sirve un único `index.html`.

### 🔴 Para armar URLs absolutas: los getters del `req`, nunca a mano

El `req` trae estos getters inyectados por el FW:

| Getter | Qué entrega |
|---|---|
| `req.baseURL` | `protocolo://host` — **respeta `fakeHTTPS`** |
| `req.fullURL` | la URL completa, con query |
| `req.pathURL` | la URL sin query |
| `req.sameOrigin` | boolean: el origen de `Referer` (si no viene, `Origin`) es el de `req.baseURL`; sin ninguno o mal formado, `false` |

⟹ Sobre `baseURL` se compone con `new URL(path, req.baseURL)`.

**Nunca `${req.protocol}://${req.get("Host")}`**: detrás de un proxy que termina el TLS, `req.protocol`
dice `http` y `baseURL` dice `https` — que es lo que ve el mundo. Con la versión a mano, una `og:image`
sale en `http` y el crawler la descarta.

(El helper `getFileURL` es del **front** (`ItdFile.jsx`) y no aplica acá; y la punta de descarga es del
modelo `File`, no de `AAA` — verifícala en vez de copiarla de un `.itdfw.js` viejo.)

```js
export default {
  fastResponse: [
    {
      name: "robots",
      cond: {path: "/robots.txt"},              // objeto → se filtra con sift (query estilo Mongo sobre el req)
      response: "User-agent: *\nDisallow: /\n"
    },
    {
      name: "verificacion",
      cond: async req => req.hostname.endsWith(".ejemplo.cl"),   // o una función async
      response: {
        headers: {"X-Custom": "1"},
        status: 200,
        type: "tag",                            // genera markup: <meta name="..." content="..." />
        data: [{tag: "meta", attributes: {name: "verify", content: "abc123"}}]
      }
    }
  ]
};
```

`cond`: objeto sift · función async · boolean. `response`: string · objeto `{headers, status, type, data}`
· función async. Los `type` posibles: `object` (mergea al JSON), `string` (concatena al texto), `tag`
(genera `<tag attr="val" />`).

🔴 **Dos comportamientos que no se adivinan:**

1. **ACUMULA, no corta en el primer match.** Recorre TODAS las entradas: los textos se concatenan y los
   JSON se mergean. Por eso se lee con `configArray` — las del site y las de la raíz **se suman**, y
   varias entradas pueden construir juntas una misma respuesta.
2. **Si nada matchea, hace `next()`** — la request sigue su curso normal. Solo intercepta cuando alguna
   condición dio verdadera.

(Mezclar texto y JSON en la misma respuesta emite un warning y los concatena: es un error de quien
configura, no un modo soportado.)

