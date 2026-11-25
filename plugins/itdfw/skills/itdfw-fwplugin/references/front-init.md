# Pisar en el front e `init.js` del plugin — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

🔴 **Pisar es SILENCIOSO y es la gracia, no el bug**: la cascada es *first-return* con la app en la punta
más alta, así que un plugin puede sobreescribir un componente del core solo por **nombrarlo igual**. Es la
misma libertad que los mongoose-plugins tienen en el back (§"pisar/inyectar"). El único aviso es en
rutas: si dos niveles declaran el mismo `name`, el loader emite un `console.warn`
(*"[Router] X ya existe, interceptado por …"*) — pero igual gana el último.

### 🔴 `init.js` — el plugin no solo APORTA: puede REESCRIBIR el arranque

El bootstrap descubre los `init.js` por la MISMA cascada (`customImportArray("init.js")`), así que el del
plugin corre como un nivel más. Y un init recibe el **pack** (Proxy de bloques), lo que le permite:

- **agregar** bloques: globals, mixins, componentes, plugins de Vue, métodos al prototype;
- **registrar loaders** con `addLoader("$opcion", fn, pos, hoist)` — que modifican componentes **durante
  el localImport, antes de que Vue los vea** (lo que un plugin de Vue no puede hacer);
- 🔴 **modificar lo que registraron OTROS**, por nombre: `pack.before/after("nombre", [items])` (un bloque nuevo
  antes o después del de ese nombre), `pack.replace("nombre", obj)` y `pack.delete("nombre")` (ese ítem, no el
  bloque). Un nombre se declara **una vez**: redeclararlo para pisarlo hace caer el arranque; se usa `replace`, o un
  bloque después que reescribe `this.nombre` (skill `itdfw-core-init`, `pack-proxy.md`).

⟹ Es la contraparte front de la "black magic" de los mongoose-plugins, y `delete` está ahí **porque hace
falta**: si un nivel de abajo registra algo que impone una restricción que no necesitas o que rompe tu
código, sacarlo es la única salida. No es una función "por completitud" — es la que evita que quedes
atrapado por lo que decidió otro. Se usa sabiendo lo que se hace.

⟹ **`loaders/` queda fuera de la cascada de carpetas a propósito**: se registran por función desde un
init, y así **nadie te los pisa** por el solo hecho de nombrar un archivo igual.

Detalle del pack, flags de registro y cómo escribir loaders → skill **`itdfw-core-init`**.

⟹ Un plugin puede traer **un vertical de front completo** (rutas + vistas + componentes + store + init)
sin que la app toque una línea, y sin declarar más que la carpeta.

*(Ejemplo: el plugin `openid` (su `vue/` con router y una vista): la ruta y la vista del plugin se renderizan sin tocar el site.)*
