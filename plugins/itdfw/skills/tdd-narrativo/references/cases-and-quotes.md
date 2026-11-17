# Casos y citas de las reglas del contrato

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

## §0b · los modos: el caso

Son **tres formas distintas de tratar el código**, y un cajarito que no sabe cuál es asume la más conservadora
("esto ya funciona, no lo toco") y de ahí salen los wrappers y los parches sobre piezas recién hechas (BackEnd del
banco de smart-fetch, 20-sep-2026). jcmunoz, 21-sep: *"decirle 'esto es nuevo, no parches, reimplementa y si te
pillas con obstáculos consulta' es muy distinto a 'esto está en producción, mantén firmas y edges, solo
incrementales'"*.

## §0d · el caso de translate

Cada fila de pruebas nombra una propiedad que el módulo DEFINE. Lo que define otro módulo (aunque sea nuestro: el
fetcher, el SW, el core), el framework reactivo, el browser o la red **no tiene caso**: el módulo es cliente y asume que
eso funciona. Si una prueba propia cae por culpa del otro, se informa a su dueño, no se le arma un set. Tampoco entran
edges que en operación normal no ocurren (un PUT que pasa y otro que cae es red caída). Litmus: *si esta fila falla,
¿el arreglo va en ESTE módulo?* Si no, la fila sobra. (jcmunoz 25-sep-2026: el TDD de translate llegó a decenas de
casos de ese tipo — red caída, slot con string fijo, workers, config tardía — y la cascada, que era de cuatro llamadas,
nunca se había escrito.)

## §0c · un e2e que no pasa

Playwright no es 100 % fiable: el navegador real cambia entre versiones (Chrome 147 → 153 rompió el flujo de cache de
smart-fetch), hay flakes de timing que dependen de la versión, y un arnés propio puede dar verde donde el servidor real
no. Cuando un caso e2e no pasa y la causa no es un defecto verificado en el código, **se le entrega a jcmunoz con la
evidencia** (spec, versión de Chrome, `error-context.md`, conteos) para que lo mire a mano. No se reescribe la aserción
para que pase, no se lo declara flake sin medirlo, y no se apaga en silencio. (jcmunoz, 25-sep-2026.)

## §2b · la cita del modelo invisible

🔴 **Sin esto el TDD define flujos y el cajarito inventa el modelo** (jcmunoz 2026-09-08: *"nunca se define un
modelo, solo flujos; a veces mandas a hacer cosas y no tengo la más reputa idea de qué modelos se crearon ni qué se
conectó ni contra qué"*). Un flujo se conversa; un modelo se **declara**. Tres piezas, obligatorias:

## §2c · por qué no se copia el criterio

⟹ **Por qué no se copia el criterio acá**: un criterio duplicado se desincroniza en silencio. El día que
la norma de acceso cambie en `itdfw-api-system`, una copia vieja en este archivo sigue instruyendo lo
contrario y nadie se entera (hallazgo #127: rutas citadas que se movieron y quedaron muertas). El TDD
**orquesta**; el conocimiento vive en un solo dueño.

Vale para el que ESCRIBE el TDD y para el que lo IMPLEMENTA: el hook de skills los frena igual, pero la
razón no es el hook — es que sin el skill del área se inventa el criterio.

## §4 · el caso canónico de concurrencia

🔴 **Una prueba de concurrencia FUERZA la carrera y AFIRMA que ocurrió.** Lanzar N cosas "a la vez" y mirar el
resultado no prueba nada: que choquen depende del procesador, la red y la carga, y un verde así puede ser N
operaciones que se serializaron solas. La carrera se fuerza con una **barrera** (cada participante entra a la zona
crítica, espera hasta que estén todos adentro, y recién ahí actúa) y la prueba **afirma que hubo choque** (reintentos,
conflictos, esperas) además del resultado. Esa aserción es la que la hace caer en rojo cuando el mecanismo falta.
Caso canónico: la prueba de nivel 3 del plugin `autoincrement` (N3.3/N3.4): veinte transacciones abiertas tras una
barrera, números 1..20 **y** cuerpos corridos > 20; sin la sesión en el contador da `bodies run 20` y cae (jcmunoz,
7-oct-2026: *"la única forma de probar concurrencia es forzar el race, no depender de la capacidad del procesador ni
de la red"*).

## §5 · los casos de la disciplina del código

- **Un cambio, una corrida.** Meter cuatro cambios y correr al final deja sin saber cuál rompió qué
  (caso real 2026-08-06: cuatro cambios juntos → cinco rojos → media hora deduciendo en vez de
  aislar).
- 🔴 **Hay pasada de verificación de CÓDIGO, no solo de tests.** El "listo" exige leer el código contra el
  contrato (firmas, capas, qué pisa a qué), aparte de la suite verde. Durante años solo verificamos tests y asumimos
  el código: el plugin de cuotas del bloque financiero nació así y hubo que echar TODO pie atrás porque ninguna
  decisión no documentada estaba buena, ni una; ese día nació este skill. El BackEnd del banco de smart-fetch
  (20-sep-2026) volvió a pasar: 25/25 con tres parches adentro, cazados solo cuando jcmunoz abrió el archivo.

## §6 · la evidencia de que nada operaba

jcmunoz, 2026-09-15: *"nuestro flujo termina con las pruebas, no tiene término real, tiene 'está probado', no
'está implementado y funcionando'"*. La evidencia: el auth-chain (90 verdes, sin commit, en ningún deploy),
`notifications` (11/11, nunca cargado a socios), `payments`, `wellKnown` — todos "terminados" según su TDD y
ninguno operando. Un TDD que cierra en verde deja la cosa en el limbo.

## Rebanada 1 · el caso

Un TDD **no se manda a implementar** sin una sección "Rebanada 1": el recorrido más chico que un usuario real hace
esta semana de punta a punta, con lo demás reemplazado por algo tonto. Cada modelo, campo y punta del Modelo nombra
en qué rebanada se usa; lo que no está en la 1 va a una lista de UNA línea, sin diseñar. Caso canónico:
el TDD de un plugin propio (el diseño bottom-up llevaba dos horas creciendo; con la rebanada escrita, la
implementación salió en 44 minutos, 56/56).

## Tres archivos · el caso y el caché de lectura

Un TDD que junta el contrato con la historia de sus decisiones y con el resultado de cada corrida **se vuelve
ilegible y caduca cada media hora**. El caso que lo prueba (19-sep-2026, plugin `translate`): 1.143 líneas, con la
sección Modelo cargando el AST viejo y el nuevo, "Decisiones" como diario por fecha con citas, y cada fila de prueba
arrastrando píxeles y conteos de cada corrida. jcmunoz: *"mi impresión duró menos de media hora y ya era inválida"*.

**Por qué no es cosmética: el caché de lectura.** Cada lector (jcmunoz, la sesión, cada cajarito) carga el TDD en su
contexto. Si un cajarito anota el resultado de una prueba **dentro** del contrato, cambia el archivo y **invalida la
lectura de todos los demás**: hay que releer 1.000 líneas para saber que cambió un ✅. Con los tres archivos, una
corrida toca solo `TDD-corridas.md` y el contrato que todos tienen leído sigue siendo válido. El que quiera imprime los
tres; **la revisión se hace desde el primero**.
