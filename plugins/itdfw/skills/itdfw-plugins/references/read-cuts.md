# Recortes de lectura: `preSearch`, su par en `pre("aggregate")`, `preAggregate` y por qué no `post("find")`

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

- 🔴 **Prefind de ALCANCE (filtrar TODAS las lecturas: soft-delete, tenant, vencidos, `query` del schema) →
  `schema.preSearch(fn)`** (`mongooseDB/preSearch.js`), NUNCA el par `pre(/find/)` + `pre(/^count/)` a
  mano. La lista de qué es una lectura vive UNA vez (`[/find/, /^count/, "distinct"]`); escribirla por plugin deja
  copias a las que les falta `distinct` (en `zones` eso cruza tenants). `aggregate` va aparte
  (su `this` es un Aggregate, `pipeline().unshift`). Los cuatro (`delete`, `expire`, `zones`, `queryFilter`) ya lo usan; regresión en las pruebas `presearch*` de back.
- 🔴 **Todo recorte de `find` (`preSearch`) TIENE su par en `pre("aggregate")`**: un plugin que
  recorta lecturas y no recorta el aggregate deja ese camino abierto: el `$search` elige ids con `$limit` sin ese
  recorte y el `find` final (que sí lo tiene) devuelve vacío o incompleto, o un aggregate de reporte muestra lo que el
  `find` esconde. El hook va al inicio del pipeline (`unshift({$match: …})`) sin pensar en etapas primeras: el plugin
  global del core **`preAggregate`** (`mongoosePlugins/preAggregate.js`, `pos: "$"`, corre último) pone primera TODA
  etapa que Mongo exige primera (`FIRST_STAGES`, medida en mongod 9.0.2: `$search`, `$searchMeta`, `$vectorSearch`,
  `$rankFusion`, `$scoreFusion`, `$geoNear`, `$changeStream`, `$collStats`, `$indexStats`, `$planCacheStats`,
  `$listSearchIndexes`, y el `$match` con `$text`). **La posición separa lo de los plugins de lo del dev**: nadie
  puede escribir antes de una etapa primera, así que lo que está antes son los recortes y lo que está después es del
  dev. Tres casos: `EXCLUSIVE` (devuelven metadatos o eventos: `$searchMeta`, `$collStats`, `$indexStats`,
  `$planCacheStats`, `$listSearchIndexes`, `$changeStream`) → los recortes se **descartan** (su `$match` filtraría la
  salida) y la cola del dev queda; `$geoNear` y el `$match` con `$text` → los recortes se **funden** dentro
  (`$geoNear.query`, el `$and` del `$match`; con índices parciales sobre `active`, sin el filtro adentro `$geoNear` no
  encuentra índice); el resto (`$search`, `$vectorSearch`, `$rankFusion`…) → la etapa sube y los recortes quedan
  detrás. 🔴 **Contrato estricto**: un RECORTE entra con `unshift`; lo que un plugin agregue con `push` cae en la cola
  del dev y debe ser inocuo sobre metadatos (un `$unset` sí, un `$match` no). Los cuatro (`zones`, `queryFilter`,
  `delete`, `expire`) cumplen el par; regresión en la prueba de back `aggregateCuts` (D1-D4, E1). Un aggregate que
  lea `req` en un hook necesita `aggregate.localData = {req}` (así lo hace `ITDSearch`).
  **Todos los `pre("aggregate")` del core** (los `mongoosePlugins/` del core): `allowDiskUse` (solo la opción, no
  toca el pipeline), los cuatro recortes (`zones`, `queryFilter` —async, lee el `req` de `localData`—, `delete`,
  `expire`) y `preAggregate` al final. Corren en el orden en que se aplican los plugins; entre los recortes el orden da
  lo mismo (cada uno antepone un `$match` y el resultado es su AND), lo único que importa es que `preAggregate` corra
  último, y eso lo asegura su `pos: "$"`.
- 🔴 **Un plugin NO cuelga un `post("find")`**: lo que corre después de leer asume qué campos
  trajo la consulta, y el que consulta decide eso: `formOptions` trae solo el campo del nombre (`select`), un reporte
  trae otros, un `aggregate` no pasa por ahí. Un `post("find")` que completa, renombra o agrega datos a los documentos
  falla en silencio con la primera proyección, y además corre sobre TODA lectura del modelo. Lo que un plugin agrega
  a una salida se engancha en quien la produce, envolviéndola por la salida (ejemplo: `zones` envuelve `formOptions` y
  agrega la zona con una sola consulta sobre los `value`; ver el TDD de zones-refs). Los recortes de lectura
  van antes (`preSearch` + su par en `pre("aggregate")`), nunca después. Al proyectar un `aggregate` y rehidratar,
  la proyección nombra `_id: 1`: `Model.hydrate(doc, {campo: 1})` deja `_id` en `undefined` (mongoose 9.11), aunque Mongo sí lo haya devuelto.
