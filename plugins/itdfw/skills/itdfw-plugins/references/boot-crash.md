# Sub-schema literal desde un plugin: por qué es peor y el caso real

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

🔴 **Peor desde un plugin que desde un modelo**: un NAMED sobre `User` contamina a User **y a todo lo que
lo clona** (Member, DelegatedUser…) → cae la autenticación → **todas las puntas dan 500**. El error
(`eachVirtualPath is not a function` en `02hasFiles`) apunta a un archivo del core y **no menciona tu
plugin ni tu campo**. Caso real 2026-08-14: media hora de bisección sacando modelos uno a uno.
