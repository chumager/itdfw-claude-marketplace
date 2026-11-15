---
name: tdd-narrativo
description: Use when WRITING, READING or IMPLEMENTING a TDD.md — any agent that receives a TDD.md to implement MUST load this skill first and run its conformity checklist BEFORE writing code; if the TDD lacks a mandatory section (narrative, scopes, MODEL with fields/relations/endpoints, executors, tests with expected results, approval) the agent STOPS and reports what is missing instead of guessing. The mandatory order is narrative → scopes → model → executors → tests, APPROVED by jcmunoz, and only then code. Prevents the tautological TDD and the invisible model (models/fields/endpoints nobody designed). The module's TDD.md is the SSoT; jcmunoz does not read the code, he reads and approves the TDD.
---

# TDD narrativo — el TDD.md es el contrato, no el reporte

## El problema que esto resuelve

**Un TDD escrito DESPUÉS de codificar no prueba el requerimiento: prueba lo que el dev entendió del
requerimiento.** Si entendió mal, el test hereda el mismo error y **siempre pasa** — el verde es una
tautología, porque código y test comparten el origen equivocado. Solo se pone rojo si se metieron mal
los dedos, nunca si se entendió mal el problema.

Es el error que cometen TODOS los devs, y con un agente escribiendo el código es peor: **jcmunoz no
lee el código**. Si además el agente define solo qué se prueba, no hay ningún punto donde el
malentendido pueda salir a la luz.

⟹ **El SSoT es el `TDD.md` de cada módulo.** Es lo que jcmunoz lee y aprueba. El código es el
entregable automatizable; el contrato es el TDD.

## El orden es OBLIGATORIO

```
1. NARRATIVA  →  2. SCOPES  →  2b. MODELO  →  3. EJECUTORES  →  4. PRUEBAS + RESULTADO ESPERADO
                                     ↓
                              ✋ APROBACIÓN
                                     ↓
                                5. CÓDIGO
```

Y antes de escribir el MODELO, tres puertas que evitan que salga contaminado:

```
2c. ¿cargué el SKILL del área de cada sección?          (si no, invento el criterio)
2d. ¿el dominio es una NORMA externa? → traerla vigente  (si no, escribo de memoria)
2e. ¿alguien ya lo provee? adoptar → adaptar → implementar
```

🔴 **El gate NO es el orden: es la aprobación.** Escribir el TDD antes y aprobarlo uno mismo deja el
problema intacto. Nada de código hasta que jcmunoz haya leído y dado el visto bueno.

### 🔴 El camino de un TDD hasta implementarse

```
PMO escribe → CTO → designer → documentador → QA → aprobación de jcmunoz → se implementa
```

| Quién | Qué mira | Cómo participa |
|---|---|---|
| **CTO** | alto nivel: el contrato, la rebanada 1, la arquitectura | opina; no escribe el TDD |
| **designer** | la pantalla, si el módulo tiene front | escribe la sección **UI/UX** del TDD (pantallas, maquetas, cómo se entra y se sale de cada estado, en el celular); no define qué se prueba |
| **documentador** | **correctitud** contra el código: que lo que el TDD afirma exista, que no se contradiga y que sus referencias resuelvan. No entra en completitud | devuelve hallazgos al dueño (con `archivo:línea`); no edita el TDD |
| **QA** | solo el TDD y el problema, nunca el código | aprueba o rechaza el **set de pruebas**; si rechaza, el caso concreto que falta o sobra; no edita el TDD |

- 🔴 **Sin la aprobación de QA no hay aprobación de jcmunoz.** Los comentarios de los revisores no obligan al PMO: él
  defiende lo establecido, y los hallazgos los resuelve jcmunoz con él.
- 🔴 **Toda corrección posterior al TDD** (de jcmunoz o interna) vuelve a pasar por el documentador y por QA. El
  documentador lee **primero el historial** del TDD (`TDD-bitacora.md` y el git log) y revisa solo lo que ese historial
  muestra que le toca; QA recibe el diff con las filas de casos tocadas.
- **Un fix también se escribe**: en `TDD-pendientes.md` o fusionado al TDD. Nada queda sin documentar.
- **Sin burocracia**: cada revisor hace una pasada, responde en la hora y cada rechazo trae el caso concreto, no un
  "revísalo". Un hallazgo es un error o "no verificable con lo que está escrito".

### 0 · El pipe — cómo se hace verdad cada fila (proporcional al módulo)

El resto de este skill dice QUÉ lleva el `TDD.md`. Esta sección dice CÓMO se llega a que cada fila sea
verdad y no apariencia — "el texto se ve en pantalla" no es lo mismo que "la propiedad prometida se
cumple". Ver `feedback_verificado-es-la-propiedad-no-la-apariencia.md`.

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

Caso canónico: el TDD del plugin `translate` (16-sep-2026) — el helper `/t-test` con `caseBlock` por caso.

### 0b · 🔴 El MODO del TDD se declara en la cabecera: nuevo, refactor o incremental

Son **tres formas distintas de tratar el código**, y un cajarito que no sabe cuál es asume la más conservadora
("esto ya funciona, no lo toco") y de ahí salen los wrappers y los parches sobre piezas recién hechas (BackEnd del
banco de smart-fetch, 20-sep-2026). jcmunoz, 21-sep: *"decirle 'esto es nuevo, no parches, reimplementa y si te
pillas con obstáculos consulta' es muy distinto a 'esto está en producción, mantén firmas y edges, solo
incrementales'"*.

