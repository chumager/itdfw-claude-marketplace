# Catálogo de OPTIONS del modelo (`new db.Schema(campos, OPTIONS)`)

## Cómo leer este catálogo — el namespace es ABIERTO

Las options son EL canal de configuración del modelo, y hay dos clases:
- **Estrictas del core**: contrato fijo, las lee el FW mismo (identidad, CRUD, AAA).
- **Libres (ofertas de plugins)**: el plugin es una OFERTA de funcionalidad, no una inyección — está
  globalmente presente pero DORMIDO, y lo primero que hace es preguntar "¿me pediste?" leyendo SU
  option. **El modelo PIDE declarando la option** (pull): declarar `Bitacora: {...}` es el acto de
  enchufe Y la configuración en un solo gesto. Por eso este catálogo nunca estará "completo": cada
  plugin nuevo trae su llave nueva. Para descubrir la llave de una oferta: la documentación del
  plugin (o el MCP).

## 1. Identidad (MUST — va SÍ O SÍ en todo modelo)

🔴 **Lo que VE el usuario vs lo que usa el FW**: el AAA transfiere del schema a la RUTA del modelo
exactamente `[description, name, title, inNav, hidden, defaultMethods, isAnonymous, auth,
hasFiles]` → **`name`, `title` y `description` son lo que el MENÚ y el administrador muestran**. Sin
`title`/`description` el operador ve una entrada muda: no sabe qué modelo es ni para qué sirve.
`modelName` NO viaja: es identidad INTERNA (colección, selectores de modelo) y
**no reemplaza** a los otros — es incluso menos importante de cara al usuario.

| Option | Qué es | ¿viaja al front? |
|---|---|---|
| `name` | Título del ADMINISTRADOR del modelo ("Vehicle Administration") | ✔ |
| `title` | Título corto de la entrada (lo que se lee en el menú) | ✔ |
| `description` | Descripción / ayuda contextual (UI admin, menú) | ✔ |
| `inNav` | Si aparece en la navegación | ✔ |
| `icon` | Ícono de menú/admin | (vía ruta/menú) |
| `modelName` | Nombre plural / colección ("Vehicles") — identidad INTERNA | ✘ |

## 2. CRUD (obligatorio + switches NEGATIVOS)

| Option | Qué es |
|---|---|
| `defaultMethods` | `["GET","POST","PUT","DELETE"]` — qué verbos existen |
| `noCRUD` / `noCreate` / `noUpdate` / `noDelete` | Negaciones ESTRUCTURALES: la operación negada NO EXISTE — ni ruta en el front ni punta de delivery en el back (404, no 401/403). Los checkers siempre responden (avisan al front). El CRUD es lo normal; los `noXXX` se declaran solo cuando NO se requiere |
| `noAPI` / `noModel` / `noLink` / `noPagination` / `noPos` / `noResave` / `noUniqueValidator` | Más switches negativos de capacidades estándar |
| `edit` / `delete` / `selection` | Config/override de los VIRTUALES de fila `_update`/`_delete`/`_selectable` (ver §6) |

## 3. AAA (Authentication, Authorization, **Auditing**)

| Option | Qué es |
|---|---|
| `isAnonymous` | `boolean \| función \| "auth"` — la punta CRUD del modelo es anónima. El FW transfiere a la ruta del modelo: `[description, name, inNav, hidden, defaultMethods, isAnonymous, auth, hasFiles]` |
| `API` | Puntas propias del modelo con permisos propios (skill `itdfw-api-system` nivel 3) |
| `GET/POST/PUT/DELETE` | Handlers por verbo sobre el CRUD del modelo (skill `itdfw-api-system` nivel 2) |
| `auth` / `canAuth` | **DERIVADA de los fields**: si un field declara el atributo `auth` (ej. `auth: "password"`), el FW marca el modelo como autenticable. No se declara a mano |
| `hasFiles` | El modelo recibe archivos (multer) |
| **Auditoría** (la 3ª A, core) | `hideCreation*`/`hideUpdate*` y las variantes `creationUser/updateDate/...Options/Hidden/Filter` — config fina de los campos de auditoría automáticos (creationUser/Date, updateUser/Date) |

