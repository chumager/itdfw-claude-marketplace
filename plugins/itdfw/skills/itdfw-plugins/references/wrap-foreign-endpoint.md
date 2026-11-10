# Envolver la punta de un modelo ajeno con un plugin NAMED

## El problema que resuelve

Una pieza que no es tuya (el front NUI, otro plugin, el core) ya pide un dato por una punta fija, y en tu capa ese
dato tiene que salir distinto. Ejemplo: la app pide el tema del site a `/APP/theme.json`, pero en el site público de
los restoranes cada página tiene que pintarse con el tema de su local.

Sin esto, las salidas son malas: tocar el módulo ajeno, agregar un parámetro al front que lo llama, o montar un
segundo `n-config-provider` dentro de la vista (que no llega al shell, al nav ni a lo teletransportado).

## Cómo

La punta vive en las `options.API` del schema dueño. Un plugin NAMED sobre ese schema, puesto en la capa que lo
necesita (el site, un deploy, un plugin), toma el handler y lo envuelve:

```js
export default function restaurantTheme() {
  return {
    name: "restaurantTheme",
    schema: "ThemeNui",                                  // el schema dueño de la punta
    plugin(schema) {
      const GET = schema.get("API")?.theme?.GET;
      if (!GET?.json) throw new Error("restaurantTheme: ThemeNui has no theme.GET.json endpoint to wrap");
      const siteTheme = GET.json;                        // el original
      GET.json = async function (req, res) {
        const slug = new URL(req.get("referer") ?? "/", req.baseURL).pathname.split("/")[1];
        const restaurant = slug && (await req.db.Restaurant.findOne({slug}, "theme").lean());
        if (!restaurant?.theme) return siteTheme.call(this, req, res);   // lo que no es mío: el original
        res.json(await this.findById(restaurant.theme).select("name light dark").lean());
      };
    }
  };
}
```

## Por qué funciona y qué cuida

- **La llamada no cambia.** El front y el módulo dueño no se enteran; cambia solo la ejecución de la punta en esa capa.
- **El original se llama, no se copia** (regla de no romper la cadena). Si el dueño cambia su punta, el envoltorio la
  sigue usando.
- **El orden de carga no importa:** un NAMED se aplica cuando su schema se carga.
- **El `throw` en el arranque** es a propósito: si la punta deja de existir, el plugin avisa en vez de no hacer nada.
- **Caché:** si la respuesta varía según algo que no está en la URL (aquí, el referer), la punta tiene que quedar
  con el caché por defecto del FW (`max-age=0` + ETag, revalidación en cada pedido). Con SWR, el SW serviría lo de
  otro contexto.
- **El referer a través del SW:** el SW de smart-fetch copia el `referrer` de la página al pedido que arma. Antes del
  arreglo del 27-oct-2026 llegaba `/sw.js` en todo lo que el SW revalidaba.
- **Para activarlo en un navegador que ya tiene el SW:** un cambio en `sw.js` no toma efecto con una recarga; hay que
  activar el SW nuevo.

Caso: site público del plugin `restaurant` (27-oct-2026), `<documentRoot>/<site>/mongoosePlugins/restaurantTheme.js`.
