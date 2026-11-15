# AST de diseño de componentes y puntas — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la plantilla.

### 2b' · 🔴 Componentes y puntas también llevan su AST de diseño — no solo los modelos

Lo de arriba deja bien definidos los MODELOS. Pero un **componente** o una **punta** que solo aparece en flujos y
casos queda como *"necesidad que la implementa el que quiera como quiera"*: el implementador decide el árbol, y el
dueño termina **leyendo código** para poder opinar (jcmunoz 2026-09-18, `ItdT` del traductor: el componente nació a
rebotes —regex, ellipsis, botón, popover, líneas— porque el TDD nunca declaró su forma; *"sin AST de diseño no
podemos dar el vamos a algo"*). Un requerimiento de diseño sin su AST no es diseño.

**Componente** (`Itd*`): una tabla y un árbol, ANTES de codear:

| Qué | Cómo se declara |
|---|---|
| props | nombre · tipo · default · qué significa (en dominio, no "boolean") |
| cadena | qué capa lo declara y qué capa lo **extiende** (core → front-lib → plugin), con el `name` de cada una |
| métodos por capa | qué método declara cada capa y **cuál pisa** (una tabla: método · capa que lo declara · capa que lo pisa) |
| render | quién declara el `render` (una sola capa) y qué llama (`content()`, `renderX()`); las demás capas NO lo redeclaran |
| lo que NO hace | explícito: qué decisión NO toma (ej. "no detecta HTML: pinta `innerHTML` siempre") |
| 🔴 qué pieza del FW ES | la PRIMERA fila si el componente tiene campos: ¿es un **form** (`GenericForm` + definición de inputs + controller), una grilla, una vista? En ITDFW un conjunto de campos con guardar ES un form. El editor del traductor (18-sep) nació como modal a mano con `renderGI` por campo porque el brief describió la UI y nadie preguntó "¿esto es un form?" |

**Punta** (`APP/…`, `options.API`): `path · verbo · acceso · params (nombre, obligatorio, normalización) · body ·
respuesta (shape exacto, y los `status` que puede traer) · errores (qué código para qué causa)`. Sin la respuesta
escrita, el front adivina el shape y el TDD no puede decir qué lo haría fallar.

⟹ Lo que un cajarito implemente que no esté en ese árbol es **hallazgo**, igual que un campo fuera de la tabla del
modelo. Y si al implementar el árbol resulta mal, se corrige el TDD primero, no el código.

