# Porqués y ejemplos de las reglas del contrato

## §0b · los modos

Son **tres formas distintas de tratar el código**, y un cajarito que no sabe cuál es asume la más conservadora
("esto ya funciona, no lo toco") y de ahí salen los wrappers y los parches sobre piezas recién hechas. Decirle *"esto es
nuevo, no parches, reimplementa y si te pillas con obstáculos consulta"* es muy distinto a *"esto está en producción,
mantén firmas y edges, solo incrementales"*.

## §0d · solo se prueba lo que ESTE módulo define

Cada fila de pruebas nombra una propiedad que el módulo DEFINE. Lo que define otro módulo (aunque sea nuestro: el
fetcher, el SW, el core), el framework reactivo, el browser o la red **no tiene caso**: el módulo es cliente y asume que
eso funciona. Si una prueba propia cae por culpa del otro, se informa a su dueño, no se le arma un set. Tampoco entran
edges que en operación normal no ocurren (un PUT que pasa y otro que cae es red caída). Litmus: *si esta fila falla,
¿el arreglo va en ESTE módulo?* Si no, la fila sobra. El síntoma de no aplicarlo: decenas de casos de ese tipo (red
caída, slot con string fijo, workers, config tardía) mientras lo propio —por ejemplo una cascada de cuatro llamadas—
queda sin escribir.

## §0c · un e2e que no pasa

Playwright no es 100 % fiable: el navegador real cambia entre versiones, hay flakes de timing que dependen de la
versión, y un arnés propio puede dar verde donde el servidor real no. Cuando un caso e2e no pasa y la causa no es un
defecto verificado en el código, **se le entrega al dueño con la evidencia** (spec, versión de Chrome,
`error-context.md`, conteos) para que lo mire a mano. No se reescribe la aserción para que pase, no se lo declara flake
sin medirlo, y no se apaga en silencio.

## §2b · el modelo invisible

🔴 **Sin esto el TDD define flujos y el cajarito inventa el modelo**: nadie sabe qué modelos se crearon, qué se
conectó ni contra qué. Un flujo se conversa; un modelo se **declara**. Cuatro piezas, obligatorias (ver SKILL.md §2b).

## §2c · por qué no se copia el criterio

⟹ **Por qué no se copia el criterio acá**: un criterio duplicado se desincroniza en silencio. El día que
la norma de acceso cambie en `itdfw-api-system`, una copia vieja en este archivo sigue instruyendo lo
contrario y nadie se entera (por ejemplo, rutas citadas que se mueven y quedan muertas). El TDD
**orquesta**; el conocimiento vive en un solo dueño.

Vale para el que ESCRIBE el TDD y para el que lo IMPLEMENTA: el hook de skills los frena igual, pero la
razón no es el hook — es que sin el skill del área se inventa el criterio.

## §4 · ejemplo canónico de concurrencia

🔴 **Una prueba de concurrencia FUERZA la carrera y AFIRMA que ocurrió.** Lanzar N cosas "a la vez" y mirar el
resultado no prueba nada: que choquen depende del procesador, la red y la carga, y un verde así puede ser N
operaciones que se serializaron solas. La carrera se fuerza con una **barrera** (cada participante entra a la zona
crítica, espera hasta que estén todos adentro, y recién ahí actúa) y la prueba **afirma que hubo choque** (reintentos,
conflictos, esperas) además del resultado. Esa aserción es la que la hace caer en rojo cuando el mecanismo falta.
Ejemplo canónico: la prueba de nivel 3 del plugin `autoincrement` (N3.3/N3.4): veinte transacciones abiertas tras una
barrera, números 1..20 **y** cuerpos corridos > 20; sin la sesión en el contador da `bodies run 20` y cae. La única
forma de probar concurrencia es forzar el race, no depender de la capacidad del procesador ni de la red.

## §5 · la disciplina del código

- **Un cambio, una corrida.** Meter cuatro cambios y correr al final (cuatro cambios juntos → cinco rojos) deja
  deduciendo en vez de aislar.
- 🔴 **Hay pasada de verificación de CÓDIGO, no solo de tests.** El "listo" exige leer el código contra el
  contrato (firmas, capas, qué pisa a qué), aparte de la suite verde. Verificar solo tests y asumir el código deja
  pasar decisiones no documentadas que resultan malas, y una suite 25/25 con tres parches adentro, que solo aparecen
  al abrir el archivo.

## §6 · la evidencia de que nada operaba

El flujo no termina con las pruebas: "está probado" no es "está implementado y funcionando". La evidencia típica: un
módulo con decenas de verdes, sin commit y en ningún deploy; otro con 11/11 que nunca se cargó a quien lo iba a usar —
todos "terminados" según su TDD y ninguno operando. Un TDD que cierra en verde deja la cosa en el limbo.

## Rebanada 1

Un TDD **no se manda a implementar** sin una sección "Rebanada 1": el recorrido más chico que un usuario real hace
esta semana de punta a punta, con lo demás reemplazado por algo tonto. Cada modelo, campo y punta del Modelo nombra
en qué rebanada se usa; lo que no está en la 1 va a una lista de UNA línea, sin diseñar. Sin la rebanada escrita, el
diseño bottom-up sigue creciendo sin acotar qué se implementa primero.

## Tres archivos · el caché de lectura

Un TDD que junta el contrato con la historia de sus decisiones y con el resultado de cada corrida **se vuelve
ilegible y caduca con cada corrida**: la sección Modelo cargando el AST viejo y el nuevo, "Decisiones" como diario por
fecha con citas, y cada fila de prueba arrastrando píxeles y conteos de cada corrida.

**Por qué no es cosmética: el caché de lectura.** Cada lector (el dueño, la sesión, cada cajarito) carga el TDD en su
contexto. Si un cajarito anota el resultado de una prueba **dentro** del contrato, cambia el archivo y **invalida la
lectura de todos los demás**: hay que releer 1.000 líneas para saber que cambió un ✅. Con los tres archivos, una
corrida toca solo `TDD-corridas.md` y el contrato que todos tienen leído sigue siendo válido. El que quiera imprime los
tres; **la revisión se hace desde el primero**.
