# Front is a Pure Receiver — Back is the Shape SSoT

El front NO transforma el **shape de data** que llega del back: `component`, `type`, `subComponent`, `subInput`, `filter`, `inputs`, `fields`. El back (`formFilter`, `toInput`, plugins) es la SSoT y entrega "papa molida" — el front renderiza lo que llega.

## Anti-pattern

Si te encuentras escribiendo `if (input.filter === "X") input.component = "Y"` en el front (ItdGrid, ItdFilter, GIW, donde sea) — **STOP**. Eso pertenece a `back/itdfw/src/SITE/mongoosePlugins/FrontEnd.js:formFilter`.

Mezclar concerns = múltiples puntos de control para la misma transformación, garantías framework-agnostic rotas (NUI vs BV divergen silencioso), bugs que se ocultan entre sí.

## Lo que SÍ es responsabilidad del front

NO shape de data, sí:
- Tag/class mapping a la UI lib (ej: `inputTag: "BFormInput"` vs `"n-input"`) — override en cada front's `data()`.
- Render DOM, event wiring, lifecycle integration con la UI lib.
- Engineering interno del componente: un componente PUEDE construir inputs derivados desde su `localInput` (ej: ItdBetween construye operator-pair inputs), siempre que el shape de esos inputs derivados esté acordado con el back via dedicated keys (`subComponent`, `subInput`) — NUNCA por reverse-engineering del `component` del padre.

## Contexto histórico

En un momento cada front tenía su propio plugin del back (ej: `BootstrapVue.js`) para shipping de data pre-shaped. Eso escaló a one-plugin-per-front maintenance — abandonado. La línea pragmática hoy: data shape estandarizado en `formFilter`/`toInput`; UI engineering por-front. NO blur la línea.

## Excepción — la View layer (Vista) ES el contrato front↔back

Las views (`views/Form.jsx`, `views/View.jsx`, `views/Detail.jsx`) están en el boundary entre back response y component tree. PUEDEN transformar shapes de fields cuando adaptan back data a un componente específico de UI lib (ej: mapear schema `fields` → NDataTable's `columns` shape, o BTable's `fields` shape; armar filter input lists desde form definitions).

La view es el "jamón del sandwich" — conoce el back contract Y las necesidades de la UI lib. Sin esta excepción necesitaríamos one back plugin per front (el approach abandonado de BootstrapVue.js).

**La línea**: components stay dumb (ItdGrid, ItdFilter, GI, GF, ItdBetween, GIW); views adapt.

## Cuando encuentres el anti-pattern

Abre un hallazgo, route fix al back. NO patches en el front "while you're there".
