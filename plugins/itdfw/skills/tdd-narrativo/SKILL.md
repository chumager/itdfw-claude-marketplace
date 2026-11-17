---
name: tdd-narrativo
description: Use when WRITING, READING or IMPLEMENTING a TDD.md — any agent that receives a TDD.md to implement MUST load this skill first and run its conformity checklist BEFORE writing code; if the TDD lacks a mandatory section (narrative, scopes, MODEL with fields/relations/endpoints, executors, tests with expected results, approval) the agent STOPS and reports what is missing instead of guessing. The mandatory order is narrative → scopes → model → executors → tests, APPROVED by jcmunoz, and only then code. Prevents the tautological TDD and the invisible model (models/fields/endpoints nobody designed). The module's TDD.md is the SSoT; jcmunoz does not read the code, he reads and approves the TDD.
---

# TDD narrativo — el TDD.md es el contrato, no el reporte

## El problema que esto resuelve

**Un TDD escrito DESPUÉS de codificar no prueba el requerimiento: prueba lo que el dev entendió.** Si entendió mal, el
test hereda el error y **siempre pasa**: el verde es una tautología. Y **jcmunoz no lee el código** ⟹ **el SSoT es el
`TDD.md` de cada módulo**, que él lee y aprueba; el código es el entregable automatizable. El porqué completo:
[references/why.md](references/why.md).

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

**Antes de este camino, si lo que se construye lo ve un cliente final** (un site nuevo, o un plugin con pantallas de front de cliente), el PMO no parte por el TDD: `designer` estudia el producto de la competencia y presenta alternativas, el dueño elige una y sobre ella escribe el PMO (skill **`producto-antes-del-tdd`**). Las pantallas de back office no pasan por ahí. Cuando hubo estudio, la cabecera del TDD lleva la alternativa elegida y el enlace al estudio.

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

1. **Interrogatorio de propiedades al dueño.** Por cada promesa: *¿qué propiedad la define? ¿qué prueba la haría
   FALLAR si no se cumpliera? ¿cómo se ve entrada / esperado / real?* Sin respuesta a la segunda no hay caso de prueba.
2. **Dummy primero.** El contrato se implementa COMPLETO sin la parte difícil (red, BD, un tercero), aislada detrás de
   una hoja reemplazable.
3. **Banco vivo.** Si el ejecutor es "pantalla", una VISTA con los casos visibles: entrada, esperado literal, qué pasa
   después y el real.
4. **Un eslabón a la vez, con el dueño mirando.** La arquitectura emerge de los casos, no al revés.
5. **Cuando cambia una propiedad, se reescribe la NARRATIVA**, no solo el estado de los tests.

Detalle y el caso canónico (el TDD del plugin `translate`): [references/pipe.md](references/pipe.md).

### 0b · 🔴 El MODO del TDD se declara en la cabecera: nuevo, refactor o incremental

Son **tres formas distintas de tratar el código**; un cajarito que no sabe cuál es asume la más conservadora, y de ahí
salen los wrappers y los parches sobre piezas recién hechas. El caso y la cita de jcmunoz: [references/cases-and-quotes.md](references/cases-and-quotes.md).

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
¿el arreglo va en ESTE módulo?* Si no, la fila sobra. El caso de translate: [references/cases-and-quotes.md](references/cases-and-quotes.md).

### 0c · 🔴 Un e2e que no pasa se le PASA al dueño, no se reinterpreta

Playwright no es 100 % fiable (el navegador cambia entre versiones, hay flakes de timing, un arnés propio da verde
donde el servidor real no). Cuando un caso e2e no pasa y la causa no es un defecto verificado en el código, **se le
entrega a jcmunoz con la evidencia** (spec, versión de Chrome, `error-context.md`, conteos). No se reescribe la aserción
para que pase, no se declara flake sin medirlo y no se apaga en silencio. El caso: [references/cases-and-quotes.md](references/cases-and-quotes.md).

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

🔴 **Sin esto el TDD define flujos y el cajarito inventa el modelo.** Un flujo se conversa; un modelo se **declara**.
Tres piezas, obligatorias (la cita de jcmunoz: [references/cases-and-quotes.md](references/cases-and-quotes.md)):

