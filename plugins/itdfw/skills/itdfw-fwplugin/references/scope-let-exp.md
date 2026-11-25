# `let exp = {}`: por qué, con el plugin telegram de ejemplo

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

🔴 **`let exp = {}`, nunca `let exp;`.** El módulo se importa en los dos scopes siempre: un plugin
solo-back que hace `if (inBack) exp = {…}` deja **`undefined` en el front** → `Object.entries(undefined)`
en el loader → **cae el front de todo deploy que lo tenga instalado**. Ejemplo: el plugin `telegram`. Partir de `{}` es la línea que lo evita — el front recibe un objeto vacío y sigue.
Y si el plugin solo-back no quiere que el front cargue sus dependencias (telegraf, libs del back), los
imports van **dentro** de la rama (`await import(...)`), no arriba del archivo.
