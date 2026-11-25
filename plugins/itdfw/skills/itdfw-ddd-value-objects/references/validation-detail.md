# Validación de un VO — el detalle

> El contrato corto vive en `SKILL.md`. Aquí están el desplazamiento del flujo en el front, el patrón snapshot y la
> cadena `required`.

## El desplazamiento del flujo en el front

`validateSelf` (front) deja de validar esencia y pasa a ADAPTADOR: si hay VO, corre su `validate()` como un validador
más; si lanza, lo atrapa y devuelve su mensaje como error del ciclo, con `{PATH}` y `{VALUE}` interpolados (dominio →
UI, i18n vía `formatM`). `setValue` nunca valida ni lanza. Se desplaza lo INTRÍNSECO (sync, puro); lo EXTRÍNSECO
queda en su capa (remotas tipo `checkStrength`, cruzadas entre campos, min/max de mongoose). La pichicata `_validate`
(el túnel viejo back→front) muere para los DDD, y esa presión empuja a que todo sea DDD.

## Solo DATOS, nunca indefiniciones

`validate()` nunca rechaza indefiniciones: vacío pasa, TRÁNSITO pasa (el pipeline lo resuelve; el emitter-gate impide
que persista). Para eso está `required`, que el motor da gratis a todo type con `class`. `isEmpty` = "NADA de nada":
datos colgando no son vacío, y esos los juzga `validate` como COHERENCIA (ej. Address: datos huérfanos sin coordenadas
= malo).

## Patrón SNAPSHOT

El singleton VO es MUTABLE por la cadena reactiva del front (campos LAZY: la re-bajada lo pisa mid-ciclo). Un validate
ASYNC o lento que lea `#value` después de un `await` valida OTRO valor: se cazó en e2e un campo prístino que validaba
"OK" con basura adentro, vía un delay de prueba. Regla: primera línea `const value = this.#value` y todo el cuerpo
valida el snapshot; así aguanta validadores foráneos lentos. Verificado con un delay inyectado de 500 ms. Canon:
`Rut.validate()`. Pendiente aparte: dos ciclos de validación solapados (generación).

## `{VALUE}` en los mensajes

Solo si el VSV es ESCALAR (Rut, Currency). En VOs de valor-objeto (Address) el front interpola contra el VSV plano y
sale "[object Object]". El back interpola vía `Symbol.toPrimitive` (mensaje) y `toJSON` (serialización del error).

## La cadena `required`, doble punta espejada

- back: `checkRequired` del SchemaType (el motor);
- front: las variantes `required` de `validators.js`.

Ambas: `vo.checkRequired(...args)` si existe → `!vo.isEmpty` → chequeo nativo/estándar. Todos los args del caller se
pasan (el VO decide si los usa; args asimétricos back/front son problema del dev que los necesite). 🔴 Los
validadores de `validators.js` se SERIALIZAN al front (toString + merge por capas) → cero closures o helpers de
módulo: todo INLINE en cada variante, aunque se repita.
