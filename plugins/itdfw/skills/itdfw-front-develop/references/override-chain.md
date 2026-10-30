# Override / Cadena de herencia

## 🔴 NO romper la CADENA al override — pisar una función heredable rompe a las hojas aguas abajo

Toda función del FW es potencialmente heredable (cadena `GI → GF → componente hoja`, o cualquier `core → front → site`). Si pisás una función con una implementación que NO llama al original, **cortás la cadena**: las hojas que esperaban encadenar su lógica quedan huérfanas — su método existe pero **nadie lo invoca**. Patrón de override correcto (el del FW: noop/default sobrecargables): **sobrecargá el `defaultX`, NO el wrapper `X`**; y si necesitás pisar el wrapper, **llamá al `default` del padre bindeado a tu instancia** (`Parent.methods.x.call(this, ...)`), reprocesá, retorná. Nunca "piso porque yo lo necesito" — eso rompe la cadena y el síntoma aparece **lejos** de la causa (dificilísimo de pesquisar).

**Caso real 2026-06-12→14**: `GF` pisó `emitter` con identidad (`return v`) → cortó el wrapper `emitter = emptyEmit(defaultEmitter)` del GI → los `defaultEmitter` de los GF hijos (`ItdBetween` saca el `type`) quedaron sin ejecutarse → between dejó de limpiar y mandó `{type}` crudo, reventando el filtro. Funcionaba "antes" porque between pisaba `emitter` directo; al migrarlo a `defaultEmitter` (correcto), el `emitter` identidad del GF intermedio lo dejó huérfano. El error NO era de between (estaba bien) — era del eslabón intermedio que rompió la cadena. Fix: el wrapper se hereda, los hijos solo sobrecargan `defaultX`.

Ver también [value-pipeline.md](value-pipeline.md) y la fila de `defaultGetInputProps`/`emitter` en [anti-patterns.md](anti-patterns.md).

## 🔴 Caveat del `Parent.methods.X.call(this)` — presume que el Parent DEFINE X (no lo hereda)

El patrón de arriba SOLO funciona si `Parent` **define `X` propio**. `.methods` es el objeto LITERAL de esa
capa — **NO** incluye los métodos heredados. Si tu `localImport` resuelve a una capa que **hereda** `X` de SU
propio extends, entonces `Parent.methods.X` es **`undefined`** → `.call(this)` revienta.

**Caso real 2026-07-01 (ItdCurrency)**: `const Extends = await localImport("ItdNumber")` resuelve al ItdNumber
de **NUI**, que **extiende** el core y **hereda** `reverseVal` (no lo define) → `Extends.methods.reverseVal` =
`undefined` → reventaba el componente entero, con el error apareciendo lejos de la causa.

🔴 **No lo "arregles" con `Extends.extends.methods.X`** para bajar a la capa que sí lo define — es frágil por:
(a) si **cambian la rama** de herencia, te cagan; (b) si alguien mete **otra capa intermedia** (otro Number
que sobrecarga), tu índice de la cadena se corre; (c) al `.call(this)` **presumís que todos los helpers
intermedios ya operan igual** — y capaz no.

**Qué hacer en su lugar**:
- Necesitás el base y tu componente NO pisa `X` → `this.X(...)` (Vue resuelve por la cadena REAL, respeta overrides).
- Tu componente SÍ pisa `X` y necesitás la lógica base → **implementala** o delegá a la **fuente estable** de
  esa lógica (ej. el VO que ya tiene `parse`) — NO hardcodees el acceso a la cadena de extends.
- Regla: **no abuses de `Extends`/`.methods` salvo que sepas EXACTO qué capa lo define** — y aun así un cambio
  de rama te lo rompe. La lógica debe vivir en un lugar estable (VO, helper), no en un índice de la cadena.
