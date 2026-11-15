# Escenarios que no existen — detalle y casos

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la plantilla.

## 🔴 Escenarios que no existen

El fallo más caro no es un test que falla: es un test **de algo que no debería pasar nunca**. Cuesta
código, cuesta mantenimiento, y encima blinda una conducta equivocada.

Antes de escribir un caso, dos preguntas:

1. **¿Quién pediría esto y por qué?** Si no hay respuesta con nombre y motivo, el caso no existe.
2. **¿Qué gana el usuario si esto ocurre?** Si la respuesta es "nada" o "queda peor", no es una
   funcionalidad: es un desatino.

Caso real (2026-08-06): *"el usuario cancela la recuperación de red"*. Suena razonable — hasta que
se pregunta qué gana: **ya pidió lo que pidió, y cancelar lo deja mirando una interfaz rota**. No
había opción que ofrecer: el aviso es un **stop**, no un diálogo. El test existía, pasaba en verde, y
blindaba un comportamiento que nadie quería.

🔴 **Las dos preguntas aplican también a los huecos que UNO propone.** El mismo día, auditando ese
módulo, se propusieron tres "escenarios faltantes" —navegar con vuelos en curso, dos pestañas, F5 a
media recuperación— y los tres se cayeron a la primera pregunta: el bloqueo de UI ya impide navegar,
dos pestañas convergen solas por SWR sin perder coherencia, y un F5 en una SPA es *"recarga la app"*,
una decisión del usuario que no hay que administrar. **Proponer un hueco sin filtrarlo es el mismo
error que escribir el test de más, con el disfraz de rigor.**

