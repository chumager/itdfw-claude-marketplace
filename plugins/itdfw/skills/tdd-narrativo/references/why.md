# El problema que resuelve el TDD narrativo

**Un TDD escrito DESPUÉS de codificar no prueba el requerimiento: prueba lo que el dev entendió del
requerimiento.** Si entendió mal, el test hereda el mismo error y **siempre pasa** — el verde es una
tautología, porque código y test comparten el origen equivocado. Solo se pone rojo si se metieron mal
los dedos, nunca si se entendió mal el problema.

Es el error que cometen TODOS los devs, y con un agente escribiendo el código es peor: **el dueño no
lee el código**. Si además el agente define solo qué se prueba, no hay ningún punto donde el
malentendido pueda salir a la luz.

⟹ **El SSoT es el `TDD.md` de cada módulo.** Es lo que el dueño lee y aprueba. El código es el
entregable automatizable; el contrato es el TDD.
