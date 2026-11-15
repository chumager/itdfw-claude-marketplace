# Custom Type Definition

## 🔴 `.set()` vs `options` — cuál usar (regla de decisión)

Todo (nativo o custom) es una **extensión de `SchemaType`**; `options` y `.set()` terminan en el mismo
`defaultOptions` del type. La puerta la decide **¿el type ya existe o lo estás creando?**:

| Situación | Puerta | Por qué |
|---|---|---|
| **CREAS un type nuevo** | `options: {...}` en su definición | conoces su existencia al crearlo → declaras sus defaults ahí |
| **Configuras/extiendes un type que YA existe** (nativo o custom ajeno) | `db.Schema.Types.X.set("opt", val)` | el type ya está cargado → lo modificas por fuera |

**El patrón clave — extender TODOS los types desde un `post`/`postLoad`**: un `postLoad` (o `types.post`
de un plugin) corre DESPUÉS de cargar los types y los recibe a todos → puede `type.set("toXXX", fn)`
sobre cada uno **sin problema, porque ya existen**. Así un plugin enchufa una capacidad transversal
(`toPDF`, `toFilter`, y un plugin EXTERNO de `.docx`/libreoffice que nadie conoce → `toDocx`) a todos
los types: los types base ni se enteran del plugin; es el plugin quien los extiende vía `set`.

```js
// postLoad de un plugin: itera TODOS los types ya cargados y les enchufa una capacidad
export function postLoad(db) {
  Object.values(db.Schema.Types).forEach(type =>
    type.set("toDocx", function (path) { return defaultDocx(this[path]); })  // default genérico
  );
}
// luego un type concreto puede sobreescribir SU toDocx con otro set (o en su options si se crea con él)
```

⟹ Regla para el esclavo: **type que ya existe → `set`** (típico: plugin que extiende por `post`);
**type que creas → `options`**. Nunca al revés (no puedes poner `options` sobre algo que no estás
creando, ni tiene sentido `set` por fuera sobre el type que recién defines — usa su `options`).

## File Structure

```js
// TypeName.js
export default {
  TypeName: {
    cast(v) {           // REQUIRED: Mongoose cast function
      if (!isValid(v)) throw new Error(`TypeName: ${v} invalid`);
      return transform(v);
    },
    options: {           // Default options for all paths of this type
      component: "ItdTypeName",
      forceAttrs: ["myAttr"],
      validate: { validator(v) { return true; }, message: "{VALUE} invalid" },
      toFilter(v) { return v; },
      toXLS(path) { return this[path]; },
      toPDF(path, style, value) { return {text: value, ...style}; },
      set(v) { return v; },
      get(v) { return v; }
    }
  }
};
```

## 🔴 Cast — firma, `this` y acceso a options

El cast de un SchemaType recibe **`cast(value, doc, init, prev, options)`** y **`this` = la instancia del
SchemaType**. 🔴 Declara SOLO los parámetros que uses: mongoose agrega args con el tiempo y el 5º
(`options`) es **API privada suya** (hoy `{_skipMarkModified}`, que usa al aplicar un `default`) — NO son
las options del campo, esas se leen de `this.options`. Verificado en el código de mongoose 9.9.2
(`lib/schemaType.js` de mongoose), no en la doc pública, que declara menos args de los que pasa. ⟹ la config del campo se lee de **`this.options`** (`this.options.measures`, `this.options.multiple`, etc.), NO de `this.schema.path(this.path).options` (frágil: `this.path` viene `undefined` durante `init`/hidratación → crash silencioso tipo `Cannot use 'in' operator … in undefined`).

- `value` = el valor a castear · `doc` = el documento · `init` = `true` si es hidratación desde BD.
- Patrón DDD (valor con lógica): cast THIN **genérico** que retorna la clase: `cast(...args){ const [v]=args; if(v instanceof RegExp) return v; if(!v) return null; if(v instanceof VO) return v; return new VO(v, this.options.measures, …); }`. **Declará `cast(...args)`** (forward nativo, inmune a versionado de mongoose), no posicional. El detalle completo del VO (parse, toBSON/toJSON, niveles, pub/sub, atomicidad) → [value-objects-ddd.md](value-objects-ddd.md).
- ⚠️ **RegExp en el cast — ZONA GRIS (no es un sinsentido)**: hoy ES necesario por coherencia del flujo de queries — `castForQuery` sin handler → `applySetters` → `cast`; un cast que no castea RegExp **revienta la query** (caso real `Rut`). No se pone dogmáticamente ni se saca hasta arreglar el flujo. 🛣️ **Roadmap**: la nueva implementación hará **overload de `castForQuery`** en los custom types (control total), o un `toFilter` que convierta los `conditionalHandlers` en cascada → ahí el filtro deja de pasar por `cast` y el `if (v instanceof RegExp)` se retira. Hasta entonces se queda, **documentado como deuda**, no como patrón.

