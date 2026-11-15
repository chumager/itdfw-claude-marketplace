# Los dos ejes ortogonales: construir con `db.Schema` y el arreglo en el `type`

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y las mediciones.

## 3b. 🔴🔴 DOS ejes ORTOGONALES que se cruzan en el docArray (y por eso se confunden)

Casi todo el mundo los mezcla porque el caso donde más aparecen es el mismo. **Pero cada uno rompe por su
cuenta, con síntomas distintos**:

| Eje | La pregunta | ✅ | ❌ |
|---|---|---|---|
| **1. Cómo se CONSTRUYE el objeto** | ¿pasó por la fábrica del FW? | `new db.Schema({...})` | literal `{a: …, b: …}` |
| **2. Dónde va el ARREGLO** | ¿en el type o en el campo? | `{type: [X], ...options}` | `campo: [ … ]` |

**La prueba de que son independientes** (el caso que engaña): pones el arreglo donde corresponde… y
explota igual, porque el elemento sigue siendo literal.

```js
files: {type: [{a: String, b: String}], name: "Files"}   // ❌ eje 2 BIEN, eje 1 MAL → BOOM
```

---

### Eje 1 — TODO tipo objeto se construye con `db.Schema`. Sin excepción.

🔴 **Esto NO es cosa de docArrays**: aplica a **cualquier** campo de tipo objeto. Un **embedded simple**
declarado como literal cae exactamente igual — para el rastreador del FW, embedded y docArray son lo mismo:
una entrada en `childSchemas` con su `.schema`.

```js
const Line = new db.Schema({channel: {type: String}, externalId: {type: String}}, {_id: false});

// ✅
schema.add({detail: {type: Line, name: "Detail"}});          // embedded
schema.add({lines:  {type: [Line], name: "Lines"}});         // docArray

// ❌ REVIENTA EL BOOT — las dos, por la misma razón
schema.add({detail: {type: {a: String, b: String}, name: "Detail"}});
schema.add({lines:  {type: [{a: String, b: String}], name: "Lines"}});
```

**Mongoose acepta el literal sin chistar** —crea un schema implícito— y por eso el error aparece lejos y
tarde. Pero ese hijo **NO pasa por `db.Schema`**, así que nace **crudo**: sin las extensiones que el FW
instala en el prototipo (`eachVirtualPath`, entre otras). Cualquier plugin del framework que recorra
`childSchemas` se lo encuentra y explota.

🔴 **El costo real (caso 2026-08-14, media hora de caza a ciegas)**: un plugin declaró un docArray con
literal sobre `User`. Resultado:

- **Cayó el boot ENTERO** — no el plugin, no el modelo: el servicio.
- Se llevó puestos a **User, Member y DelegatedUser** (todo lo que clona User).
- El error —`currentSchema.eachVirtualPath is not a function` en `02hasFiles`— **no nombra ni el plugin,
  ni el modelo, ni el campo culpable**. Apunta a un archivo del core que no tiene nada que ver.
- Al caer `User`, cae la autenticación → **todas las puntas responden 500**, y el síntoma parece de red o
  de sesión, no de un schema.

⟹ Regla de lectura: **`eachVirtualPath is not a function` = alguien declaró un sub-schema con literal.**
Busca el docArray/embedded más reciente que se haya agregado (revisa los plugins primero: un
`schema.add` desde un plugin lo inyecta en modelos que ni sabes que lo tienen).

Corolario para plugins: si tu plugin agrega campos anidados **necesita `db`** para construirlos. Un plugin
declarado como objeto plano no lo tiene → decláralo como función (`db => ({name, plugin(schema){…}})`).

### Eje 2 — el ARREGLO va en el `type`, NUNCA en el campo

```js
// ✅ el arreglo es del TYPE — el campo sigue siendo un descriptor con sus options
files: {type: ["File"], name: "Files", cols: 3}
lines: {type: [Line], name: "Lines"}

// ❌ el arreglo es del CAMPO — mongoose lee el objeto como DEFINICIÓN DE SUB-SCHEMA
files: [{type: "File", name: "Files", cols: 3}]
```

**Dos daños distintos, según qué type lleve adentro:**

1. **Tus options se vuelven PATHS.** Mongoose entiende que el objeto describe **los campos del
   subdocumento**, así que `name`, `cols`, `filter`, `required`… dejan de ser options: terminas con un
   docArray cuyos elementos tienen un campo llamado `name` y otro llamado `cols`, y tu campo pierde label,
   filtro y ancho **en silencio**.
2. **Con un type CUSTOM, revienta el boot** (hallazgo #98, causa raíz verificada): mongoose resuelve el
   elemento por **dos fuentes de Types distintas** según la forma. `{type:[X]}` lee de
   `db.Schema.Types` —la copia de instancia donde el FW registra los custom— y funciona; `[{type:X}]` cae
   en `SchemaArray`, que lee del **módulo core estático**, donde los custom NO están →
   `Cannot set properties of undefined (setting '_arrayPath')`. Con types built-in (String/Number) las dos
   formas andan, y por eso el error solo aparece cuando alguien usa un type propio.

⟹ La forma canónica es **siempre** `{type: <lo que sea>, ...options}`. El arreglo es parte del TYPE.

Único caso donde el atajo `campo: [SubSchema]` es inocuo: cuando `SubSchema` **ya es un `db.Schema`** y el
campo **no lleva ninguna option**. Funciona, pero no lo uses como patrón — el día que alguien le agregue un
`name` se convierte en el caso malo sin que nada avise.
