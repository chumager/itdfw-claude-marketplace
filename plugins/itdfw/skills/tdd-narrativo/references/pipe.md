# §0 El pipe — cómo se hace verdad cada fila, completo

El resto de este skill dice QUÉ lleva el `TDD.md`. Esta sección dice CÓMO se llega a que cada fila sea
verdad y no apariencia — "el texto se ve en pantalla" no es lo mismo que "la propiedad prometida se
cumple".

1. **Interrogatorio de propiedades al dueño.** Por cada promesa del módulo, tres preguntas:
   *¿qué propiedad la define? ¿qué prueba la haría FALLAR si no se cumpliera? ¿cómo se ve entrada /
   esperado / real?* Sin respuesta a la segunda pregunta no hay caso de prueba — hay una feature sin
   contrato.
2. **Dummy primero.** Si el módulo tiene una parte difícil (red, BD, un tercero), el contrato se
   implementa COMPLETO sin ella y pasa todos los casos; la parte difícil se aísla detrás de una hoja
   reemplazable (ej. `translate`: la función `resolve`).
3. **Banco vivo.** Si el ejecutor es "pantalla", exige una VISTA con los casos visibles — entrada
   (la llamada como código), esperado literal, qué debe pasar después, y el real (attrs del DOM cuando
   aplica). Un título tipo "atributos correctos" no se verifica, se mira — y el que mira completa con lo
   que imagina.
4. **Un eslabón a la vez, con el dueño mirando.** La arquitectura emerge de los casos, no al revés — el
   corte core/plugin y la forma de una integración externa salen de implementar caso por caso, no de
   diseñarlos de antemano.
5. **Cuando cambia una propiedad, se reescribe la NARRATIVA**, no solo el estado de los tests.

Ejemplo canónico: el TDD del plugin `translate` — el helper `/t-test` con `caseBlock` por caso.