**Entidades** — por cada modelo (nuevo o extendido), **primero una o dos líneas con su ALCANCE**: qué es en
el dominio, por qué existe, quién lo crea y cuánto vive (jcmunoz 2026-09-08: un modelo sin motivo escrito obliga
a preguntar "¿y esto qué es?" en cada lectura). Ese alcance tiene que cerrar con la narrativa y los flujos: si un
modelo no aparece en ningún ejecutor ni en ninguna prueba, sobra o falta algo. Después, la tabla:

| Campo | Tipo | Ref / refPath | Único / índice | Quién escribe | Se proyecta |
|---|---|---|---|---|---|
| `providerRef` | String | — | único con `(owner, method)` | el back, al confirmar | NO (escritura-sola) |

Un campo que no está en la tabla **no existe**; si el implementador lo necesita, vuelve al TDD, no lo agrega.
Lo mismo para un modelo entero (un `PaymentCronRun` que nadie dibujó es hallazgo, no iniciativa).

**Puntas** — `path · verbo · acceso (función asignable / anónima con su porqué / scope) · skipCSRF · quién la llama ·
qué modelo toca`.

🔴 **Quién puede qué no se diseña en el TDD: lo resuelve el AAA.** En cada punta la pregunta es *¿esto es una función
asignable o una regla en código?* El TDD declara **capacidades** (funciones asignables) y, a lo más, a qué perfil irían
por omisión. Quién las tiene es configuración y baja en cascada por los tenants: el owner arma perfiles para sus
usuarios, y esos para los suyos (un `standOwner` con todo, un `standSale` que solo vende). Un usuario derivado con su
perfil por nombre de modelo está bien; lo que delata no conocer el flujo es amarrar una capacidad a un tipo de usuario
("solo el dueño revierte"), en el contrato o dentro de la punta. Filtrar "lo suyo" es scope y sí va en la punta.

🔴 **Una punta, un caso: las puntas son gratis.** Si la respuesta de una punta se ramifica según el tipo de usuario o el
perfil de quien llama, se parte en puntas propias (otro nombre u otra extensión). Ahorrarse una punta sale caro el día
que hay que leer una que toma diez decisiones para entregar cosas distintas.

**Relaciones** — un mermaid de pocas líneas con cardinalidad (`Membership }o--|| PaymentCard`). Es lo que se
lee en diez segundos y lo que jcmunoz revisa primero.

⟹ **La implementación se compara contra esta sección.** Modelos, campos o puntas fuera de ella = hallazgo.

### 2b' · 🔴 Componentes y puntas también llevan su AST de diseño — no solo los modelos

Un **componente** o una **punta** que solo aparece en flujos y casos deja al implementador decidir el árbol, y el dueño termina leyendo código para opinar (*"sin AST de diseño no podemos dar el vamos a algo"*). Un requerimiento de diseño sin su AST no es diseño.

- **Componente `Itd*`** — una tabla y un árbol ANTES de codear: **props** (nombre · tipo · default · qué significa en dominio), **cadena** (qué capa lo declara y cuál lo extiende, con el `name` de cada una), **métodos por capa** (cuál declara cada capa y **cuál pisa**), **render** (quién lo declara, una sola capa, y qué llama), **lo que NO hace**, y 🔴 **qué pieza del FW ES**: un conjunto de campos con guardar ES un form (`GenericForm` + definición de inputs + controller), no un componente nuevo.
- **Punta** (`APP/…`, `options.API`) — `path · verbo · acceso · params (nombre, obligatorio, normalización) · body · respuesta (shape exacto y status posibles) · errores (código por causa)`. Sin la respuesta escrita, el front adivina el shape.

⟹ Lo que un cajarito implemente fuera de ese árbol es **hallazgo**; si el árbol resulta mal, se corrige el TDD primero, no el código. La tabla completa y el caso de `ItdT` (2026-09-18): [references/design-ast.md](references/design-ast.md).

### 2c · 🔴 Cada sección se escribe CON SU SKILL cargado — este skill no los reemplaza

Este skill dice **qué secciones lleva un TDD y en qué orden**. No dice cómo se modela, cómo se permisa
una punta ni cómo se define un type: cada una de esas cosas tiene dueño, y el dueño es su skill.

