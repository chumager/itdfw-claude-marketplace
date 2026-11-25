# Binding: el error típico y el resumen de los dos bindings

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

🔴 **Falla típica**: si se mueve `FWdelete` (usa `db.connection.transaction`) a `delete.js`, cuyo
factory tiene `(/*db*/)` comentado y SIN `const {db}=this`, da `db is not defined` en runtime. Fix: agregar
`const {db} = this`. (Asumir `db` global es el error — `db` viene de `this`/arg, no es global.)

- **Dos funciones, dos bindings (no confundir)** — ver "Binding & parámetros": la **factory** (`export
  default` función) se llama `.call(schemaInstance, db)` → `this` = instancia Schema del FW (db/pool/init/…);
  la **inner `plugin(schema, options)`** la llama Mongoose → recibe `(schema, options)` y **`this` NO está
  bindeado** (opera sobre `schema`, cierra sobre `db` del scope de la factory). En methods/virtuals/statics,
  `this` = doc/model en runtime.

Las filas originales de Common mistakes:

| Error | Fix |
|-------|-----|
| Usar `db` en la factory sin capturarlo (`db is not defined`) | `const {db} = this` (la factory está bindeada) o nombrar el param `function (db){}`. Ver "Binding & parámetros". |
| Asumir `this` = schema en la inner `plugin()` | La inner recibe `(schema, options)`, `this` NO bindeado. El `this`=Schema-instance es de la FACTORY. |
