# Refs especiales — cómo un field resuelve a "otra cosa"

Un field puede referenciar a otro modelo (Select con options dinámicas) o a una **fuente custom de
valores**. Cuatro formas, de la más simple a la más potente (la 4, un ref con nombre del pool, no cuelga de ningún modelo):

## 1. `ref` directo — referencia a un modelo

```js
owner: { type: "User", name: "Dueño" }   // type "User" ⟹ ref:"User" (el FW lo deriva del type)
// o explícito:
owner: { type: "ObjectId", ref: "User", name: "Dueño" }
```
El front rinde `ItdSelect` con options del modelo referenciado. El nombre del valor seleccionado se
resuelve por `getSimpleName` (`model="User"`, `id=<ObjectId>` → `findById` → `doc.name`).

## 2. `refPath` — el modelo del ref viene de OTRO campo (polimórfico)

```js
creationUser:      { type: "ObjectId", refPath: "creationUserModel" },
creationUserModel: { type: String, enum: ["User", "Member"] }
```
El modelo NO es fijo: lo dice el campo hermano (`creationUserModel`). Un `creationUser` puede apuntar
a `User` o a `Member` según el valor de `creationUserModel`. El front recibe la punta ya resuelta
(el `model` para `getSimpleName` lo arma con el valor del campo path).

## 3. `myRef` + `addGetRef` — ref por FUNCIÓN (fuente custom, no un modelo)

Cuando los valores NO vienen de una colección sino de una **función** (un catálogo calculado, claves
de configuración, una lista derivada). Son DOS piezas acopladas:

**(a) El field declara `myRef`** — el nombre del ref-función:
```js
name: { type: String, myRef: "configNames", name: "Nombre" }   // Config.js real
```

**(b) El modelo registra el getRef** con `addGetRef(fn, "nombre")`:
```js
Config.addGetRef(function configNames(req) {
  // req trae query (id, filter…). Devuelve un array (strings u {value,text}).
  if (req.query.id) return this.__definitions[req.query.id] ? [req.query.id] : [];
  return Object.keys(this.__definitions).sort();
}, "configNames");
```

🔴 **El 2º parámetro (el nombre) es OBLIGATORIO en el FW** — al ofuscar el código del FW, `fn.name`
se pierde (la función `configNames` se renombra a algo como `n`), así que NO se puede confiar en el
nombre de la función. El name explícito lo preserva. En **apps/sites NO se ofusca** (solo el FW) →
ahí el 2º param es opcional, pero **ponerlo igual es buena práctica** (consistencia + a prueba de
futura ofuscación). `addGetRef(fn, name)` registra en `schema.statics.getRef[name] = fn`.

### Cómo se descubre y se llama (el flujo del sistema)

1. El field con `myRef:"X"` viaja en `tableFields`/`form*` ya resuelto como **`ref:"<Model>.X"`**
   (ej. `ref:"Config.configNames"`) y `component:"ItdSelect"`. **Así el front DESCUBRE que el ref
   existe** — por el field, no por adivinar.
2. Para resolver el nombre de un valor, el front llama `getSimpleName` con `model="<Model>.X"`:
   `getSimpleName` hace `Model.getRef["X"].call(Model, req)` → el array → busca el `id` → su label.

⚠️ **Sin el field (a), el `getRef` (b) es HUÉRFANO**: funciona si alguien llama la punta a mano con
el nombre, pero NADIE lo descubre en el flujo real. Las dos piezas van juntas o no sirve.

### Errores del ref-función → 500 (no 400)

Si la función del getRef revienta internamente, es **error del FW** (no del consumer que pidió) →
`getSimpleName` lo deja propagar al trap global → **500**. Distinto de modelo/ref inexistente o id
basura (consumer → 400). Fixture de cobertura: `TestAnon.errorRef` (un `addGetRef` que `throw`,
declarado por el field `brokenRef` con `myRef:"errorRef"`).

## 4. Ref con NOMBRE del pool — la fuente no es de ningún modelo (back ≥ 7.4.x, 27-sep-2026)

Cuando las opciones no tienen nada que ver con un modelo (el buscador de funciones de la palette, un catálogo de un
plugin), colgarlas de un `addGetRef` de un modelo cualquiera es una incoherencia (`User.intent` no es de `User`).
Para eso existe **`pool.refs`**: un registro de funciones de opciones con nombre, que lee el mismo `getRef`.

**(a) Se registra** con la key `refs` de un FWPlugin (la vía normal):
```js
export default {
  refs: {
    "typesafe/intent"(req, query) { return [{value, text}, …]; }   // req.query.filter = lo que escribe la persona
  }
};
```
…o, raro pero válido, desde un schema: `this.pool.refs["x/y"] = fn` (un form a mano con una vista agregada).

**(b) El campo lo declara con `myRef`** y el nombre completo: `intent: {type: String, myRef: "typesafe/intent"}`.

| Regla | Por qué |
|---|---|
| el nombre lleva **`/`** (espacio de nombres del plugin, como sus puntas) | `toInput` antepone el modelo a todo `myRef` sin `.` ni `/`; con `/` lo deja tal cual y viaja `ref: "typesafe/intent"` |
| la función recibe `(req, query)` y **no tiene `this`** | no es de un modelo; si necesita uno, `req.db[modelo]` |
| devuelve lo mismo que un `addGetRef`: strings o `{value, text}` | `getSimpleName` busca el valor guardado en esa misma lista |
| el acceso es el de `getRef`/`getSimpleName` (`"auth"` en prod) | quien ve el form ve las opciones del campo |

Por dentro: `AAA/AAA.js` declara `pool.refs = {}` y lo comparte en `shareData` (`req.refs`); `#expandPlugins`
reparte la key `refs`; `getRef` y `getSimpleName` miran `req.refs[ref]` antes que el modelo. Ejecutor:
`tests/back/namedRef.test.js` sobre el FWPlugin onDev `TestRefs` y el campo `TestIcon.color`.

## Verificación vía MCP

`callEndpoint GET APP/AAA/<Model>.tableFields` → confirmá que el field aparece con su `ref:"<Model>.X"`
(prueba de que el ref se descubre). Luego `callEndpoint GET APP/AAA/getSimpleName.json?model=<Model>.X&id=<v>`
→ resuelve el nombre (o 400/500 según el caso).
