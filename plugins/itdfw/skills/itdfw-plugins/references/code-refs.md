# Referencias de código del motor de plugins

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

## Referencias de código

Motor: el de schemas del core — `#addPluginFromObject` (clasifica),
`setPlugin` + `#applyPlugin` (NAMED), `#filteredPlugins` + `#addSchemaFromObject` (FILTERED),
`#globalPlugins` + `db.plugin` (GLOBAL). Ejemplos: el mongoose plugin `Banco` (filtered),
el plugin `duration`, `requestVariant` (named), `NationalId.js` del sitio (global re-cast).