| Modo | Qué manda | El brief al cajarito dice |
|---|---|---|
| **Nuevo** (diseño de esta pega) | se implementa limpio; un obstáculo se CONSULTA o se proponen alternativas; **cero parches, cero wrappers sobre lo propio** | "no parches: reimplementa; si algo no calza, para y consulta" |
| **Refactor con cobertura completa** | el comportamiento se conserva; firmas y estructura pueden cambiar **si el contrato cambia primero**; corre TODA la suite | "puedes cambiar firmas si el TDD lo dice; toda la suite verde" |
| **Incremental** (ya opera) | firmas y edges se MANTIENEN; solo se agrega; corre TODA la suite y **declara qué casos cambian** | "solo incremental; firmas intactas; lista de casos que cambian" |

Un cambio posterior sobre un módulo cerrado va como **enmienda o apéndice** del TDD, con su propio modo y la lista de
casos que cambian, y obliga a correr toda la suite. Sin modo declarado, el implementador reporta "TDD INCOMPLETO".

### 0d · 🔴 Solo se prueba lo que ESTE módulo define

Cada fila de pruebas nombra una propiedad que el módulo DEFINE. Lo que define otro módulo (aunque sea nuestro: el
fetcher, el SW, el core), el framework reactivo, el browser o la red **no tiene caso**: el módulo es cliente y asume que
eso funciona. Si una prueba propia cae por culpa del otro, se informa a su dueño, no se le arma un set. Tampoco entran
edges que en operación normal no ocurren (un PUT que pasa y otro que cae es red caída). Litmus: *si esta fila falla,
¿el arreglo va en ESTE módulo?* Si no, la fila sobra. (jcmunoz 25-sep-2026: el TDD de translate llegó a decenas de
casos de ese tipo — red caída, slot con string fijo, workers, config tardía — y la cascada, que era de cuatro llamadas,
nunca se había escrito.)

### 0c · 🔴 Un e2e que no pasa se le PASA al dueño, no se reinterpreta

Playwright no es 100 % fiable: el navegador real cambia entre versiones (Chrome 147 → 153 rompió el flujo de cache de
smart-fetch), hay flakes de timing que dependen de la versión, y un arnés propio puede dar verde donde el servidor real
no. Cuando un caso e2e no pasa y la causa no es un defecto verificado en el código, **se le entrega a jcmunoz con la
evidencia** (spec, versión de Chrome, `error-context.md`, conteos) para que lo mire a mano. No se reescribe la aserción
para que pase, no se lo declara flake sin medirlo, y no se apaga en silencio. (jcmunoz, 25-sep-2026.)

### 1 · Narrativa

Qué es el módulo, para qué existe, qué problema resuelve. **En lenguaje de dominio.**

🔴 **Prohibido el vocabulario de MI solución.** Se escribe *"veinte celdas de una grilla piden el
mismo nombre"*, NO *"N requests con la misma key"*. Un caso descrito con el vocabulario del diseño
propio **ya nació contaminado** — y ese es el sesgo que este skill viene a cortar. En lenguaje de
dominio, el dueño lo lee y dice *"ese caso no existe"* antes de que cueste un día de trabajo.

🔴 **Pero el ESTÁNDAR es dominio, no jerga.** `304`, `If-None-Match`, `max-age`, los verbos HTTP, el
nombre de un módulo que se usa: cuando el dominio del módulo ES una RFC, su vocabulario es el
vocabulario correcto y no hay que traducirlo a lenguaje de usuario. La línea no está entre "técnico"
y "simple", está entre **lo que define el estándar o el módulo usado** (dominio, va tal cual) y **lo
que inventé yo para resolverlo** (implementación, se traduce).

### 2 · Scopes

Dónde vive esto y con qué reglas. Front y back usan las MISMAS palabras para cosas distintas
—concurrencia, reintento, recuperación, lock— y mezclarlas produce pruebas de escenarios inexistentes.

Mínimo a declarar: quién es el actor, qué tipo de concurrencia hay (real multi-proceso vs por
petición), si hay alguien mirando o el sistema se recupera solo, cuánto vive el proceso, y qué
significa "la red" en ese lado.

### 2b · Modelo — lo que existe, con qué campos, y qué punta lo toca

