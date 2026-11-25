# El front de Currency inline y por qué el front se declara en el `.itdfw.js`

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

🔴 El `{ vue: { currency: <path> } }` de un deploy con moneda es la forma (2) como **parche temporal** (no por
diseño): Currency todavía vive DENTRO del back → Vite no puede descubrir su front → se declara a mano.
Al externalizar Currency será un import directo como (1). No es "una forma de front" — es inline por
decisión, que acá resuelve un front no-externalizado.

**Por qué el front se declara acá y no en la config del back**: la config del back y la del default/app
son **dos instancias distintas** de lo mismo (no se sobrecargan entre sí). El front de un plugin que
vive en el back no puede inyectarse vía la config del back → se declara en el `.itdfw.js` del front.
