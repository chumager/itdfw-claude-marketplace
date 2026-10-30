---
name: itdfw-db-models
description: Use when creating or modifying ITDFW data models defined IN THE DATABASE instead of as files — the two flavors (DBModel guided form vs DBModelRaw code), how the name is derived from the code, the event-driven compile flow with status/compileError, why models cannot be deleted, and what stays the developer's responsibility. NOT for models as files (use itdfw-models) nor for custom types (use itdfw-mongoose-types).
---

# ITDFW DB Models — Modelos definidos en la BD

Un modelo del FW normalmente vive en un archivo (`mongooseSchema/<Modelo>.js` — skill **`itdfw-models`**).
Pero también puede vivir **como documento en la base de datos**: se crea desde el admin, el MCP o la API,
y queda operativo **en caliente**, sin desplegar ni reiniciar.

Este skill cubre esa vía. Todo lo demás del modelado —cómo se declara un campo, qué options existen,
cómo se verifica— es idéntico y vive en **`itdfw-models`**; los types de los campos, en
**`itdfw-mongoose-types`**.

## 1. Las DOS vías, y cuál te toca

| | `DBModel` ("Data Models") | `DBModelRaw` ("Coded Data Models") |
|---|---|---|
| **Cómo se define** | formulario guiado: campos, tipos, opciones | **código**, igual que un archivo |
| **Para quién** | usuario SIN conocimiento de mongoose ni del FW | quien sabe modelar |
| **Alcance** | lo que el formulario expone | **todo** lo que puede un modelo de plataforma |
| **Cuándo usarla** | estructura simple, sin lógica | cualquier cosa: validaciones, options finas, plugins, hooks |

🔴 **Si sabes modelar, tu vía es `DBModelRaw`.** El formulario de `DBModel` es una rueda de apoyo: te
protege de errores a cambio de encerrarte en su subconjunto. Su propia descripción lo dice — `DBModelRaw`
trae *"todo el poder de los modelos de plataforma, junto con toda su dificultad"*.

## 2. `DBModelRaw` — el código ES el modelo

El campo `code` contiene **exactamente lo mismo que pondrías en un archivo**: una función exportada por
default que retorna un objeto `{NombreDelModelo: schema}`. Mismo patrón, mismo `this`, mismas reglas
(ver `itdfw-models` §2).

```js
function Mascota() {
  const {db} = this;
  this.init("Mascota");
  const Mascota = new db.Schema(
    {
      nombre: {type: String, name: "Nombre", required: true},
      edad: {type: Number, name: "Edad", min: 0}
    },
    {name: "Mascotas", modelName: "Mascotas", defaultMethods: ["GET", "POST", "PUT", "DELETE"]}
  );
  return {Mascota};
}
export default Mascota;
```

Si necesita dependencias, `await this.init("X", {schemas, models})` y función `async` — igual que un
archivo. El `import` de otros módulos NO aplica: el código se evalúa en el contexto del FW, con sus
globals disponibles.

### 🔴 El nombre NO se escribe: se DERIVA

El campo `name` del documento **no se pide ni se edita** — sale de la **key que retorna la función** y se
persiste al compilar. Tú escribes `return {Mascota}` y el documento queda con `name: "Mascota"`.

⟹ **Un documento = UN modelo.** Si el código retorna 0 o 2+ keys, el documento se rechaza con
`status: "FAILED"` y no se registra nada. No es paternalismo: sin exactamente una key **no hay nombre que
derivar**. (Un archivo sí puede retornar varios, porque ahí el nombre no se deriva de nada.)

### 🔴 Un modelo de BD puede DEPENDER de otro modelo de BD — y clonarlo

`this.init(name, {schemas: [...]})` funciona igual desde un documento que desde un archivo: el proxy de
dependencias del FW no distingue el origen. Un `DBModelRaw` puede esperar a otro, clonarlo con
`safeClone` y **pisarle los statics heredados**:

```js
async function MemberCompletionMinor() {
  const {Schemas: {MemberCompletionAdult}} =
    await this.init("MemberCompletionMinor", {schemas: ["MemberCompletionAdult"]});
  const MemberCompletionMinor = MemberCompletionAdult.safeClone({...});
  MemberCompletionMinor.add({parentalAuthorization: {...}});
  MemberCompletionMinor.static({belongsTo(doc) {...}});   // pisa el heredado
  return {MemberCompletionMinor};
}
```