🔴 **Sin esto el TDD define flujos y el cajarito inventa el modelo** (jcmunoz 2026-09-08: *"nunca se define un
modelo, solo flujos; a veces mandas a hacer cosas y no tengo la más reputa idea de qué modelos se crearon ni qué se
conectó ni contra qué"*). Un flujo se conversa; un modelo se **declara**. Tres piezas, obligatorias:

**Entidades** — por cada modelo (nuevo o extendido), **primero una o dos líneas con su ALCANCE**: qué es en
el dominio, por qué existe, quién lo crea y cuánto vive (jcmunoz 2026-09-08: un modelo sin motivo escrito obliga
a preguntar "¿y esto qué es?" en cada lectura). Ese alcance tiene que cerrar con la narrativa y los flujos: si un
modelo no aparece en ningún ejecutor ni en ninguna prueba, sobra o falta algo. Después, la tabla:

| Campo | Tipo | Ref / refPath | Único / índice | Quién escribe | Se proyecta |
|---|---|---|---|---|---|
| `providerRef` | String | — | único con `(owner, method)` | el back, al confirmar | NO (escritura-sola) |

Un campo que no está en la tabla **no existe**; si el implementador lo necesita, vuelve al TDD, no lo agrega.
Lo mismo para un modelo entero (un `PaymentCronRun` que nadie dibujó es hallazgo, no iniciativa).

**Puntas** — `path · verbo · acceso (anónima / auth / perfil / skipCSRF) · quién la llama · qué modelo toca`.

**Relaciones** — un mermaid de pocas líneas con cardinalidad (`Membership }o--|| PaymentCard`). Es lo que se
lee en diez segundos y lo que jcmunoz revisa primero.

⟹ **La implementación se compara contra esta sección.** Modelos, campos o puntas fuera de ella = hallazgo.

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

### 2c · 🔴 Cada sección se escribe CON SU SKILL cargado — este skill no los reemplaza

Este skill dice **qué secciones lleva un TDD y en qué orden**. No dice cómo se modela, cómo se permisa
una punta ni cómo se define un type: cada una de esas cosas tiene dueño, y el dueño es su skill.

| Si la sección define… | Cargar (Skill tool) ANTES de escribirla |
|---|---|
| modelos, campos, refs, flujos de estado | `itdfw-models` (o `itdfw-db-models` si el modelo vive en la BD) |
| **puntas y su acceso** (perfilada / anónima autenticada / anónima sin autenticar) | **`itdfw-api-system`** |
| types custom o Value Objects | `itdfw-mongoose-types` (+ `itdfw-ddd-value-objects` si el valor tiene lógica) |
| componentes o vistas | `itdfw-front-develop` |
| el empaquetado del módulo | `itdfw-fwplugin` |
| cómo se cierra y qué se prueba | `itdfw-completeness` |

⟹ **Por qué no se copia el criterio acá**: un criterio duplicado se desincroniza en silencio. El día que
la norma de acceso cambie en `itdfw-api-system`, una copia vieja en este archivo sigue instruyendo lo
contrario y nadie se entera (hallazgo #127: rutas citadas que se movieron y quedaron muertas). El TDD
**orquesta**; el conocimiento vive en un solo dueño.

Vale para el que ESCRIBE el TDD y para el que lo IMPLEMENTA: el hook de skills los frena igual, pero la
razón no es el hook — es que sin el skill del área se inventa el criterio.

### 2d / 2e / 2f · Secciones condicionales → [`references/conditional-sections.md`](references/conditional-sections.md)

Cada una aplica según el módulo. El litmus decide si el TDD la lleva; la regla completa y su caso están en el
reference, y se leen ANTES de escribir la sección Modelo.

| § | Aplica si… (litmus) | Lo que exige, en una línea |
|---|---|---|
| **2d · Norma externa** | el nombre de lo que escribes lo eligió alguien de afuera (RFC, `grant_type`, `.well-known`, código de un organismo) | traer la norma **vigente** de la fuente, jerarquizar MUST/SHOULD/MAY/deprecated y mapear el choque con lo que implementan los clientes reales. Nunca de memoria |
| **2e · Adoptar → adaptar → implementar** | siempre que el módulo vaya a construir algo que podría existir afuera | los MUST/SHOULD/MAY se fijan **antes** de mirar candidatos; queda escrito qué se evaluó y por qué no sirvió; adaptar = mantener el parche para siempre |
| **2f · El módulo ya opera** | alguna parte ya corre en alguna parte (aunque se vaya a reescribir) | dos secciones: **Diferencial** (qué falta) y **Defectos heredados**, verificados **corriendo**, cada fila con decisión del dueño: arreglar o heredar |
| **2g · Superficie de ataque** | el módulo recibe de afuera algo que el back usa para actuar (una URL, un host, código, un tamaño, una llave de config), o gasta plata nuestra | tabla de actores y, por cada entrada, SSRF / DoS / DoW / cruce de tenants con su caso. **Si el módulo es para un SaaS** (cualquier multi-tenant), además el apartado SaaS: admin del tenant y arquitecto del SaaS, verificado en QA o en la nube, no en local |

### 3 · Ejecutores

**Quién dispara cada flujo**: un usuario haciendo click, un worker, un cron, otro servicio, el propio
framework en el arranque. Cambia por completo qué es un fallo aceptable y qué se puede preguntar.

Test rápido: *¿hay alguien a quien avisarle?* Si no lo hay, no existe "preguntar" ni "cancelar" — hay
que recuperarse o registrar. (Y si lo hay, tampoco se inventan opciones: ver "escenarios que no
existen".)

### 4 · Pruebas y resultado esperado

🔴 **Toda prueba se corre por consola y su salida es verde/rojo por caso.** Las de pantalla son specs de
`@playwright/test` que viven con la unidad probada; **ningún caso se ejecuta por un MCP de browser** (trae la
página entera al contexto por llamada y no deja prueba). Un TDD cuyo ejecutor "pantalla" diga "Playwright" se
lee como spec programático, jamás como sesión interactiva (rule `e2e-programatico-nunca-mcp`).

🔴 **Quién escribe cada prueba:** el TDD del PMO declara **sus** pruebas, las headless (su back y su lógica). Los
casos de pantalla (el recorrido completo contra el back real, la UI/UX, las capturas) los escribe y los corre **QA**,
a partir de las filas del TDD y de un scope en prosa que el PMO le da (casos, datos, qué observar): el PMO no los
escribe como spec, porque quien prueba lo propio en pantalla prueba lo que él entendió. Una fila de pantalla del TDD
dice **qué debe verse**; el spec es de QA (`itdfw-completeness`, § "Quién prueba qué").

Tabla por nivel. Cada fila: **el caso en lenguaje de dominio · qué cubre · el resultado esperado**.

**Niveles, y no se evalúa uno si el anterior no está verde:**

| Nivel | Qué prueba |
|---|---|
| **0** | la infraestructura de la que todo depende (si esta miente, todo lo de arriba miente) |
| **1** | el flujo **serial** completo con TODOS sus edges. Sin concurrencia |
| **2** | concurrencia entre operaciones **distintas** |
| **3** | concurrencia sobre **la misma** operación |

**Por qué escalar así:** si el serial no funciona, el concurrente no tiene opciones. Arreglar
concurrencia sobre un serial roto marea y termina rompiendo lo principal.

🔴 **Una prueba de concurrencia FUERZA la carrera y AFIRMA que ocurrió.** Lanzar N cosas "a la vez" y mirar el
resultado no prueba nada: que choquen depende del procesador, la red y la carga, y un verde así puede ser N
operaciones que se serializaron solas. La carrera se fuerza con una **barrera** (cada participante entra a la zona
crítica, espera hasta que estén todos adentro, y recién ahí actúa) y la prueba **afirma que hubo choque** (reintentos,
conflictos, esperas) además del resultado. Esa aserción es la que la hace caer en rojo cuando el mecanismo falta.
Caso canónico: la prueba de nivel 3 del plugin `autoincrement` (N3.3/N3.4): veinte transacciones abiertas tras una
barrera, números 1..20 **y** cuerpos corridos > 20; sin la sesión en el contador da `bodies run 20` y cae (jcmunoz,
7-oct-2026: *"la única forma de probar concurrencia es forzar el race, no depender de la capacidad del procesador ni
de la red"*).

#### 🔴 Componentes y tipos propios: la vertical se prueba COMPLETA, hasta XLS y PDF

Un tipo o un componente no termina en la pantalla. El mismo valor **se descarga en planilla y se
imprime en documento**, y esas dos son salidas de primera clase, no un extra.

⟹ **Todo TDD de componente o tipo propio incluye, obligatoriamente, un caso de descarga XLS y uno de
generación PDF.** Sin eso el nivel 1 NO está cubierto: falta el tramo final de la vertical.

**Por qué justo ahí y no en otro lado:** es la única salida **irreversible** —un contrato o una
planilla que ya salió al cliente no se corrige— y es la que **más depende de contexto goteado** (el
locale, la moneda, el request). Un test unitario del objeto de valor no lo ejerce: el objeto formatea
bien aunque el pipe que le entrega el locale esté roto. Es exactamente el hueco que hay que cerrar.

**Y son baratas**: `toPDF` devuelve un `{text, ...style}` plano → se afirma sobre el objeto, **sin
renderizar el archivo**. Mínimo: un valor normal con dos locales distintos, y el valor vacío.

#### 🔴 Una prueba que se corre A MANO no es una prueba: es un ritual

Al definir cada caso hay que decir **cómo se ejecuta solo**. Si la respuesta es *"se deja todo en modo
debug, se arma un caso grande y se van mirando los edges"*, ese caso **está mal definido** y no se
aprueba así — porque **nadie repite un ritual de una hora**. Se corre una vez, se anota el resultado, y no
se vuelve a correr nunca.

🔴 **Y ahí viene el daño, que no es no-probar sino algo peor: el número CADUCA callado.** Una medición vale
solo mientras viva el régimen en que se midió. El sistema cambia después, y el resultado se sigue citando
como vigente porque re-medirlo cuesta una hora. Queda una certeza fósil: creemos que está probado, y está
probado *otro* sistema.

⟹ **Si el resultado esperado de un caso es un NÚMERO o un CONTEO** —cuántos componentes reaccionaron,
cuántos requests salieron, cuántos ms tardó, "¿se despertó alguien más?"— **el caso se define desde el
principio como ejecutor automático**. El test es lo que ata el número a su régimen: si el régimen cambia,
se cae ese día y no dos años después.

Litmus al escribir la fila: *¿el resultado es un número o un "¿reaccionó alguien más?"* → es ejecutor
automático, no inspección. (El costo suele ser mucho menor de lo que parece: la infra de prueba y los logs
que dicen quién reaccionó ya existen; falta la aserción.)

#### 🔴 Las pruebas son un GRAFO, no un árbol (jcmunoz 2-oct-2026)

"Tengo este requerimiento, le hago un test" produce un árbol con duplicados. La pregunta va al revés: **con mi set
de pruebas, ¿queda todo el contrato encadenado o hay nodos colgando?**

| Regla | Qué significa |
|---|---|
| cada test declara **qué cubre** | los nodos del contrato que recorre (de diseño, sistema y funcionales); un test cubre varios nodos y un nodo puede quedar cubierto por varios tests |
| se agrega un test solo para un **nodo colgando** | la revisión busca los nodos sin cobertura, ve a qué corresponden, y recién ahí escribe uno |
| **no se prueba en una prueba la base de las demás** | si N specs recorren un mecanismo, un spec dedicado a él no aporta: si el mecanismo se rompe, caen todos; si cae uno solo y a ratos, es entorno o el spec (rule `e2e-siempre-chrome-real-y-al-dia`, paso 0) |
| **dos pruebas con intent distinto que hacen lo mismo son una** | se saca la redundante; no se fusionan en una nueva |

Caso: `itd-t-shared` (translate) probaba "redefinir → PUT → `mutate({force})` → aviso del SW → repintar", que ya
recorrían `nullify`, `attr-href`, `grid-width`, `not-translatable` y `status-colours`. Falló 2 de 4, se le culpó a un
cambio ajeno sin correlación, y a mano funcionaba siempre. Se sacó.

### 5 · Recién ahí, el código

Y con la disciplina que hace no-decorativos a los tests:

- 🔴 **Rojo antes que verde.** Un test que nunca se vio fallar no prueba nada. Verlo rojo primero es
  la única evidencia de que mide algo.
- **Detector regalado**: si el test pasa a la primera SIN haber escrito el código, **el test está
  malo**. Sin excepciones.
- **Un cambio, una corrida.** Meter cuatro cambios y correr al final deja sin saber cuál rompió qué
  (caso real 2026-08-06: cuatro cambios juntos → cinco rojos → media hora deduciendo en vez de
  aislar).
- 🔴 **Un wrapper sobre algo que se está construyendo AHORA es PLR instantánea, sin mirar por qué.** Vale para
  implementación nueva y para refactor con cobertura completa por igual: si me pillo, o pillo al cajarito, poniendo un
  wrapper, un adaptador, un literal que copia getters, una marca (`Object.defineProperty`) o un `{...obj, metodo:
  otro}` sobre una pieza NUESTRA de esta misma pega, está 100 % malo. No se evalúa si "queda bueno": se devuelve
  al tiro, como una tilde que falta en una tesis. Sin una justificación 100 % correcta y escrita en el TDD, la
  firma se cambia, no se envuelve (rule `firma-nuestra-no-se-envuelve`).
- 🔴 **Hay pasada de verificación de CÓDIGO, no solo de tests.** El "listo" exige leer el código contra el
  contrato (firmas, capas, qué pisa a qué), aparte de la suite verde. Durante años solo verificamos tests y asumimos
  el código: el plugin de cuotas del bloque financiero nació así y hubo que echar TODO pie atrás porque ninguna
  decisión no documentada estaba buena, ni una; ese día nació este skill. El BackEnd del banco de smart-fetch
  (20-sep-2026) volvió a pasar: 25/25 con tres parches adentro, cazados solo cuando jcmunoz abrió el archivo.
- **La rebanada probada termina en COMMIT, y el bump se decide contra el registry.** Verde no es
  "listo": listo es commiteado (rule `commit-al-cerrar`, con `itdfw-deps.sh files` si tocó un
  publicable) y con la versión decidida por `drift`, no por el diff anterior (rule `bump-al-arreglar`).
  El criterio vive en esas rules; acá solo el puntero.

### 6 · 🔴 OPERANDO — el término real, que no es "está probado"

jcmunoz, 2026-09-15: *"nuestro flujo termina con las pruebas, no tiene término real, tiene 'está probado', no
'está implementado y funcionando'"*. La evidencia: el auth-chain (90 verdes, sin commit, en ningún deploy),
`notifications` (11/11, nunca cargado a socios), `payments`, `wellKnown` — todos "terminados" según su TDD y
ninguno operando. Un TDD que cierra en verde deja la cosa en el limbo.

⟹ El TDD lleva una sección final **"Puesta en operación"** con cuatro campos, y **no está cerrado hasta que los
cuatro tienen valor**:

| Campo | Qué |
|---|---|
| **Commit** | el hash |
| **Versión** | el bump publicado (rule `bump-al-arreglar`) |
| **Deploy** | en cuál corre (nombre, no "dev") |
| **Uso** | quién lo usó y qué vio: un request real, una captura, un "anda pulento" de alguien que no es quien lo hizo |

Sin los cuatro, el estado es **"probado"**, no **"operando"**, y el documento NO pasa de `current/` a
`architecture/` (skill `itdfw-documentation`).

### 🔴 La REBANADA 1 — el stopper (rule `rebanada-1-stopper`)

Un TDD **no se manda a implementar** sin una sección "Rebanada 1": el recorrido más chico que un usuario real hace
esta semana de punta a punta, con lo demás reemplazado por algo tonto. Cada modelo, campo y punta del Modelo nombra
en qué rebanada se usa; lo que no está en la 1 va a una lista de UNA línea, sin diseñar. Caso canónico:
el TDD de un plugin propio (el diseño bottom-up llevaba dos horas creciendo; con la rebanada escrita, la
implementación salió en 44 minutos, 56/56).

## 🔴 El TDD inicial NO puede ser completo — y no debe intentarlo

Un TDD inicial **define el contrato**, no la cobertura total. Es imposible prever todos los casos
antes de escribir una línea, y perseguirlo produce parálisis o casos inventados.

⟹ **Se cicla.** El TDD inicial fija lo que el módulo debe cumplir; la cobertura **crece por
complementación** a medida que se descubren cosas. Los tests que nacen DESPUÉS —de cobertura, de
blindaje contra una dependencia, de un caso que apareció— **son igual de correctos**. Lo que no puede
nacer después es el CONTRATO.

| Tipo de test | Cuándo nace | Responde a |
|---|---|---|
| **Contrato** | ANTES del código, aprobado | *"esto es lo que el módulo debe hacer"* |
| **Cobertura / blindaje** | después, complementando | *"esto es lo que además hay que cuidar"* (ej. un canario contra una dependencia que cambie) |

### Proporcionalidad: no todo hueco se cierra

Antes de perseguir un caso descubierto, medir **qué cuesta que ocurra**:

- Si el peor escenario es *"un request de más"* o *"un poco más de carga"*, es un **feature**, no un
  must. Se anota y se sigue.
- Si además el originador es siempre el mismo código, la probabilidad ya es marginal.
- Recursividad, órdenes, permutaciones y casos combinatorios: **casi siempre pérdida de tiempo**. Una
  depuración de bajo nivel los detecta el día que aparezcan.

Perseguir el 100% en un feature es el mismo error que no probar el must.

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

## 🔴 Checklist de conformidad — para quien RECIBE un TDD (cajaritos incluidos)

Antes de escribir una línea, quien implementa **audita el TDD** contra esta lista. Si falta algo, **NO codea**:
termina el turno con un reporte "TDD INCOMPLETO: falta X, Y" y para. Que el esclavo nos mande la PLR **antes**
de gastar un token en código es el objetivo, no un fallo (jcmunoz 2026-09-08).

| # | Debe traer | Si falta |
|---|---|---|
| 1 | Cabecera con estado **APROBADO por jcmunoz + fecha** y el **MODO** (nuevo / refactor con cobertura completa / incremental; o la enmienda con su modo) | sin aprobación no hay código, aunque el TDD esté perfecto; sin modo, "TDD INCOMPLETO: falta el modo", porque cambia cómo se trata cada línea (§0b) |
| 2 | Narrativa en lenguaje de dominio | pedir la narrativa; no deducirla del código vecino |
| 3 | Scopes (actor, concurrencia, quién mira, vida, red) | reportar; sin scope las pruebas se inventan |
| 4 | **Modelo**: alcance escrito de cada entidad (qué es, por qué existe, quién la crea, cuánto vive), tabla de campos, tabla de puntas, mermaid de relaciones | 🔴 reportar; JAMÁS inventar campos, modelos ni puntas |
| 4a | **AST de diseño de cada componente y punta** (§2b'): props con significado, cadena de capas y qué método pisa cada una, quién declara el render, lo que NO hace; punta con params, respuesta exacta y errores | 🔴 reportar "TDD INCOMPLETO: componente/punta sin AST"; un implementador que decide el árbol por su cuenta deja al dueño leyendo código |
| 4b | **Coherencia del modelo**: el implementador VALIDA que el motivo de cada modelo hace sentido con la narrativa, los ejecutores y las pruebas (todo modelo aparece en algún flujo; todo flujo toca modelos declarados) | reportar la incoherencia como parte del "TDD INCOMPLETO", con el modelo y el flujo que no cuadran |
| 4c | **Cada punta declara su acceso y el POR QUÉ** (columna de la tabla de Puntas). El criterio NO está acá: se juzga con `itdfw-api-system` cargado | reportar como "TDD INCOMPLETO" una punta sin acceso declarado, o abierta sin motivo escrito. Si el skill del área no se cargó, cargarlo antes de juzgar |
| 4d | **Si el dominio es una NORMA externa** (RFC, spec, normativa legal, API de un tercero): el TDD cita la **versión vigente con fecha**, clasifica `MUST`/`SHOULD`/`MAY`/deprecated, y declara el **choque con lo que los clientes reales implementan hoy** | 🔴 reportar "TDD INCOMPLETO: dominio normativo sin norma citada". Un TDD de protocolo escrito de memoria se implementa en verde contra un estándar equivocado — es el peor caso, no el más leve |
| 4e | **Adoptar / adaptar / implementar**: los requisitos clasificados MUST/SHOULD/MAY, y qué se evaluó del ecosistema antes de decidir construir. Si se adopta o adapta: versión, licencia, mantenimiento, y qué parte del contrato queda en manos ajenas | reportar si el TDD manda a implementar algo de infraestructura sin decir qué se miró. No es burocracia: sin ese registro, en seis meses nadie sabe si la librería obvia ya se descartó o nadie la miró |
| 4f | **Si el módulo YA OPERA** (mudanza, empaquetado, migración, reescritura): además del diferencial, una sección de **defectos heredados** — cada uno verificado corriendo (o marcado explícitamente como sospecha, con la prueba que lo destaparía) y cada uno con su decisión de arreglar o heredar | 🔴 reportar "TDD INCOMPLETO: mudanza sin auditoría de lo que se muda". Sin esa sección se copia el defecto tal cual y se estrena en el paquete nuevo, ahora avalado por un TDD aprobado (§2f) |
| 4g | **Destino al cerrar** declarado en la cabecera: módulo nuevo (se queda) o intervención (skill + `architecture/` + tests, archivo a `history/`) | reportar; y al cerrar, **ejecutarlo**: sin skill y arquitectura escritos el TDD no está cerrado, está abandonado |
| 5 | Ejecutores (quién dispara cada flujo, a quién se avisa) | reportar |
| 6 | Pruebas por nivel con **resultado esperado** y **cómo se ejecuta solo** | reportar; un caso sin ejecutor automático no se implementa como ritual |
| 7 | Decisiones que los tests blindan | reportar si un caso contradice una decisión |
| 8 | Huecos declarados | si el implementador descubre uno nuevo, lo AGREGA al TDD, no lo tapa |
| 9 | **Tres archivos**: `TDD.md` solo contrato (≤ 300 líneas), `TDD-bitacora.md` porqués fechados, `TDD-corridas.md` una fila por corrida | 🔴 al reportar, el implementador escribe **una fila** en corridas y **una palabra** de estado en el contrato; JAMÁS números, píxeles ni citas dentro del contrato: eso invalida la lectura de todos los demás |
| 10 | **Cero wrappers sobre piezas propias de esta pega**, y el reporte pega el código de lo que cambió, no solo el número | 🔴 si la pieza nuestra no calza, se PARA y se reporta "la firma de X no cubre Y" en vez de envolverla; el gestor lee ese código contra el contrato antes de aceptar |

Y durante la implementación: **cada campo, modelo o punta que escriba tiene que existir en la sección Modelo**.
Si necesita uno que no está, para y reporta (el TDD se corrige primero). El reporte final compara lo hecho
contra esa sección, no contra su memoria.

## 🔴 TRES archivos, no uno: contrato · bitácora · corridas

Un TDD que junta el contrato con la historia de sus decisiones y con el resultado de cada corrida **se vuelve
ilegible y caduca cada media hora**. El caso que lo prueba (19-sep-2026, plugin `translate`): 1.143 líneas, con la
sección Modelo cargando el AST viejo y el nuevo, "Decisiones" como diario por fecha con citas, y cada fila de prueba
arrastrando píxeles y conteos de cada corrida. jcmunoz: *"mi impresión duró menos de media hora y ya era inválida"*.

| Archivo | Qué lleva | Quién lo lee | Cuándo cambia |
|---|---|---|---|
| **`TDD.md`** | **solo el contrato**: narrativa corta, scope, modelo y AST **sin historia**, ejecutores, pruebas con estado en UNA palabra (✅ ⬜ ⛔), huecos, decisiones en una línea cada una, rebanada, puesta en operación | jcmunoz, para aprobar; el implementador, para conformidad | solo cuando cambia el contrato. Objetivo ≤ 300 líneas |
| **`TDD-bitacora.md`** | el porqué fechado de cada decisión, las citas, lo que se descartó y por qué | quien necesite entender un porqué | se **agrega** al final; nunca se reescribe hacia atrás |
| **`TDD-corridas.md`** | una fila por corrida: fecha · qué · rojo primero · verde · números | quien dude de si algo se probó y cuándo | se agrega una fila por corrida |
| **`TDD-pendientes.md`** | las rebanadas declaradas y **no tomadas**: una por bloque, con qué y por qué, sin diseño fino; y 🔴 **un TDD en borrador que espera aprobación** (un TDD sin pendientes no aparece en ninguna búsqueda: es lo mismo que dejarlo en `ideas/`) | quien busque trabajo pendiente: **existir el archivo ES la señal** (`find -name "TDD*pendientes.md"`), sin leer contratos | cuando un cajarito toma una rebanada, **sale de acá y entra al contrato**; si queda vacío, se borra. 🔴 Un fix también se escribe acá o se fusiona al TDD: nada queda sin documentar |

🔴 **El contrato no carga pendientes** (jcmunoz 5-oct-2026): si las rebanadas futuras viven dentro del `TDD.md`, saber
qué falta exige leer cada TDD completo, y saber cuáles TDD tienen algo exige leerlos todos.

**Por qué no es cosmética: el caché de lectura.** Cada lector (jcmunoz, la sesión, cada cajarito) carga el TDD en su
contexto. Si un cajarito anota el resultado de una prueba **dentro** del contrato, cambia el archivo y **invalida la
lectura de todos los demás**: hay que releer 1.000 líneas para saber que cambió un ✅. Con los tres archivos, una
corrida toca solo `TDD-corridas.md` y el contrato que todos tienen leído sigue siendo válido. El que quiera imprime los
tres; **la revisión se hace desde el primero**.

Reglas de escritura que salen de ahí:
- Una decisión nueva: **una línea** en §Decisiones del contrato (qué se blinda) y el porqué completo en la bitácora.
- Una corrida: **una fila** en corridas y, si cambió un estado, la palabra en la tabla del contrato. Ni un número más.
- Un AST que se rediseña: el contrato muestra **solo el vigente**; el anterior y el motivo del cambio van a la bitácora.
- Si el contrato pasa de 300 líneas, algo de historia se coló: se mueve, no se recorta el contrato.

## Mantener el TDD.md vivo

- 🔴 **Una disyuntiva durante la implementación se decide, se escribe y se hace** (rule
  `disyuntiva-se-documenta-y-se-hace`). En la bitácora: el problema, las opciones, la decisión con su criterio y qué
  cuesta deshacerla. En §Decisiones del contrato: una línea marcada **"decidido al implementar, por revisar"**. En el
  reporte, la lista arriba. No se para a preguntar lo que es de la capa propia; lo de jcmunoz (contrato público del
  core, irreversible, acceso de terceros) va por pregunta con push, y se sigue con lo que no dependa de eso.
- **Cada corrida agrega su fila en `TDD-corridas.md`** (fecha, conteo, tiempo) y, si cambió un estado, la palabra en
  el contrato. Es el respaldo de qué se probó y cuándo, sin invalidar la lectura del contrato.
- **Los huecos se DECLARAN, no se omiten.** Una tabla de "falta cubrir" con su motivo vale más que
  una cobertura que aparenta ser completa.
- **Las decisiones de diseño que los tests blindan** van escritas: qué se decidió (una línea, en el contrato) y por qué
  (en la bitácora). Es lo que impide que un refactor futuro las deshaga sin darse cuenta.
- Si un test cambia de significado, **cambia su nombre**. Un test cuyo título miente es peor que no
  tenerlo — se lee el título, no el cuerpo.

## 🔴 El DESTINO del TDD se declara al escribirlo, no al terminar

Un TDD es un artefacto de trabajo. Si no dice qué pasa con él al cerrarse, se queda para siempre donde
nació — y los repos se llenan de `TDD-*.md` de cosas ya hechas, que nadie lee y que mienten con el tiempo.
Hay dos clases, y la cabecera dice cuál es:

| TDD de… | Al cerrar, el archivo | El conocimiento va a |
|---|---|---|
| **un módulo nuevo** (`plugins/x/TDD.md`) | **se queda**: es la spec viva del módulo, sus niveles se siguen corriendo | el propio TDD + el README del módulo |
| **una intervención sobre algo que ya existe** (`back/itdfw/TDD-x.md`) | **se va**: a `claude-docs/history/` una vez volcado | el **skill** del área (cómo se usa) + `claude-docs/architecture/` (por qué es así) + los tests, que son lo único que sigue vivo |

Se declara en la cabecera porque **al final nadie lo hace**. Y cerrar el TDD incluye ejecutar el destino:
sin el skill y la arquitectura escritos, el TDD no está cerrado, está abandonado.

## Red flags

| Si te ves… | Para |
|---|---|
| escribiendo tests después de que el código funciona | es el TDD tautológico: no prueba el requerimiento |
| describiendo un caso con vocabulario de tu implementación | ya lo contaminaste con tu diseño |
| viendo verde a la primera sin haber escrito código | el test está malo |
| justificando un caso con "por si acaso" | escenario que no existe |
| corriendo la suite después de varios cambios | no vas a saber cuál rompió qué |
| envolviendo, adaptando o marcando una pieza NUESTRA de esta misma pega (wrapper, literal con getters, `defineProperty`, `{...obj, x}`) | PLR instantánea: la firma es nuestra y se cambia; envolver es parchar de fábrica |
| dando "listo" con la suite verde sin haber leído el código contra el contrato | solo verificaste tests; el código se asume, y así nació el skill (plugin de cuotas) |
| escribiendo un TDD con siglas que no inventamos nosotros (una RFC, un `grant_type`, un `.well-known`) **sin haber traído la norma vigente** | estás escribiendo de memoria una norma que pudo cambiar, y tu memoria tiene meses (§2d) |
| escribiendo "se muda tal cual" sobre algo que ya opera, **sin haber probado qué le pasa hoy** | lo que ya funciona se presume correcto, y así es como un defecto de años viaja adentro del paquete nuevo (§2f) |
| razonando el front con gramática de back (o al revés) | declara el scope y vuelve a leerlo |
| cerrando el TDD de un componente o tipo propio sin caso de XLS ni de PDF | la vertical quedó a medias: falta la salida que se le entrega a un tercero |

## Plantilla del `TDD.md`

```markdown
# <módulo> — TDD por niveles
> Regla de escalamiento: un nivel no se evalúa si el anterior no está verde.
> Modo: <NUEVO (reimplementa, cero parches, consulta) | REFACTOR con cobertura completa (firmas cambian si el contrato cambia; toda la suite) | INCREMENTAL (firmas y edges intactos; toda la suite + lista de casos que cambian)>
> Destino al cerrar: <se queda como spec del módulo | skill `<área>` + `architecture/<ruta>` + tests → este archivo a `history/`>
> Este archivo es SOLO el contrato. El porqué de cada decisión: `TDD-bitacora.md`. Cada corrida: `TDD-corridas.md`.

## 🔴 Rebanada 1 — con esto avanzamos
| # | Qué | Terminado cuando (operando) |
<fuera de la rebanada 1, una línea cada uno>

## El scope
<tabla front/back o el que corresponda: actor, concurrencia, quién mira, vida, red>
<consecuencias prácticas para estos tests>

## Requisitos y qué NO vamos a construir
<MUST / SHOULD / MAY, declarados ANTES de mirar candidatos>
<si el dominio es una norma externa: qué RFC/spec, versión vigente con fecha, y el choque con lo que
 implementan de verdad los clientes con los que vamos a hablar>
| Requisito | must/should/may | ¿alguien lo provee? | Veredicto: adoptar / adaptar / implementar | Por qué |

## Modelo
### Entidades
| Campo | Tipo | Ref / refPath | Único / índice | Quién escribe | Se proyecta |
### Puntas
| Path | Verbo | Acceso | Por qué ese acceso | Quién la llama | Modelo que toca |
| Params (obligatorio · normalización) | Body | Respuesta (shape y status posibles) | Errores (código · causa) |
<el criterio de acceso lo da `itdfw-api-system`; acá solo se declara cuál y por qué>

### Componentes                <!-- §2b': uno por componente Itd* que el módulo declara o extiende -->
| Prop | Tipo | Default | Qué significa |
| Capa (name) | Extiende a | Métodos que declara | Métodos que pisa |
<quién declara el render y qué llama; y la lista de lo que el componente NO hace>

### Relaciones
```mermaid
erDiagram
```

## Diferencial y defectos heredados        <!-- SOLO si el módulo ya opera (§2f) -->
| Pieza | Estado real | Qué hace este módulo con ella |
| Qué está mal hoy | Cómo se sabe (probado corriendo / sospecha + prueba que la destapa) | Arreglar o heredar |

## UI/UX — lo que ve la persona        <!-- SOLO si el módulo tiene front; la escribe designer -->
<pantallas, maquetas, cómo se entra y se sale de cada estado, en el celular. QA escribe el recorrido a partir de esto>

## Ejecutores
<quién dispara cada flujo>

## Nivel 0..3
| Caso (en dominio) | Qué cubre | Estado |

## Huecos conocidos
| Falta | Nivel | Por qué importa |

## Decisiones que estos tests blindan

## Puesta en operación        <!-- sin los 4 campos el TDD está PROBADO, no OPERANDO -->
| Commit | Versión | Deploy | Uso (quién, qué vio) |
```
