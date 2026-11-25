# Convenciones finas de campos

## Idioma e identificadores
- TODO identificador en inglés camelCase — paths, modelos, **y los VALUES de los enums**
  (`["applicant","approved"]`, jamás `["postulante","en_revision"]`). snake_case prohibido.
- El `name`/label visible puede ser español: es presentación, el FW lo traduce.
- `required` con string = mensaje de error visible (también presentación).

## Campos multitenant (identificación nacional y similares)
- Path genérico FIJO (`nationalId`) + type base `String` en el modelo. NUNCA un type local
  (Rut/Cuit/DNI) declarado en el modelo: el **plugin del tenant** (en la carpeta del sitio) lo
  promueve a su type, label y validación local. La lógica de negocio cuelga del path — si el path
  cambiara por país, se rompe; manteniéndolo fijo el modelo es universal.
- Aplica a cualquier campo con variación por país/región: default String → el tenant promueve.

## Valores con formato local: canónico LIMPIO en BD
Para types cuyo valor tiene formato de presentación (rut con puntos/guión, teléfonos): en BD se
guarda LIMPIO/normalizado — el cast del type limpia. Razones: búsqueda parcial funciona, el índice
unique no acepta duplicados disfrazados de formato, una sola representación en el dominio. El
formato es SOLO display (lo pone el front). El término de búsqueda tampoco se formatea (no es un
valor del tipo).

## hidden / readonly / disabled — global vs contexto
- `hidden: true` (GLOBAL) oculta del ADMINISTRADOR del modelo — solo para paths forzados que ni el
  admin gestiona.
- `hidden: ["register","profile"]` (CONTEXTO) controla lo que el usuario ve de SÍ MISMO en cada
  flujo. Contextos: `view`, `create`, `update`, `register`, `profile`.
- Sin `hidden` a priori en campos nuevos: qué se ve en grilla/detalle es decisión del CLIENTE.
- `hidden` NO implica no-validación: un campo oculto igual valida — si no aplica a una forma,
  ajustar `validate: {required: false}` además de ocultarlo.

## 🔴 disabled / readonly son IMPERATIVOS DE DATO — no se guardan (setData los bota)

`disabled`/`readonly` en el schema NO son cosmética de UI: son un **contrato de asignación**. El
`setData` (pick de entrada default-deny) **excluye el campo del guardado** — pal back "nunca existió"
en el request. Es la guarda anti-inyección (nadie cuela un campo protegido por request headless);
`immutable` también termina acá (el picker lo convierte en disabled cuando el doc no es nuevo).

**El efecto en NESTED es DESIGUAL y es donde muerde** (setData recursivo):
- **embedded (single)**: el subdoc persistido se conserva y setData MERGEA lo autorizado → un campo
  disabled **conserva su valor de BD**. Sobrevive.
- **docArray**: las filas se **REEMPLAZAN** (el dato que llega es el SSoT — un array no se puede
  mergear por diseño) → un campo disabled se **PIERDE EN TODAS LAS FILAS** al guardar.

🔴 **Ejemplo real**: `Profile.functions.path` era `disabled: true`
de schema → un PUT del admin de perfiles guardó las 93 functions SIN path → perfil Admin muerto.
**Regla**: si el campo NO debe editarse en UI pero SÍ debe round-trippear (identidades dentro de
docArrays), el instrumento NO es `disabled` de schema — es el controller **`disableFields`**
(no-editable en UI, el valor viaja intacto; skill `itdfw-front-develop` → controllers.md).
`disabled` de schema queda para campos que el flujo REALMENTE no debe aceptar del request.

## Cambio de forma intra-documento (natural/jurídica y similares)
Cuando campos cambian según el valor de OTRO campo del mismo doc: `controller: "changeOptions"`
en el campo selector + objeto `changeOptions: {valorA: {campo: {hidden, label, validate...}}}`.
El back declara, el front ejecuta. Alternar estados REALES (un `hidden:false` en todos los casos
no aporta); si solo cambia el label, cambiar solo el label.

## Índices
- `filter: true` y `unique: true` en el field → el FW genera los índices solo (incluye doble
  índice multitenant y partialFilter de soft-delete). El estado natural del índice es AUTOMÁTICO.
- `schema.index()` manual SOLO para compuestos (varios campos) o `$text`.

## deleteMode y unique (acoplados)
`deleteMode` default `"soft"`: borrar = `active:false`, y el unique pasa a parcial (único SOLO
entre activos). Intencional: un borrado se reactiva o se crea otro con la misma identidad.

