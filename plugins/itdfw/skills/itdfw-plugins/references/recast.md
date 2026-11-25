# Re-cast de un path existente — los ejemplos completos

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

El ejemplo de `nationalId` → `Rut` (plugin tenant `NationalId`):

```js
// global: promueve el campo genérico `nationalId: String` al type local Rut, sin tocar el modelo.
export default function plugin() {
  return {
    plugin(schema) {
      schema.eachPath((path, schemaType) => {
        if (path === "nationalId") {
          schema.add({
            [path]: {
              ...schemaType.options,   // ⟸ conserva required/unique/immutable/filter/pos/...
              type: "Rut",             // ⟸ String → Rut (cast + validación + component locales)
              name: "RUT"
            }
          });
        }
      });
    }
  };
}
```

El re-cast masivo:

```js
plugin(schema) {
  const toPromote = [];
  schema.eachPath((path, st) => {
    if (path === "phone" && st.options?.type !== "Phone") toPromote.push([path, st.options]);
  });
  for (const [path, options] of toPromote) schema.add({[path]: {...options, type: "Phone"}});
}
```
