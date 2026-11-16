# Plugin compuesto: la base que entra dos veces — tabla y medición

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

| Con dos hijos de la misma base, la base entra DOS veces | Qué pasa |
|---|---|
| back | **no deduplica**: todo lo que la base registra se registra dos veces, y lo que no tolera la repetición tumba el arranque |
| `setConfigDefinition(name, schema, level, canOverride)` | lanza `redefining X is not allowed` si la primera fue sin `canOverride` ⟹ **la base registra su Config con `canOverride: true`** |
| `libs`, `API`, un NAMED reaplicado | sobreviven la repetición |
| front | sí deduplica: la carpeta de framework de la base entra con el mismo nombre y una inyección suya se pinta una vez |

Y la base expone un **guard** (`enabled`, con un interruptor `enabled` en su Config; no `active`, que es nombre
reservado) para que un hijo apagado o sin configurar responda como flujo (`[]`) y no con un 5XX que termina en correo
al admin. Medido 27-sep-2026 en un site de prueba con los plugins `typesafe` + `typesafe-icon`.