## 🔴 Nombres RESERVADOS — no usar como PATH de campo ni como schema option

El FW inyecta métodos en cada documento y cada Query (plugin `Locals.js`), y lee options de schema
(plugin `queryFilter.js`). **Declarar un campo con uno de estos nombres lo PISA** → el mecanismo
interno se rompe SILENCIOSAMENTE (el transform de `setLocal` llama `doc.setLocal(...)`; si `setLocal`
es tu campo string, `TypeError: is not a function` — o peor, un pisado sin error visible).

**Métodos de DOCUMENTO / Query — NUNCA como nombre de campo** (`Locals.js`):
`setLocal`, `setLocals`, `setLocalsFromObj`, `getLocal`, `getLocals`, `setReq`, `getReq`, `preQuery`,
`localData`, `firstSetLocal`, `$locals`.
(Además de los ya conocidos de mongoose: `save`, `remove`, `validate`, `populate`, `toJSON`,
`toObject`, `id`, `_id`, `schema`, `collection`, `db`, `errors`, `isNew`, `$locals`…)

**Options de SCHEMA reservadas** (el FW les da semántica — no reusar el nombre para otra cosa):
`query` (filtro automático, objeto fijo o función `(req)=>filtro`), `preQuery` (`false` = opt-out del
filtro dinámico a nivel modelo), `noGlobalPlugin`, `sort`, `postData`, `noPagination` — y las del
núcleo (`name`, `modelName`, `defaultMethods`, `deleteMode`, `noCreate`/`noUpdate`/`noCRUD`, `API`,
`route`, `caducate`, `zone`, `hasFiles`…).

🔴 **Guardas del FW que dependen de esto**: el transform de `setLocal` protege por-elemento
(`typeof doc.setLocal === "function"` antes de llamar — cubre lean/number/objetos planos), pero eso
blinda al MECANISMO, no al modelo que pisó el nombre. Si tu campo se llama `setReq`, no hay guarda que
te salve: elegiste el nombre de un método del FW. Verifica que ningún path colisione con la lista.

## 🔴 `query` — SCOPE automático por quién mira (filtro a nivel MODELO)

La option `query` del schema inyecta un filtro en **TODA consulta del modelo** — grillas, endpoints,
vistas y aggregates — vía el plugin `queryFilter.js` (engancha `pre(find/findOne/count/…)` con
`this.where(query)` y `$match` en aggregate). Objeto fijo, o **función `(req) => filtro`** (puede ser
`async`). Es la forma canónica de "cada uno ve lo suyo": va en la QUERY, no en la vista → nadie ve lo
ajeno ni pidiendo el `_id` directo.

```js
// options del schema — el socio ve SOLO sus documentos; el usuario interno ve todos
query: async req => {
  if (req?.model !== "Member") return {};   // no-socio (User) → sin filtro, ve todo
  const me = await req.getUser();            // getters canal-agnósticos del req (sesión o JWT)
  return {member: me?._id};                  // socio → scope a los suyos
}
```

- **Discriminar quién mira**: `req.model` (modelo del autenticado, sesión o JWT), `req.isAuth`,
  `req.getUser()` (doc del autenticado, **cacheado por req**), `req.actualUser` (ObjectId de sesión,
  con delegación). Ver server.js.
- **Hermano del `hidden` como función** (itdfw-mongoose-types → toinput-pipeline §2): `hidden` decide
  si el CAMPO se muestra/se puede guardar; `query` decide qué DOCUMENTOS existen para ese usuario.
  Juntos arman el scope completo (ej. CreditSimulation: el socio no elige socio Y solo ve las suyas).
- **Sin `req` warnea** ("the query ain't have req nor preQuery === false, correct before deploy") — la
  red que evita filtrar mal en silencio desde puntas internas.
- **Opt-out**: `preQuery: false` (option de schema) o `.preQuery(false)` en una query puntual — lo usa
  el propio FW para lecturas internas (ej. Accounting leyendo `__history`).

## Otros
- `required` directo, no `requiredForm` (eso es parche de migración para datos legacy).
- No duplicar el cast del type en pre-save (Email ya lowercasea, Rut ya limpia) — verificar el
  type vía MCP `listTypes` antes de escribir transformaciones.
- `userData` por uso real, no preventivo. Virtuals heredados: getter directo, sin removeVirtual.
- Decisiones del CLIENTE no se hornean como principios: columnas de grilla, username===email,
  obligatoriedades — preguntar.
