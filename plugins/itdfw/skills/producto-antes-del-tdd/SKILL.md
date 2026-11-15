---
name: producto-antes-del-tdd
description: Use when a new site is about to be built, or a plugin or project brings screens an end customer will see, and somebody is about to write (or has just been asked to write) its TDD.md — also when a PMO receives a product idea, a partner's PRD or a "build me this site" request, when designer is asked for the UI/UX section of a customer-facing product that has no study behind it, or when deciding whether commercial analysis goes before or after the build.
---

# Producto antes del TDD — quién entra, y cuándo, antes de escribir el contrato

## El problema que esto resuelve

Un TDD de un producto con cara al cliente, escrito sin haber mirado a la competencia ni elegido una forma, fija la
narrativa y el modelo a ciegas. Cuando `designer` llega a la sección UI/UX el contrato ya decidió qué existe: solo puede
pintar lo que otro pensó, y lo que la competencia ya resolvió mejor se descubre con el producto hecho.

**Regla:** si lo que se va a construir lo ve un cliente final, el TDD no es el primer paso.

## ¿Aplica?

| Lo que trae el trabajo | ¿Pasa por este skill? |
|---|---|
| un site nuevo | sí |
| un plugin o proyecto con pantallas de front que ve un cliente final | sí |
| solo pantallas de back office (las genéricas del FW: grilla, form, detalle) | **no**: `designer` define necesidades sobre ellas (algo para la vista o el form) o una vista custom, en la sección UI/UX del TDD |
| una lib, un type, una punta, un fix | no |

Mixto (front de cliente y back office): es un solo TDD; pasa por este skill solo la parte que ve el cliente, y el límite
lo marca el PMO al pedir el estudio.

## Los dos análisis, que no son el mismo

| | Producto de la competencia | Comercial |
|---|---|---|
| Dueño | `designer` | `Comercial` |
| Qué mira | los sitios y apps de la competencia: su UI/UX y su **árbol de capacidades** (qué se puede hacer y por dónde) | a quién se le vende, precios, tamaño y canales |
| Qué NO mira | precios ni mercado | pantallas |
| Entrega | el estudio y las alternativas (abajo) | el análisis comercial del producto |

## Cuándo entra Comercial: depende de dónde parte el producto

| Cómo nace el producto | Comercial entra | Por qué |
|---|---|---|
| idea nueva, propia | **antes** de todo | su análisis decide si se hace |
| nace de un acuerdo ya tomado (un socio, un cliente, un PRD ajeno) | **después**: cuando el TDD ya está aprobado, en paralelo a la implementación, para llegar antes de salir a vender | la decisión ya está; el análisis afina cómo se vende y no frena el TDD |

Antes de empezar se dice en una línea cuál de los dos casos es. Si no se sabe, se le pregunta al dueño del producto
(jcmunoz): es quien elige la alternativa y aprueba el TDD.

## Proporción: producto entero o pantalla suelta

| Lo que se hace | Estudio |
|---|---|
| un site o un producto nuevo | completo, como sigue |
| una pantalla nueva de cliente en algo que ya opera | corto, y siempre doble: cómo lo resuelven uno o dos competidores **y** cómo lo resuelve ya el FW con sus piezas genéricas. Va en la sección UI/UX del TDD, sin página aparte |

🔴 **El análisis es doble en los dos casos: la competencia y lo que el FW ya da.** La primera alternativa es siempre la
**barata**: el producto (o la pantalla) hecho con lo que el FW provee hoy, sin diseño propio. Las demás muestran el
estudio extra y lo que cuesta sobre esa base. Así el dueño decide el costo **por etapas**: se parte operando con lo que
el FW da mientras se diseña la versión de vitrina.

🔴 **El estudio completo cabe en un par de horas, no en días.** `designer` lo parte en un árbol de tareas (un
competidor por rama, una alternativa por rama) y las reparte en subagentes en paralelo; él arma y decide. Lo que no se
alcanzó a ver se anota "sin ver" y no frena la entrega.

## El camino

```
[Comercial, si la idea es nueva] → designer: estudio + alternativas → el dueño elige →
PMO escribe el TDD sobre la alternativa elegida → camino normal del TDD (skill `tdd-narrativo`) →
[Comercial, si nació de un acuerdo]
```

## Lo que entrega designer

Una página para decidir (no un `.md` árido), con estas partes, en este orden:

1. **Contra quién**: de tres a cinco productos con los que el cliente final nos va a comparar (los que usa hoy para lo
   mismo), con su enlace y capturas del recorrido principal tomadas el día del estudio.