🔴 **Recompilar un modelo NO recompila a sus dependientes.** El `post("save")` emite por PubSub **solo
por el documento que se guardó**; nadie avisa a quien lo clonó. El dependiente sigue con el clon de la
versión ANTERIOR en memoria de cada worker.

Modo de falla (caso real 2026-08-18): se quitó una option del modelo base y el clon **siguió teniendo la
option**, con `status: "OK"` y sin error en ninguna parte. El `code` en la BD ya decía una cosa y el
modelo compilado otra.

⟹ Tras editar un modelo del que otros dependen: **re-guardar los dependientes** (un PUT con su mismo
código basta) para forzar el re-clonado. En cadena de 3+ niveles, en orden de dependencia.

⟹ Y la verificación se hace contra el WORKER, no contra la BD: `modelFields <Modelo>` por MCP. Mirar el
`code` del documento solo te dice qué se guardó, no qué quedó compilado.

## 3. El flujo es POR EVENTOS, no lineal

Esto explica todo el resto del diseño y es lo que hay que entender:

1. Guardas el documento → **el save siempre tiene éxito**.
2. El save emite por **PubSub** a TODOS los workers (incluido el que guardó).
3. **Cada worker compila por su cuenta** y registra el modelo en su memoria.
4. El resultado de esa compilación se reporta en el propio documento: `status` (`OK`/`FAILED`) y
   `compileError`.

🔴 **Por eso el error NO viaja en la respuesta del save.** No hay un pipe lineal "guardo → compilo → te
contesto": la compilación es derivada y distribuida. Un throw durante la compilación **no** hace rollback
del save (ocurre en otro contexto, fuera de su transacción) — por eso existen `status` y `compileError`.

**Cómo saber si tu modelo quedó bien**: consulta el documento después de guardar. `status: "OK"` y
`compileError: null` = compiló en ese worker. `FAILED` = mira `compileError.message`.

**Y el modelo anterior sobrevive**: si editas uno que funcionaba y lo rompes, el documento queda en
FAILED pero **la versión buena sigue viva en memoria** hasta el próximo reinicio. La app no se cae por
un error de edición.

### 🔴 El acceso ANÓNIMO no se refresca en caliente

Editar el código regenera el modelo **y** sus puntas. Pero si el cambio afecta el acceso **anónimo**
(`isAnonymous`), no vas a verlo hasta reiniciar el servicio.

Síntoma: cambias a `isAnonymous: true`, el documento dice `status: "OK"`, `listModels` lo muestra
anónimo… y sigue pidiendo permisos. **No está roto el modelo** — la lista de funciones anónimas está
memoizada en cada worker y se invalida por un canal de PubSub distinto al que usa la recompilación de
modelos.

⟹ Cambio de campos o de nombre: en caliente. Cambio de `isAnonymous`: reiniciar.

## 4. Los modelos NO se borran

`noDelete: true` en ambos: sus verbos son `GET`, `POST`, `PUT`. Sin `DELETE`.

No es una restricción arbitraria — es **no prometer algo que no se puede cumplir**. Borrar un modelo
"bien" exigiría desregistrarlo de todos los workers, sacar sus puntas del `pool.API`, limpiar perfiles y
verificar que nadie lo referencie… y con `refPath` (referencia polimórfica, donde el modelo destino vive
en un campo de cada documento) **saber quién apunta a quién es inviable**. Una solución a medias
declarada como firme sería peor que no tenerla: el día que confíes en que el borrado limpia, no limpia.

⟹ Un modelo que salió mal se queda como basura visual, con su `status: FAILED`. Es el costo aceptado.

## 5. 🔴 Lo que es responsabilidad TUYA

Definir modelos desde la BD **no es un modo protegido**: es la misma potencia que un archivo, con la
misma exposición. La vara es la simetría — **si haciendo lo mismo por archivo dejas la cagá, acá también.**

