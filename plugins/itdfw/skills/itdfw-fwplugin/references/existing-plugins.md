# FWPlugins existentes (referencia)

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

## Plugins existentes (referencia)

| File | Formato | Keys | Propósito |
|------|---------|------|-----------|
| Currency.js | objeto | types, plugins, vue2 | type Currency + `hasCurrency` + formato + front Vue2 |
| Config.js | función | db, plugins, schemas | modelo Config + getConfig + PubSub |
| PDF.js | objeto | types, db, plugins, schemas | `db.createPDF` + schema Font + plugin toPDF |
| Finance | función | libs, plugins | schemas de Fee (simple/dated/operational), IRR, gastos |
| MCP.js | objeto | API | endpoint protocolo MCP (dev-only) |
