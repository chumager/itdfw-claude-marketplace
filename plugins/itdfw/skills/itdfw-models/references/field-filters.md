# Campos en el filtro: familia `filterXXX`, `onlyRef` y multiselección

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y las mediciones.

**Familia `filterXXX` — overrides del campo SOLO en contexto filtro** (el FW construye el form de
filtro derivándolo del de edición; estos atributos lo especializan sin tocar create/update):

| Atributo | Qué hace en el filtro |
|---|---|
| `filterType` | pisa el `type` del input (ej. un campo `text` → `"search"`) |
| `filterComponent` | pisa el `component` (ej. un ref pesado → componente liviano) |
| `filterDefault` | valor inicial del filtro (valor o función `(req)=>val`) |
| `filterName` | pisa el `label` solo en el filtro |
| `filterTag` | pisa el `tag` del input |
| `betweenType` | con `filter:"between"`, el operador del rango (`"="`, etc.) |

🔴 **Un `ref` en el filtro se expande al FORM del modelo referenciado (Embedded en un drawer) salvo `onlyRef: true`**,
que lo deja como select typeahead sobre `getRef` (`FrontEnd.js`: `hasRef(input) && !input.onlyRef` → Embedded). Es lo
que usa `creationUser` del plugin `Accounting`, y lo que un modelo declara cuando quiere filtrar por "quién" y no por
los campos del otro modelo. (Gap #46.)

🔴 **La multiselección del filtro se DERIVA, no se declara.** El FW pone `multiple: true` sobre el input
del filtro cuando el campo lo justifica: referencias (`ref`/`myRef` → `ItdSelect` unificado) y arreglos
(un arreglo viaja SIEMPRE con `multiple: true`). El único valor de `filter` que altera la forma del input
es `"between"`.

⟹ Si un campo necesita filtrarse por varios valores y no lo hace solo, el ajuste va por la familia
`filterXXX` (abajo), que opera sobre el input.

A nivel de **options del schema** (2 más, raras): `cacheFilter:true` cachea el form de filtro
(modelos con filtro pesado y estable); `tableFieldsFilter: (req, inputs)=>inputs` post-filtra los
campos de la grilla por request. Todo esto lo consume el static `formFilter`.
