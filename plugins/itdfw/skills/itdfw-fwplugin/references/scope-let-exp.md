# `let exp = {}`: el caso del plugin telegram

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

🔴 **`let exp = {}`, nunca `let exp;`.** El módulo se importa en los dos scopes siempre: un plugin
solo-back que hace `if (inBack) exp = {…}` deja **`undefined` en el front** → `Object.entries(undefined)`
en el loader → **cae el front de todo deploy que lo tenga instalado**. Caso real 2026-08-26
(el plugin `telegram`). Partir de `{}` es la línea que lo evita — el front recibe un objeto vacío y sigue.
Y si el plugin solo-back no quiere que el front cargue sus dependencias (telegraf, libs del back), los
imports van **dentro** de la rama (`await import(...)`), no arriba del archivo.
