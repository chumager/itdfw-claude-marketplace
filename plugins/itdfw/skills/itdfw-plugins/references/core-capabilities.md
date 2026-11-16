# Capacidades del core que ya puedes usar — el texto original

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

Antes de escribir lógica, mira qué PROVEE ya el core: virtuals `_update`/`_delete`/`_selectable`/`docLink`,
`hidden` por contexto, `toInput`/`toFilter`/`toXLS`/`toPDF`, `getSchemaType`, `getLink`/`ITDName`,
`isRoot`/`isChild`, `lean`/`autopopulate`/`fetchAll`, auditoría (`__history`), soft-delete (`active`),
multitenant (`_zone`), `weakEntity`, `autoincrement`, `pos`… Estas capacidades son las que permiten moldear
sin sobre-ingeniería — ya están hechas. **Catálogo de USO** (quieres Z → opción exacta → ejemplo → quién la
provee, con citas archivo:línea): el catálogo de capacidades de plugins («plugin-capabilities-catalog»). 🌫️ La mayoría son del
**FW en general** (las consume también quien escribe un MODELO, ver `itdfw-models`), no solo de plugins.