| Si la sección define… | Cargar (Skill tool) ANTES de escribirla |
|---|---|
| modelos, campos, refs, flujos de estado | `itdfw-models` (o `itdfw-db-models` si el modelo vive en la BD) |
| **puntas y su acceso** (función asignable / anónima autenticada / anónima sin autenticar) | **`itdfw-api-system`** |
| **quién puede qué**: roles, tipos de usuario, "solo X puede", quién administra a quién | **`itdfw-api-system`** (`references/aaa-access.md`) **e `itdfw-models`** (`references/authenticatable.md`) |
| types custom o Value Objects | `itdfw-mongoose-types` (+ `itdfw-ddd-value-objects` si el valor tiene lógica) |
| componentes o vistas | `itdfw-front-develop` |
| el empaquetado del módulo | `itdfw-fwplugin` |
| cómo se cierra y qué se prueba | `itdfw-completeness` |

⟹ **El criterio no se copia acá**: duplicado, se desincroniza en silencio. El TDD **orquesta**; el conocimiento vive
en un solo dueño, y vale para quien ESCRIBE el TDD y para quien lo IMPLEMENTA. Por qué: [references/cases-and-quotes.md](references/cases-and-quotes.md).

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

🔴 **Una prueba de concurrencia FUERZA la carrera y AFIRMA que ocurrió.** Lanzar N cosas "a la vez" no prueba nada: un
verde así pueden ser N operaciones que se serializaron solas. La carrera se fuerza con una **barrera** (todos entran a
la zona crítica, esperan a estar todos y recién ahí actúan) y la prueba **afirma que hubo choque** (reintentos,
conflictos, esperas) además del resultado. El caso canónico (`autoincrement`, N3.3/N3.4): [references/cases-and-quotes.md](references/cases-and-quotes.md).

#### 🔴 Componentes y tipos propios: la vertical se prueba COMPLETA, hasta XLS y PDF

**Todo TDD de componente o tipo propio incluye, obligatoriamente, un caso de descarga XLS y uno de generación PDF**; sin eso el nivel 1 NO está cubierto (falta el tramo final de la vertical). Es la única salida **irreversible** y la que **más depende de contexto goteado** (locale, moneda, request). Es barata: `toPDF` devuelve un `{text, ...style}` plano y se afirma sobre el objeto, **sin renderizar el archivo**; mínimo, un valor normal con dos locales y el valor vacío.

#### 🔴 Una prueba que se corre A MANO no es una prueba: es un ritual

Cada caso dice **cómo se ejecuta solo**. Si el resultado esperado es un **NÚMERO o un CONTEO** (cuántos componentes reaccionaron, cuántos requests, cuántos ms), el caso se define desde el principio como **ejecutor automático**: el test ata el número a su régimen, y si el régimen cambia se cae ese día. Un número medido a mano **caduca callado**.

#### 🔴 Las pruebas son un GRAFO, no un árbol

La pregunta es si **con el set de pruebas queda todo el contrato encadenado o hay nodos colgando**. Cada test declara **qué nodos cubre**; se agrega uno solo para un **nodo colgando**; **no se prueba en una prueba la base de las demás**; **dos pruebas con intent distinto que hacen lo mismo son una** (se saca la redundante, no se fusionan). La tabla completa y el caso `itd-t-shared`: [references/tests-detail.md](references/tests-detail.md).

### 5 · Recién ahí, el código

Y con la disciplina que hace no-decorativos a los tests:

- 🔴 **Rojo antes que verde.** Un test que nunca se vio fallar no prueba nada. Verlo rojo primero es
  la única evidencia de que mide algo.
- **Detector regalado**: si el test pasa a la primera SIN haber escrito el código, **el test está
  malo**. Sin excepciones.
- **Un cambio, una corrida.** Meter cuatro cambios y correr al final deja sin saber cuál rompió qué.
- 🔴 **Un wrapper sobre algo que se está construyendo AHORA es PLR instantánea, sin mirar por qué.** Vale para
  implementación nueva y para refactor con cobertura completa por igual: si me pillo, o pillo al cajarito, poniendo un
  wrapper, un adaptador, un literal que copia getters, una marca (`Object.defineProperty`) o un `{...obj, metodo:
  otro}` sobre una pieza NUESTRA de esta misma pega, está 100 % malo. No se evalúa si "queda bueno": se devuelve
  al tiro, como una tilde que falta en una tesis. Sin una justificación 100 % correcta y escrita en el TDD, la
  firma se cambia, no se envuelve (rule `firma-nuestra-no-se-envuelve`).
