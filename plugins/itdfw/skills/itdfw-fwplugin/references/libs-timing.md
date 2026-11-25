# libs y orden de carga — el texto original

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

## libs — interconexión runtime

`libs: { helper, ...lib }` → el motor hace `Object.assign(pool.libs, value)`. Quedan disponibles vía
`pool.libs` para cualquier modelo/plugin del proceso. Es uno de los flujos de inyección al pool (el
detalle del pool + `shareData`→req vive en `itdfw-models` → `schema-engine.md`).

## Timing / orden de carga

`Schema.process()` → `#expandPlugins()` reparte las keys del FWPlugin a cada fase del motor: **db →
types → plugins → schemas** (cada una cascada FW→DEFAULT→App). `pool.API`/`pool.libs` se mergean sobre
la misma referencia. El detalle del motor (fases, espera por proxy, eventos, completitud) →
`itdfw-models` → `schema-engine.md`.
