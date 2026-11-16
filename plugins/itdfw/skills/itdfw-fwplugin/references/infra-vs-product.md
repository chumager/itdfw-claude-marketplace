# Infraestructura vs producto, y la funcionalidad nace en el core — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

### 🔴 Plugin de INFRAESTRUCTURA vs plugin de PRODUCTO: la regla del core vale para el primero

| Plugin | Ejemplos | Front |
|---|---|---|
| **de infraestructura** (lo usa cualquier site, con cualquier front) | translate, address, currency, chat | la regla de abajo: la funcionalidad nace en el core y el front cambia la piel |
| **de producto** (una suite vendible que declara su front) | `restaurant` | se elige el front (NUI) y el render usa sus componentes: primero el **wrapper del FW** si existe (`ItdModal`, `ItdButton`, `Icon`…, revisar con el MCP `inventory`), y el componente pelado de NUI (`n-card`, `n-ellipsis`, `n-tag`…) solo si no hay wrapper; la **lógica de negocio** queda aparte, en un mixin o en una base Vue sin componentes |

En un producto no se arma un render "core" con nativos para pisarlo después en NUI: es una semana de trabajo para
tener un card pelado, y se pierde lo que NUI resuelve (expandir, modal, carrusel, tema). La lógica separada cubre el
caso raro de cambiar de framework (jcmunoz 24-oct-2026: *"si vamos a usar nui hay que usar los providers que nos da
nui, si no, ¿pa qué tenemos nui? ¿pa armar un card pelao?"*).

### 🔴 La funcionalidad nace en el CORE; un front solo le cambia la piel (jcmunoz 5-oct-2026) — plugins de infraestructura

- Lo que un plugin necesita del front (un modal, un switch, un color por estado) lo provee el **core**, aunque sea
  feo: componente y lógica funcionan sin ningún front. Si el core no lo tiene, el plugin lo **declara como
  necesidad** (gap); usar un componente de NUI u otro front en directo es la excepción declarada, no la vía.
- Si NUI aporta algo especial, su versión **hereda** la del core y cambia la piel, no la lógica.
- En un plugin con suite (`vue` + `nui`), la carpeta `nui` **hereda** de la de `vue` (o ambas comparten un mixin): la
  lógica se escribe una vez. Una `nui` que reimplementa la lógica son dos plugins pegados, y es lock-in corrido.