- **Cambiar la key del modelo** (renombrarlo) deja el modelo viejo vivo en memoria, sus puntas
  registradas y los perfiles apuntando a algo que ya no se genera. Igual que renombrar un modelo en un
  archivo. Renombrar **es crear otro modelo**, no editar el que hay.
- **El nombre del modelo determina la colección** salvo que declares otra en las options. La regla del
  FW es "modelo = colección"; romperla a mano es salirse del flujo natural.
- **Referencias y perfiles**: nadie valida por ti que el modelo al que apuntas exista.

Si necesitas barandas, usa `DBModel`. `DBModelRaw` asume que sabes lo que haces.

## 5b. Crear el documento — el llamado literal

No hay que adivinarlo. Vía MCP (`callEndpoint`), o el mismo POST desde cualquier cliente:

```
POST APP/AAA/DBModelRaw.json
body: {code: "<el código del modelo, tal cual iría en un archivo>"}
```

🔴 **NO mandes `name`**: se deriva de la key que retorna la función (§2). Mandarlo no sirve de nada.

Respuesta esperada: `{status: "ok", _id: "<id>", model: "CodedDataModels"}`. 🔴 **Ese `ok` NO dice que
compiló** — dice que el documento se guardó. El veredicto de la compilación está en el propio documento
(§3): hay que ir a buscarlo.

## 6. Verificar (MCP)

Igual que cualquier modelo — ver `itdfw-models` §6:

| Verificar | Tool |
|---|---|
| El documento compiló | `query DBModelRaw` → mira `status` y `compileError` |
| El modelo quedó registrado | `listModels` |
| Los campos salieron bien | `modelFields <Modelo>` |
| El form y la grilla que verá el usuario | `schemaToForm` / `schemaToTable` |

🔴 Recién creado, el modelo **no es accesible** para nadie: hay que **asignarlo a un perfil**. Un 401 al
llamar sus puntas justo después de crearlo es el sistema de perfiles funcionando, no un error.

### 🔴 La ruta de las puntas de un modelo (y por qué el 404 miente)

```
APP/AAA/<Modelo>.<func>      ✅   ej: APP/AAA/MitigationProgram.formCreate
APP/AAA/<Modelo>.<func>.json ❌   → 404 "endpoint not found"
```

**La FUNCIÓN ocupa el lugar de la extensión**, no va después de ella. Si escribes `APP/AAA/<Modelo>.<func>.json` recibes
**404 `endpoint not found`** — y ese 404 **es indistinguible de "el modelo no existe"**, así que invita a
parchar un modelo que está perfectamente sano.

⟹ Quítale el `.json` y el mismo llamado responde **401** (o el dato). Verificado el 2026-08-12 contra un
modelo recién creado **y** contra `LoanScenario`, un modelo viejo y sano: los dos dan 404 con `.json`.

> Regla de lectura: **404 = la punta no está registrada** (ver la tríada de status en `itdfw-api-system`).
> Si el documento dice `status: "OK"` y el modelo aparece en `listModels`, el modelo NO es el problema —
> revisa la URL antes de tocar el código.

## Red flags

- Retornar varios modelos en un `DBModelRaw` → rechazado por diseño; usa un documento por modelo.
- Buscar el campo "nombre" para llenarlo → no existe, lo pone el código.
- Esperar que el save falle cuando el código está malo → el save SIEMPRE guarda; el veredicto está en
  `status`/`compileError`.
- Usar `DBModel` (formulario) para algo con validaciones o lógica → te vas a quedar corto; es `DBModelRaw`.
- Intentar borrar un modelo → no se puede, y es a propósito (§4).

## Skills hermanos

| Skill | Para qué |
|---|---|
| **`itdfw-models`** | TODO el modelado: campos, options, refs, autenticables, flujos de estado. El código del `DBModelRaw` es un modelo normal — ese skill es la SSoT |
| **`itdfw-mongoose-types`** | los types de los campos (`Currency`, `Duration`, `Percentage`, custom) |
| **`itdfw-api-system`** | las puntas que el modelo expone y cómo se gatean por perfil |

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW. Para un modelo en BD, el
mínimo es: `status: "OK"` en el documento, el modelo en `listModels`, los campos correctos en
`modelFields`, y **probado con el perfil asignado** — no basta con que compile.
