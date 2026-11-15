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
| nace de un acuerdo ya tomado (un socio, un cliente, un PRD ajeno) | **después**: no condiciona la decisión de construir ni frena el TDD | la decisión ya está; el análisis afina cómo se vende |

Antes de empezar se dice en una línea cuál de los dos casos es. Si no se sabe, se le pregunta al dueño del producto:
quien aprueba su TDD.

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
4. **Dos o tres alternativas** para el producto propio: cada una con su recorrido principal, su árbol de capacidades y
   lo que cuesta (qué piezas del FW usa y qué habría que construir).
5. **La recomendación**, con su porqué en una línea.

Lo que no se pudo ver (un flujo tras un login, un precio que cambia el recorrido) se escribe como "sin ver". Lo que un
navegador soporta se coteja en caniuse o MDN, nunca de memoria.

## Skills externos que se usan aquí — a pedido

No se cargan por reflejo: cada uno se invoca cuando el dueño del producto pide esa pieza, o cuando el paso la necesita
y se le avisa antes. Si el skill no está instalado, se dice y se hace a mano.

| Para qué | Quién | Skill |
|---|---|---|
| la ficha comercial de un competidor nombrado (oferta, precios, cómo se le gana); no reemplaza el estudio de pantallas de `designer` | `Comercial` | `sales:competitive-intelligence` |
| investigar una empresa o un prospecto concreto | `Comercial` | `sales:account-research` |
| lista de prospectos con un motivo por cada uno | `Comercial` | `small-business:lead-finder` (o `small-business:grow-pipeline` si además se les escribe) |
| cómo aparece el producto en buscadores y en respuestas de IA | `Comercial` | `small-business:seo-ai-visibility` |
| plan de contenidos y canales | `Comercial` | `small-business:content-strategy` |
| una pieza para mostrarle a un prospecto (página, una hoja) | `Comercial` | `sales:create-an-asset` |
| dibujar el árbol de capacidades o un recorrido | `designer` | `diagram-design` |
| dirección visual de las alternativas | `designer` | `frontend-design:frontend-design` |
| auditar o extender el sistema de diseño propio | `designer` | `design-system` |
| qué permite hoy la plataforma web (antes de prometer una capacidad) | `designer` | `modern-web-guidance:modern-web-guidance` |
| la página para decidir | quien la publica | `artifact-design` |

Lo que sale de un skill externo es materia prima: los datos de mercado llevan su fecha y su fuente, y nada de eso entra
al TDD sin pasar por la elección del dueño.

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

## Qué deja escrito cada uno

| Quién | Dónde |
|---|---|
| `designer` | el estudio, en la carpeta de documentos del proyecto; la página para decidir, publicada para el dueño |
| el dueño | la alternativa elegida, en una línea, en la cabecera del TDD |
| `Comercial` | su análisis, en la carpeta de documentos del proyecto |
| PMO | el TDD (skill `tdd-narrativo`) |