2. **Por cada uno**: su árbol de capacidades, y sus virtudes y defectos **de UI/UX y de capacidades** (no comerciales).
   Cada virtud o defecto apunta a una captura.
3. **Lo que agregamos nosotros**: qué hacemos que ellos no, o qué hacemos distinto y por qué.
4. **Dos o tres alternativas** para el producto propio, la primera siempre la barata (solo lo que el FW ya da): cada
   una con su recorrido principal, su árbol de capacidades y lo que cuesta sobre la anterior (qué piezas del FW usa y
   qué habría que construir), para poder implementarlas por etapas.
5. **La recomendación**, con su porqué en una línea.

- **Sin competidor directo**: se estudia lo que el cliente usa hoy para lo mismo (una planilla, WhatsApp, un cuaderno).
- **La página la publica `designer`.** Si el dueño rechaza las alternativas o pide una mezcla, `designer` rehace una
  vez con esa indicación.

Lo que no se pudo ver (un flujo tras un login, un precio que cambia el recorrido) se escribe como "sin ver". Lo que un
navegador soporta se coteja en caniuse o MDN, nunca de memoria.

## 🔴 Skills externos VINCULADOS a cada paso

Cada paso de este camino carga su skill con el Skill tool **antes de producir su entrega**, sin esperar a que el dueño
lo pida. Hacer el paso "de memoria", sin su skill, es no haber hecho el paso. Si un skill no está instalado, se dice en
la entrega cuál faltó y esa parte se hace a mano.

**Análisis comercial (`Comercial`)** — todos se cargan:

| Parte del análisis | Skill |
|---|---|
| la competencia como negocio: oferta, precios, cómo se le gana | `sales:competitive-intelligence` |
| quién es cada competidor o socio (empresa, noticias, encaje) | `sales:account-research` |
| a quién se le vende primero: lista de prospectos con un motivo cada uno | `small-business:lead-finder` |
| cómo aparece el producto en buscadores y en respuestas de IA | `small-business:seo-ai-visibility` |
| plan de contenidos y canales | `small-business:content-strategy` |

Al salir a vender (después del análisis): `small-business:grow-pipeline` para el contacto a los prospectos y
`sales:create-an-asset` para la pieza que se les muestra.

**Estudio del producto de la competencia (`designer`)** — todos se cargan:

| Parte del estudio | Skill |
|---|---|
| el árbol de capacidades y los recorridos, dibujados | `diagram-design` |
| la dirección visual de cada alternativa | `frontend-design:frontend-design` |
| que cada alternativa calce con el sistema de diseño propio | `design-system` |
| qué permite hoy la plataforma web, antes de prometer una capacidad | `modern-web-guidance:modern-web-guidance` |
| la página para decidir | `artifact-design` |

La entrega de cada uno termina con la lista de skills que cargó. Lo que sale de un skill externo es materia prima: los
datos de mercado llevan su fecha y su fuente, y nada de eso entra al TDD sin pasar por la elección del dueño.

## Lo que recibe el PMO, y lo que hace con eso

- Escribe el TDD **sobre la alternativa elegida**. La narrativa y la rebanada 1 la nombran; el estudio queda enlazado
  desde la cabecera del TDD, no copiado.
- Lo que la alternativa pide y el FW no tiene se lleva como necesidad a quien corresponda, antes de fijarlo en el modelo.
- La sección UI/UX de detalle la sigue escribiendo `designer` dentro del camino normal: el estudio decide la forma, la
  sección la aterriza pantalla por pantalla.

## Red flags — PARA

- Un TDD de un site o de pantallas de cliente sin estudio enlazado, o con "designer verá la UI después".
- `designer` recibiendo un TDD de producto ya escrito para "agregarle la UI/UX".
- Un estudio que compara precios, o un análisis comercial que opina de pantallas.
- Una sola alternativa presentada como si fuera la única.
- "Es un acuerdo ya tomado, no hace falta estudio": el acuerdo mueve a Comercial al final, no elimina el estudio de
  `designer`.
- Un estudio de competencia para una grilla de back office.
- Un análisis comercial o un estudio entregado sin la lista de skills cargados, o esperando que el dueño pida "usa el
  skill de ventas".

## Qué deja escrito cada uno

| Quién | Dónde |
|---|---|
| `designer` | el estudio, en la carpeta de documentos del proyecto; la página para decidir, publicada para el dueño |
| el dueño | la alternativa elegida, en una línea, en la cabecera del TDD |
| `Comercial` | su análisis, en la carpeta de documentos del proyecto |
| PMO | el TDD (skill `tdd-narrativo`) |