🔴 **El wrapper que carga los types DEBE llamar el cast bindeado y con la firma completa**: `(types[type].cast).call(this, val, doc, init)`. Llamarlo unbound (`(types[type].cast)(val)`) mata el contexto para TODOS los casts custom (`this` undefined → sin `this.options`, sin `init`). Bug de base fixed 2026-06-26 (`mongooseSchema/index.js`); ver Hallazgo #95.

## 🔴 Las 3 formas de declarar el comportamiento del type (caster de `#loadTypesFromObject`)

El caster resuelve el cast del SchemaType **por precedencia** según qué declare el type — no escribas el
boilerplate del cast a mano, declará tu intención:

| Declarás | El caster hace | Cuándo |
|---|---|---|
| **`cast(...args)`** | usa tu función tal cual (`apply(this, args)`) | necesitás control total del casteo |
| **`class: VO`** | wrapper estándar: `RegExp→` passthrough, `null→null` (FCC), `instanceof→` idempotente, `new VO(...args)` | el valor es un **Value Object** → el boilerplate vive una vez en el caster (ver value-objects-ddd.md) |
| **`extends: "Base"`** | el SchemaType **hereda de `Schema.Types[Base]`** → reusás su cast/validación + pisás con `options` | tu type es una **especialización** de uno conocido (String/Number/…) |
| *(nada de lo anterior)* | `super.cast` | — |

🔴 **Por qué `extends` es oro** — reusás un type conocido en vez de reimplementar su cast. Caso real, **Email**:
```js
// ❌ ANTES: cast + set manuales reimplementan trim/lowercase de String (12 líneas)
Email: { cast(v){ return typeof v==="string" ? v.trim().toLowerCase() : v; }, set(v){ /* idem */ }, options:{…} }

// ✅ CON extends: String hace trim/lowercase nativo → el boilerplate desaparece
Email: {
  extends: "String",
  options: { lowercase: true, trim: true,   // ← lo hace String (mata cast + set)
             validate: { /* email-validator: lo propio de Email, String no lo da */ }, toFilter, … }
}
```
El `class` y el `extends` se declaran en el **root del type** (junto a `options`), NO dentro de `options`.

## z99base.js — Two Exports

**`export default` (db => {...})**: Configures built-in types + returns custom types
```js
export default db => {
  db.Schema.Types.String.set("trim", true);
  db.Schema.Types.Boolean.set("default", false);
  return { Email: {...}, Url: {...}, File: {...} };
};
```

**`export { postLoad }`**: Runs AFTER all types loaded, configures toInputBase on ALL types

## set() API — Common Keys

| Key | Purpose |
|-----|---------|
| `component` | Default front component |
| `filterComponent` | Component for filter mode |
| `forceAttrs` | Attributes forced to front |
| `set`/`get` | Mongoose setters/getters |
| `toFilter` | Transform for DB query |
| `toXLS`/`toPDF` | Export functions |
| `toInputBase` | Universal input config (postLoad) |
| `toInputNative` | Type-specific input config |
| `validate` | Mongoose validator |
| `default` | Default value |

## Validators on Types

```js
db.Schema.Types.Array.set("validate", {
  propsParameter: true,  // 2nd arg = {path, fullPath, value}
  validator(val, props) {
    const schemaType = this.schema?.path(props.path);
    if (schemaType?.options?.allowDuplication) return true;
    return new Set(val.map(v => typeof v === "object" ? JSON.stringify(v) : v)).size === val.length;
  },
  message: "{PATH} no permite valores duplicados: {VALUE}"
});
```

NOTE: `propsParameter` not fully documented by Mongoose. Verify contents.
