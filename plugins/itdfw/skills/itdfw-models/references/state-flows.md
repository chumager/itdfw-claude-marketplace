# Flujos de estado de negocio — el estado NUNCA es un campo escribible

Cuando el modelo tiene un flujo (prospect→member, application→approved, solicitud→cursado):
el estado **se DERIVA, no se escribe**. Patrón: bitácora de HECHOS + transición en pre-validate.

## Por qué no un enum editable
Un `status` que el admin escribe a mano es **falsificable** (no exige evidencia) y pierde el "por
qué" (campos sueltos tipo reviewedBy/reviewedAt no son trail). Con estado derivado: infalsificable
por construcción (llegar al estado exige el rastro completo), atómico (bitácora embebida: evidencia
y transición commitean en el mismo save) y recomputable (el trail es la fuente de verdad).

## La bitácora (option del schema — el plugin del FW hace el resto)
```js
const Model = new db.Schema({...}, {
  // agrega el path `bitacora` (array de gestiones {date, description, closed, closeDate, file})
  Bitacora: {hasClosed: true, hasFile: true}
});
```
Opciones del plugin: `hasClosed` (cierre por gestión), `hasFile`/`fileArray` (respaldo documental),
`hasEvents` (sub-bitácora por gestión), `fields: {...}` (campos extra por gestión — acá van `stage`,
autoría `user`/`userModel`, lo que el flujo pida), `descriptionType`, `*Options`.

## El estado como proyección
```js
status: {
  type: String, name: "Status",
  enum: ["applicant", "approved"],        // inglés camelCase
  default: "applicant",
  hidden: ["register", "profile"]          // el usuario no se auto-asciende
}
// ...
Model.pre("validate", function () {
  if (this.status === "approved") return;  // estados finales MONOTÓNICOS (no retroceden solos)
  const entries = this.bitacora ?? [];
  if (entries.length && entries.every(e => e.closed)) this.status = "approved";
});
```

## Reglas del patrón
1. **Etapas pre-plantadas** (checklist): la bitácora nace con todas las gestiones del proceso como
   filas abiertas — la grilla ES el progress tracker y la transición se reduce a "todas cerradas".
2. **La DEFINICIÓN de etapas viene de la CONFIG por despliegue, NO hardcodeada** — pregunta
   obligada: ¿esto es del FW, del vertical o del CLIENTE? Procesos regulados (estatutos, normativa)
   son del cliente: el admin de cada despliegue define sus pasos, la siembra los lee de Config.
   **Cómo se lee**: `this.getConfig()` (síncrono) sirve directo en el `default()` del docArray —
   el flujo completo (definir/crear/leer/sembrar) en [config-driven.md](config-driven.md).
3. **Guardián diff-por-`_id`** en pre-validate: el PUT llega con el array completo (lo pisa), así
   que para control fino se trae el doc de la BD y se compara fila a fila por `_id` del subdoc —
   ahí se estampa autoría automática, se rechazan mutaciones ilegales (reabrir/editar cerradas,
   insertar/borrar/reordenar) y se evalúa la transición. NO confiar en el front.
4. **Cada requisito documental = SU fila con SU File** — nunca un zip/comprimido opaco; la revisión
   es fila a fila y la completitud se ve sola.
5. Hechos manuales (gestión del admin) y automáticos (un pago registrado por el sistema) entran
   por la MISMA puerta: la bitácora registra, la lógica interna decide.