## 4. Ofertas de plugins del core (existen DECLARATIVAMENTE — siempre disponibles)

| Option (la llave) | La oferta |
|---|---|
| `registrable` | Registro público anónimo vía `/APP/register` |
| `Bitacora` | Historial de hechos embebido (`{hasClosed, hasFile, hasEvents, fields...}`) |
| `caducate` | Expiración (path `expire`) — `false` la APAGA (el pull también rechaza ofertas con default activo) |
| `deleteMode` | `"soft"` (default) / `"hard"` / `"none"` — y acopla la semántica del unique (parcial entre activos) |
| `zone` | Multitenancy (path `_zone`, inyección en find/count/aggregate) |
| `notificable` | Notificaciones del modelo |
| `currency` / `currencyConversion` | Manejo de moneda |
| `history` | Timeline forense del documento (`__history`) |
| `weakEntity` | 🔴 Option del **SUB-schema** (el de un docArray), no del padre: `new db.Schema({...}, {weakEntity: {modelName, parentModel, schemaOptions, projection, parentOptions}})` → nace un **modelo-vista** sobre `padre.<docArray>` con grilla/AAA/puntas propias; `POST`/`PUT` pasan por el `save()` del padre (corren sus hooks). Lo aplica el global `weakEntities.js` sobre cualquier sub-schema, **incluidos los que crea otro plugin**: la bitácora lo expone vía `Bitacora: {set: {weakEntity: {...}}}` (probado 2026-08-25: `MemberReview` sobre `members.bitacora`). Recién creado hay que asignarlo a un perfil (401 si no). Patrón `parentOptions: {attrAsFunction: ["filter"], filter: req => req?.model !== "Member"}` para que el socio no filtre por su propio padre |

## 5. Flujo / data (particularidades del FW vs nativas Mongoose)

| Option | Qué es |
|---|---|
| `query` | `objeto \| función` — PREFILTRO de las consultas del modelo |
| `internal` | `boolean`, por omisión `true`: el modelo solo lo leen por `getRef`/`getSimpleName` los autenticados de `User`. `false` lo abre a los autenticados de cualquier modelo autenticable (un `Member`, un `Owner`). Solo afecta a esas dos puntas |
| `aggregate` | Snapshot de aggregate — para modelos de vista/consulta directa |
| `postData` | Infra para ejecutar lógica DESPUÉS de declarado el modelo |
| `userData` | SOLO autenticables: campos que viajan en la sesión al front |
| `tableForm` / `tableSpecs` / `tableFieldsFilter` | Config de las puntas de grilla (tableForm se enchufa post-grilla y opera sobre la selección — ver `_selectable`) |
| `formSpecs` | `objeto \| función` — specs del form |
| `sort` / `cacheFilter` / `uploadNew` / `view` | Ajustes de operación de grilla/vista |
| **Nativas Mongoose** (passthrough) | `toJSON` / `toObject` / `autoIndex` — el FW setea defaults sanos si no las declaras |

## 6. Transitivos de operación — NO son API del modelador

Conceptos que el dev NO setea como feature; son **helpers entre plugins** (cableado):
- **Jerarquía**: `isRoot` / `isChild` / `hasChildren` / `childrenPaths` / `isSubModel` / `weakEntity`
  — nativas pero DERIVATIVAS: existen para que otros plugins razonen (ej.: un hijo no debería tener
  update/delete propios; los virtuales de fila son root-only).
- **Patrón oferta+helper**: un plugin puede dividirse en la OFERTA (la funcionalidad: `currency`) y
  su HELPER de enchufe (`hasCurrency`) — misma cosa partida en dos para separar la lógica de negocio
  del mecanismo de acople.
- **Virtuales de fila (root-only)**: `_update`, `_delete`, `_selectable` — los crea el core en todo
  root. `_selectable` es diseño holístico: el getter se DERIVA con lógica de negocio (ej. cuotas:
  no marcable la 2 si la 1 está impaga) → viaja transitivo con la row → la grilla lo usa como
  disabled del checkbox → **el front te detiene de marcar lo que no corresponde** (antes solo el
  back validaba al enviar). `tableForm` opera después sobre lo marcado. Sus options de config:
  `selection` / `edit` / `delete` (§2).
