---
name: itdfw-currency
description: Use when a model needs a money amount (a price, a total, a fee, a balance) or anything priced in a unit of its own (tickets, points, UTM, UF). Covers the plugin currency of ITDFW — the `Currency` type, the document's currency `_currency`, the `ItdCurrency` input, the site's currencies in the Config "Currency" (base, displayed name, alternatives) and own non-ISO currencies with their alias. The key rule — a price does NOT fix its currency; the currency comes from the site's Config — and what the plugin does not do yet (formatted XLS/PDF, conversion with a rate by date or context).
---

# Plugin `currency` — montos con la moneda del site

## Qué da

| Pieza | Qué hace |
|---|---|
| type `Currency` | un monto que se cierra a la precisión de su moneda al castear; se formatea, edita y parsea con el locale de quien mira. Es el mismo objeto de valor en el back y en el front |
| `_currency` en el documento | todo modelo con un campo `Currency` (en la raíz, en un virtual o en un sub-schema, a cualquier profundidad) recibe **una moneda por documento**, sin declarar nada: el plugin detecta el campo y agrega `_currency` |
| `ItdCurrency` | el input, la celda de la grilla y la vista de detalle de un monto, con el símbolo o el alias de su moneda |
| métodos del documento | `toCurrency(valor, locale)` formatea en la moneda del documento; `currencyRound` y `currencyFloor` redondean a su precisión; `longCurrency(valor)` agrega el monto en palabras |

## 🔴 La regla: un precio NO fija su moneda

La moneda de un monto **no se escribe en el código**. Sale de la **Config "Currency" del site**, que edita su dueño, y
cada documento elige una entre las que el site declara:

```js
// un producto, una factura, una reserva: la moneda la decide el site, no el plugin
price: {type: "Currency", name: "Price"}
```

- El documento nace con la moneda **base** del site (`Currency`) y, si el site declara alternativas, se puede elegir
  entre ellas (`_currency`, un radio en el formulario y un filtro en la grilla).
- Las líneas del documento (sub-schemas y arreglos, a cualquier profundidad) **heredan** su moneda, y al cambiarla
  re-cierran sus montos.
- Un documento que es detalle de otro (una línea que apunta a su factura) **hereda la moneda del documento al que
  apunta** con la opción del schema `currency: {from: "<campo ref>"}`; en él la moneda queda deshabilitada.

**Fijar `currency` en el campo** (`{type: "Currency", currency: "USD"}`) **gana sobre la moneda del documento**: ese
monto queda en esa moneda aunque el documento o el site digan otra. Se hace **solo cuando el monto está en esa moneda
por naturaleza**, diga lo que diga el documento: una comisión que siempre se factura en dólares, un precio en tickets.
Un precio que tiene que seguir las monedas del site **no** la fija. Fijar `"CLP"` en un precio porque "el site es
chileno" deja el modelo amarrado a un país y el site ya no puede cambiarla.

## Qué se configura: la Config "Currency"

| Llave | Qué es |
|---|---|
| `Currency` | la moneda **base** del site (código ISO, 3 letras): el valor por omisión de todo documento nuevo |
| `CurrencyMask` | el nombre a mostrar de la base (hasta 16 caracteres): `UF` para `CLF` |
| `Currencies` | las alternativas, `[{from, to, legal}]`: `from` el código (hasta 3 letras, en mayúsculas), `to` el nombre a mostrar (hasta 16 caracteres) y `legal` si es de curso legal |

Lo que se ve en pantalla es el alias (`CurrencyMask` de la base, `to` de cada alternativa), el mismo en el back y en el
front. Sin alias se ve el código o el símbolo que da el locale.

## Decimales

La precisión la da **la moneda**, no el locale: para un código ISO, la de Intl (CLP 0, USD 2, CLF 4); para una moneda
propia, 2. `precision` en el campo la fija y gana sobre la de la moneda (`{type: "Currency", precision: 4}`).

## La UF y las monedas propias

- **La UF es `CLF`** (código ISO de fondo) **con alias `UF`**: `CurrencyMask: "UF"` si `CLF` es la base, o
  `Currencies: [{from: "CLF", to: "UF"}]` si es una alternativa. Conserva los 4 decimales de Intl. No se declara un
  código `UF`.
- **Una moneda propia, fuera de ISO 4217** (el ticket de una feria, la UTM, puntos): se declara como una alternativa
  más, con su alias, y se usa en un campo con la moneda fija y su precisión:

```js
// Config "Currency"
Currencies: [{from: "TKT", to: "tickets"}]
// el campo: el monto está en tickets por naturaleza, así que aquí sí se fija
priceInTickets: {type: "Currency", name: "Price in tickets", currency: "TKT", precision: 0}
```

  Se ve `tickets 2` o `2 tickets`, según dónde ponga el símbolo cada locale: un código que no es ISO toma el patrón del
  locale para "sin moneda" y pone el alias en lugar del símbolo. Sin `precision` en el campo, toma 2.

## Lo que hoy NO hace

| Falta | Qué hacer mientras |
|---|---|
| **XLS y PDF formateados**: el PDF imprime el monto crudo y no hay formato para XLS, en ninguna moneda | es una enmienda pendiente del dueño del plugin; un TDD que dependa de eso lo declara como hueco, no lo implementa por su cuenta |
| **Conversión con un factor que depende de un contexto** (la UF o la UTM de una fecha, el valor del ticket de un evento, un precio del día) | no existe: es un TDD propio por aprobar. No se inventa en un plugin consumidor |

## Lo que este skill no cubre

| Si necesitas… | Ve a |
|---|---|
| escribir un type custom nuevo | `itdfw-mongoose-types` (+ `itdfw-ddd-value-objects` si el valor tiene lógica) |
| registrar la Config de tu propio plugin | `itdfw-deploy-config` (la config de nivel 2) |
| modelar el resto del documento | `itdfw-models` |
| cerrar y probar lo que hiciste | `itdfw-completeness` (un campo `Currency` exige su caso de XLS y de PDF) |
