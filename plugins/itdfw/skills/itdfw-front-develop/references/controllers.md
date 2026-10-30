# Controllers — comportamiento especial SIN componentes custom

## El espíritu

**Los forms y GIs NO manejan externalidades**: no saben de condiciones que escapan a su estructura
natural — un form es un form y punto. ¿Necesitas algo especial (cross-field, deshabilitar según
valor, traer un valor de una punta, cambiar el componente del value)? → **le metes un controller**.
Eso da libertad total pa manejar flujos SIN implementar componentes custom ni formularios especiales.

## controller vs generalController — el criterio es QUÉ ALTERA

| | `controller` | `generalController` |
|---|---|---|
| **Qué hace** | Cambia **valores y propiedades de inputs** (casi cualquier cosa) | **Modifica el FORM en sí**: cambio de componentes, agregar/sacar inputs |
| **Por qué la separación** | Un GI puede resolverlo | Un GI NO puede — lo tiene que hacer el FORM |
| **Caso canon** | `disableFields`, `setDisabled`, `changeOptions`, `calc` | `configValue` (config cambia el COMPONENTE del value según el name elegido) |

Hasta ahora el ÚNICO generalController necesario ha sido el de config — si dudas, es `controller`.

## Ubicación de la declaración = ALCANCE y TRAZA

Corren **bindeados a `this`** (la instancia GI/GF), así que funcionarían declarados en cualquier
input — pero **se declara en el input INICIADOR (o el afectado) pa no perder la traza del origen**:
si el controller cambia preferentemente un componente, se lo pones a ÉL; si un input dispara el
comportamiento, va en ese. La ubicación comunica quién manda.

## Cuándo corren y qué pueden hacer

Corren en **`created`** → pueden hacer **prácticamente cualquier cosa** del componente/form
(propiedades, valores, estructura — posiblemente hasta renders). Esa es la diferencia clave con el
sistema anterior.

**Historia (por qué son funciones y no directivas)**: antes eran controllers vía DIRECTIVAS Vue —
enormemente complejo: race conditions permanentes (definir cosas en el `bind` pa usarlas en el
`update`), sin encapsulamiento por el bind → side effects, una locura. El cambio a **funciones
directas bindeadas al `this` del componente** mató todo eso.

## Mecánica

- **Declaración (back)**: `controller: "<nombre>"` en el campo (o `generalController: "<nombre>"`).
  String → archivo bajo `controllers/` (cascada localImport); función inline solo pa tests/demos.
- **Firma**: `function miController(inputName)` — `this` = la instancia (GI o GF), `inputName` = el
  input donde se declaró. Opera vía `formBus.getInput/setInput`.
- Las OPTIONS del controller van como atributos hermanos en el mismo campo (ej.
  `disableFields: ["a","b"]`). 🔴 Diseñar las options pensando que también pueden declararse a nivel
  de TYPE — un type NO conoce el form donde vivirá, así que una lista de inputs hermanos a nivel
  type es basura contextual: la firma sobre-sí-mismo es la type-safe.

## Catálogo (core `controllers/`)

| Controller | Qué hace |
|---|---|
| `disableFields` | Disabled SOLO de UI — el valor round-trippea intacto. Sin options → a sí mismo; `disableFields: [...]` → otros campos. 🔴 Caso canon del PORQUÉ existe: `disabled` de SCHEMA es contrato de DATO (setData lo bota — Profile.functions.path perdió los 93 paths, 2026-07-06). Ver skill `itdfw-models` → conventions.md. |
| `changeOptions` | Overlay por VALOR de este input sobre otros campos (hidden/required/options...) — cache+overlay, revalida post-inputUpdate |
| `setDisabled` | Azúcar sobre changeOptions: `{CLP: ["porcentaje"]}` → disabled condicionado por valor |
| `calc` | Valores calculados cross-field |
| `configValue` | (generalController) el value de Config cambia de COMPONENTE según la definición del name elegido |
| `getEndpointValue` | Trae el valor desde una punta |

## Red flags

- Implementar un componente custom pa un comportamiento condicional → probablemente era un controller.
- `disabled: true` en el SCHEMA pa "que no lo editen en el form" → si el valor debe round-trippear
  (identidades en docArrays), eso PIERDE DATA al guardar — usa `disableFields`.
- Options de controller con nombres de inputs hermanos declaradas en un TYPE → contextual/frágil.
