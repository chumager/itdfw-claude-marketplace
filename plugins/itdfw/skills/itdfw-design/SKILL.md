---
name: itdfw-design
description: Use when designing, briefing or reviewing any ITDFW screen or UI piece — a plugin's view, a NUI component, a filter bar, a list that may grow, a form, a modal — and before choosing a control, a scroll, a pagination or a layout; also when an implementer hands back a screen to review, or when the FW's own piece for a case looks dated. The design judgement layer over itdfw-nui (how to paint) and itdfw-front-develop (how to build).
---

# ITDFW design — criterio antes que reglas

**Manda el sentido común.** Una guía orienta, pero no reemplaza pensar el caso: cada decisión se analiza en su mérito.
Este skill es el **criterio** con que se diseña una pantalla del FW. No es una lista cerrada: orienta, no restringe.
Cómo se pinta (tokens, `$NUI`) está en `itdfw-nui`, y cómo se construye un componente, en `itdfw-front-develop`. Aquí
está el **qué y el porqué**.

## 1 · La responsabilidad es del diseñador, aunque delegue

La UI/UX es de quien diseña, de punta a punta, también lo que hace un implementer. La vara no es que el implementer la
deje "ok": es que el dueño del producto la apruebe sin tener que corregirla, y lo que se busca es que lo sorprenda.
Lo que no se aprobaría, se devuelve antes de que llegue a él.

## 2 · Primero la coherencia: ¿qué pieza del FW es esto, y cómo la usa el sistema hoy?

Es la primera pregunta de cada elemento de pantalla, antes que "¿cómo lo hacen otros productos?". El FW trae el tema
desde el back, reutiliza componentes y resuelve cada tipo de dato con la misma pieza en todas partes. Una pantalla que
copia un patrón de afuera en vez de usar la pieza del FW produce una interfaz inconsistente, distinta en cada vuelta.

**Cómo se encuentra la pieza, cada vez** (no hay una tabla de respuestas: el FW cambia y una tabla envejece):

1. **¿Qué es esto en el dominio?** Un estado sí/no, un filtro, un conjunto de campos que se guardan, un valor con tipo,
   una lista, una acción sobre una fila.
2. **¿Cómo lo resuelve hoy otra pantalla del FW?** La grilla, el form o la vista del modelo son la referencia: si ahí ya
   está resuelto, aquí se usa lo mismo.
3. **¿Qué componente es y quién lo usa?** El MCP `inventory` (`branch` y `affected` sobre el componente) da la cadena
   y los usos. Los skills `itdfw-front-develop` e `itdfw-nui` dicen cómo se usa.
4. **Solo si el FW no lo resuelve**, se mira afuera, y lo que se trae entra como pieza del FW para todos, no como
   algo propio de una pantalla.

Por ejemplo: un filtro que se prende y apaga es un interruptor, y si filtra datos de un modelo es el form de filtro del
FW, igual que en la grilla. Un monto o una fecha pasan siempre por el componente de su tipo (`renderGI` en `detail`). Y
cualquier zona con scroll usa el scrollbar de NUI, nunca el nativo.

### Pero no en modo esclavo

Si la pieza del FW quedó vieja o va contra lo que hoy usa el mercado (colores pastel de los 90, todo exageradamente
redondeado, encabezados que se comen la pantalla), **se levanta la bandera en el momento**, con capturas de antes y
después, y decide el dueño. No se copia en silencio ni se parcha en una sola pantalla: el cambio va en la pieza, para
todos.

## 3 · La escala se analiza en su mérito, con números

No hay reglas fijas del tipo "un modelo de la BD siempre se pagina". Ante algo que puede crecer, las preguntas son:

1. **¿Cuánto pesa cada ítem** (en la red, en memoria) **y cuántos hay hoy?**
2. **¿A qué ritmo crece, y qué parte crece sin techo?**
3. **¿Dónde pega primero:** en la red, al parsear, en la memoria del front o en el DOM?
4. **¿Qué pasa si alguien quiere verlo todo?**
5. **¿En qué número cambia la respuesta?** Esa es la vara, y se escribe.

La solución sale de ese análisis. Por ejemplo, un tablero de unos cientos de tarjetas: los datos pesaban menos de
1 MB y no le pesaban a ningún teléfono, pero armadas en el DOM arrastraban la pantalla. En ese caso la respuesta fue
una lista virtual con todos los datos en memoria, y paginar por red al bajar quedó para cuando la medición lo pida
(cerca de diez mil ítems).

Una palabra ambigua del dueño ("infinito", "rápido", "simple") no se traduce a una regla: se pregunta qué quiso decir.

## 4 · Los estados de toda pantalla

Cada vista se diseña con todos sus estados, no solo con el feliz:

- vacío, con lo que hay que hacer para salir de él;
- cargando;
- error, con su "Try again", sin perder lo que ya estaba;
- un nombre largo y un N grande;
- sin permiso: lo que el perfil no puede hacer no se ofrece; lo decide el back;
- sin red, y la vuelta;
- cómo se entra y cómo se sale de cada estado (modal, drawer, filtro), también en el celular.

## 5 · Pisos que no se discuten

- **44 px** en todo lo que se toca, en el celular. En escritorio puede haber más densidad, pero siempre con **una sola
  altura de control por breakpoint**, para que campos y botones alineen.
- **Grid** para el layout, nunca flex.
- **Colores solo por tokens del tema.** Un token que no existe en ese contexto falla en silencio: se verifica en la
  captura.
- **Claro y oscuro** a la vez, nunca uno solo.
- **Textos por traducción** (`t()`), con base en inglés.
- **Nada de memoria.** Qué soporta un navegador se coteja en caniuse o MDN. La API de una librería (Naive UI, Vue) se
  consulta con Context7 en la **versión instalada**, o en su código instalado. La afirmación va con su fuente; lo que no
  se pudo cotejar se dice "sin verificar" y no se vuelve requisito. Vale para el brief (§6) y para la revisión (§7): un
  brief que nombra una API la nombra cotejada.

## 6 · El brief al implementer sale con el cómo ya decidido

Lo que un implementer recibe ya trae:

- **la pieza del FW o de NUI** de cada elemento;
- **el volumen real** y el análisis de escala, si aplica;
- **los estados** de la §4;
- qué **no** hace la pieza;
- cómo se mide: qué captura, a qué ancho y qué número.

Un brief que deja elegir la pieza al implementer delega el diseño, y el diseño no se delega.

## 7 · La revisión es con ojo de diseñador, sobre capturas

Lo que vuelve de un implementer se revisa mirando las capturas, no leyendo su reporte:

- **a 360 y a 1280, en claro y oscuro;**
- si toca una pieza común de NUI, **en todos los sites que la usan**, porque el cambio es de todos;
- la pregunta es si el dueño diría "bien" sin corregir nada: coherencia con el resto del sistema, jerarquía, respiro,
  alineación, lo que no se lee, dos cosas que parecen una;
- lo que no pasa esa vara se devuelve con el caso concreto.

La prueba de pantalla formal es de QA, y no reemplaza esta mirada.

---

**Antes de dar por terminado → `itdfw-completeness`.** Complementa a `itdfw-nui`, `itdfw-front-develop` y
`producto-antes-del-tdd` (el estudio de la competencia para pantallas de cliente final).
