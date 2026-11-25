# Por qué un modelo de BD se comporta así — razones y casos

> El contrato corto vive en `SKILL.md`. Aquí están el porqué de cada regla y los casos que las destaparon.

## Por qué el error no viaja en la respuesta del save

No hay un pipe lineal "guardo → compilo → te contesto": la compilación es derivada y distribuida. El save emite por
PubSub a todos los workers, cada uno compila por su cuenta, y un throw durante la compilación ocurre en otro contexto,
fuera de la transacción del save, así que no hace rollback. Por eso existen `status` y `compileError` en el propio
documento.

## El clon que no se enteró (dependencias entre modelos de BD)

El `post("save")` emite por PubSub **solo por el documento que se guardó**; nadie avisa a quien lo clonó, y el
dependiente sigue con el clon de la versión ANTERIOR en la memoria de cada worker.

Caso: se quitó una option del modelo base y el clon **siguió teniendo la option**, con `status: "OK"` y sin error en
ninguna parte. El `code` en la BD ya decía una cosa y el modelo compilado otra. De ahí las dos reglas: re-guardar los
dependientes, y verificar contra el worker (`modelFields`), no contra el `code`.

## Por qué el acceso anónimo no se refresca en caliente

La lista de funciones anónimas está memoizada en cada worker y se invalida por un canal de PubSub distinto al que usa
la recompilación de modelos. Síntoma: cambias a `isAnonymous: true`, el documento dice `status: "OK"`, `listModels` lo
muestra anónimo… y sigue pidiendo permisos. El modelo no está roto.

## Por qué los modelos no se borran

Es no prometer algo que no se puede cumplir. Borrar un modelo "bien" exigiría desregistrarlo de todos los workers, sacar
sus puntas del `pool.API`, limpiar perfiles y verificar que nadie lo referencie, y con `refPath` (referencia
polimórfica: el modelo destino vive en un campo de cada documento) **saber quién apunta a quién es inviable**. Una
solución a medias declarada como firme sería peor que no tenerla: el día que confíes en que el borrado limpia, no
limpia. Un modelo que salió mal se queda como basura visual con su `status: FAILED`; es el costo aceptado.

## Por qué el 404 de una función con `.json` engaña

`APP/AAA/<Modelo>.<func>.json` responde **404 `endpoint not found`**, indistinguible de "el modelo no existe", e invita
a parchar un modelo sano. Se verificó contra un modelo recién creado y contra uno viejo y sano: los dos dan 404 con
`.json`, y sin él el mismo llamado responde 401 (o el dato).