- 🔴 **Hay pasada de verificación de CÓDIGO, no solo de tests.** El "listo" exige leer el código contra el contrato
  (firmas, capas, qué pisa a qué), aparte de la suite verde. Los casos que lo destaparon: [references/cases-and-quotes.md](references/cases-and-quotes.md).
- **La rebanada probada termina en COMMIT, y el bump se decide contra el registry.** Verde no es
  "listo": listo es commiteado (rule `commit-al-cerrar`, con `itdfw-deps.sh files` si tocó un
  publicable) y con la versión decidida por `drift`, no por el diff anterior (rule `bump-al-arreglar`).
  El criterio vive en esas rules; acá solo el puntero.

### 6 · 🔴 OPERANDO — el término real, que no es "está probado"

Un TDD que cierra en verde deja la cosa en el limbo (jcmunoz, 2026-09-15: *"nuestro flujo termina con las pruebas,
no tiene término real"*; la evidencia: [references/cases-and-quotes.md](references/cases-and-quotes.md)).

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
en qué rebanada se usa; lo que no está en la 1 va a una lista de UNA línea, sin diseñar. El caso canónico: [references/cases-and-quotes.md](references/cases-and-quotes.md).

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

El fallo más caro es un test **de algo que no debería pasar nunca**: cuesta código, mantenimiento, y blinda una conducta equivocada. Antes de escribir un caso: **1. ¿Quién pediría esto y por qué?** (sin nombre y motivo, el caso no existe). **2. ¿Qué gana el usuario si esto ocurre?** ("nada" o "queda peor" es un desatino, no una funcionalidad). 🔴 Las dos preguntas aplican también a los huecos que UNO propone: proponer un hueco sin filtrarlo es el mismo error que escribir el test de más. El caso real (2026-08-06) y la auditoría que lo ilustra: [references/scenarios-that-dont-exist.md](references/scenarios-that-dont-exist.md).

## 🔴 Checklist de conformidad — para quien RECIBE un TDD (cajaritos incluidos)

Antes de escribir una línea, quien implementa **audita el TDD** contra esta lista. Si falta algo, **NO codea**:
termina el turno con un reporte "TDD INCOMPLETO: falta X, Y" y para. Que el esclavo nos mande la PLR **antes**
de gastar un token en código es el objetivo, no un fallo (jcmunoz 2026-09-08).

| # | Debe traer | Si falta |
|---|---|---|
| 1 | Cabecera con estado **APROBADO por jcmunoz + fecha** y el **MODO** (nuevo / refactor con cobertura completa / incremental; o la enmienda con su modo). 🔴 Si el TDD **trae o modifica front de cliente final**: además la **alternativa elegida** (una línea) y el **enlace al estudio** de `producto-antes-del-tdd` (para una pantalla suelta, el estudio corto va en la sección UI/UX y la cabecera lo nombra) | sin aprobación no hay código, aunque el TDD esté perfecto; sin modo, "TDD INCOMPLETO: falta el modo", porque cambia cómo se trata cada línea (§0b); sin la alternativa elegida y su estudio en un TDD de front de cliente, el cajarito se detiene y lo devuelve al PMO |
| 2 | Narrativa en lenguaje de dominio | pedir la narrativa; no deducirla del código vecino |
| 3 | Scopes (actor, concurrencia, quién mira, vida, red) | reportar; sin scope las pruebas se inventan |
| 4 | **Modelo**: alcance escrito de cada entidad (qué es, por qué existe, quién la crea, cuánto vive), tabla de campos, tabla de puntas, mermaid de relaciones | 🔴 reportar; JAMÁS inventar campos, modelos ni puntas |
| 4a | **AST de diseño de cada componente y punta** (§2b'): props con significado, cadena de capas y qué método pisa cada una, quién declara el render, lo que NO hace; punta con params, respuesta exacta y errores | 🔴 reportar "TDD INCOMPLETO: componente/punta sin AST"; un implementador que decide el árbol por su cuenta deja al dueño leyendo código |
| 4b | **Coherencia del modelo**: el implementador VALIDA que el motivo de cada modelo hace sentido con la narrativa, los ejecutores y las pruebas (todo modelo aparece en algún flujo; todo flujo toca modelos declarados) | reportar la incoherencia como parte del "TDD INCOMPLETO", con el modelo y el flujo que no cuadran |
| 4c | **Cada punta declara su acceso y el POR QUÉ** (columna de la tabla de Puntas): función asignable, anónima con su porqué, o scope. El criterio NO está acá: se juzga con `itdfw-api-system` cargado | reportar como "TDD INCOMPLETO" una punta sin acceso declarado, o abierta sin motivo escrito. 🔴 Una capacidad amarrada a un tipo de usuario ("solo el dueño X puede"), en el contrato o dentro de la punta, es hallazgo: el CTO lo devuelve. El TDD declara la función y, a lo más, su perfil por omisión. También es hallazgo una punta cuya respuesta se ramifica según quién llama: se parte en puntas propias. Si el skill del área no se cargó, cargarlo antes de juzgar |
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
ilegible y caduca cada media hora** (el caso de `translate`: [references/cases-and-quotes.md](references/cases-and-quotes.md)).

| Archivo | Qué lleva | Quién lo lee | Cuándo cambia |
|---|---|---|---|
| **`TDD.md`** | **solo el contrato**: narrativa corta, scope, modelo y AST **sin historia**, ejecutores, pruebas con estado en UNA palabra (✅ ⬜ ⛔), huecos, decisiones en una línea cada una, rebanada, puesta en operación | jcmunoz, para aprobar; el implementador, para conformidad | solo cuando cambia el contrato. Objetivo ≤ 300 líneas |
| **`TDD-bitacora.md`** | el porqué fechado de cada decisión, las citas, lo que se descartó y por qué | quien necesite entender un porqué | se **agrega** al final; nunca se reescribe hacia atrás |
| **`TDD-corridas.md`** | una fila por corrida: fecha · qué · rojo primero · verde · números | quien dude de si algo se probó y cuándo | se agrega una fila por corrida |
| **`TDD-pendientes.md`** | las rebanadas declaradas y **no tomadas**: una por bloque, con qué y por qué, sin diseño fino; y 🔴 **un TDD en borrador que espera aprobación** (un TDD sin pendientes no aparece en ninguna búsqueda: es lo mismo que dejarlo en `ideas/`) | quien busque trabajo pendiente: **existir el archivo ES la señal** (`find -name "TDD*pendientes.md"`), sin leer contratos | cuando un cajarito toma una rebanada, **sale de acá y entra al contrato**; si queda vacío, se borra. 🔴 Un fix también se escribe acá o se fusiona al TDD: nada queda sin documentar |

🔴 **El contrato no carga pendientes** (jcmunoz 5-oct-2026): si las rebanadas futuras viven dentro del `TDD.md`, saber
qué falta exige leer cada TDD completo, y saber cuáles TDD tienen algo exige leerlos todos.

**Por qué no es cosmética: el caché de lectura.** Cada lector carga el TDD en su contexto; si un cajarito anota un
resultado **dentro** del contrato, invalida la lectura de todos los demás. Con los tres archivos, una corrida toca solo
`TDD-corridas.md`. **La revisión se hace desde el primero.**

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

La tabla de señales de que te estás saliendo del método (tests después del código, vocabulario de tu implementación,
verde a la primera, "por si acaso", varios cambios en una corrida, wrappers sobre lo propio, "listo" sin leer el código,
una norma de memoria, "se muda tal cual" sin probar, front con gramática de back, componente sin XLS ni PDF):
[references/red-flags.md](references/red-flags.md).

## Plantilla del `TDD.md`

La plantilla (cabecera con regla de escalamiento, modo y destino; Rebanada 1; scope; requisitos y qué NO vamos a construir; Modelo con Entidades, Puntas, Componentes y Relaciones; Diferencial y defectos heredados; UI/UX; Ejecutores; Nivel 0..3; Huecos; Decisiones; Puesta en operación) vive en [references/template.md](references/template.md). Cópiala y llénala en ese orden.

