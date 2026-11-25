---
name: itdfw-db-models
description: Use when creating or modifying ITDFW data models defined IN THE DATABASE instead of as files — the two flavors (DBModel guided form vs DBModelRaw code), how the name is derived from the code, the event-driven compile flow with status/compileError, why models cannot be deleted, and what stays the developer's responsibility. NOT for models as files (use itdfw-models) nor for custom types (use itdfw-mongoose-types).
---

# ITDFW DB Models — Modelos definidos en la BD

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [why-and-cases.md](references/why-and-cases.md) | Por qué el error de compilación no viaja en la respuesta, el clon que sigue con la option vieja, por qué el acceso anónimo no se refresca en caliente, por qué no se borran, por qué el 404 con `.json` engaña | quieres el porqué de una regla, o un síntoma de este skill no calza con lo que esperabas |

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

⟹ **Un documento = UN modelo.** Si el código retorna 0 o 2+ keys, el documento se guarda igual pero queda con
`status: "FAILED"` y no se registra ningún modelo. No es paternalismo: sin exactamente una key **no hay nombre que
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

🔴 **Recompilar un modelo NO recompila a sus dependientes**: el PubSub avisa solo por el documento guardado, y el
dependiente sigue con el clon de la versión ANTERIOR en cada worker, con `status: "OK"` y sin error.

⟹ Tras editar un modelo del que otros dependen: **re-guardar los dependientes** (un PUT con su mismo código basta), en
orden de dependencia si la cadena es de 3+ niveles. ⟹ La verificación se hace contra el WORKER (`modelFields <Modelo>`
por MCP), no contra el `code` del documento, que solo dice qué se guardó. El porqué:
[references/why-and-cases.md](references/why-and-cases.md).

## 3. El flujo es POR EVENTOS, no lineal

Esto explica todo el resto del diseño y es lo que hay que entender:

1. Guardas el documento → **el save siempre tiene éxito**.
2. El save emite por **PubSub** a TODOS los workers (incluido el que guardó).
3. **Cada worker compila por su cuenta** y registra el modelo en su memoria.
4. El resultado de esa compilación se reporta en el propio documento: `status` (`OK`/`FAILED`) y
   `compileError`.

🔴 **Por eso el error NO viaja en la respuesta del save**, y un throw al compilar no hace rollback del save: el veredicto
está en `status` y `compileError` ([por qué](references/why-and-cases.md)).

**Cómo saber si tu modelo quedó bien**: consulta el documento después de guardar. `status: "OK"` y
`compileError: null` = compiló en ese worker. `FAILED` = mira `compileError.message`.

**Y el modelo anterior sobrevive**: si editas uno que funcionaba y lo rompes, el documento queda en
FAILED pero **la versión buena sigue viva en memoria** hasta el próximo reinicio. La app no se cae por
un error de edición.

### 🔴 El acceso ANÓNIMO no se refresca en caliente

Editar el código regenera el modelo **y** sus puntas, pero un cambio de acceso **anónimo** (`isAnonymous`) no se ve
hasta reiniciar el servicio: el documento dice `OK`, `listModels` lo muestra anónimo, y sigue pidiendo permisos (la lista
anónima está memoizada por worker; [por qué](references/why-and-cases.md)).

⟹ Cambio de campos: en caliente. Cambio de nombre: en caliente, pero es OTRO modelo (§5). Cambio de `isAnonymous`:
reiniciar.

## 4. Los modelos NO se borran

`noDelete: true` en `DBModel` y `DBModelRaw`: el documento que DEFINE el modelo tiene `GET`, `POST`, `PUT`, sin `DELETE`.
(Los `defaultMethods` del modelo definido, como el `DELETE` de `Mascota` en §2, son de sus propios documentos.)

No es arbitrario: borrarlo bien exigiría desregistrarlo de todos los workers, sacar sus puntas, limpiar perfiles y
saber quién lo referencia, y con `refPath` eso es inviable ([el detalle](references/why-and-cases.md)). ⟹ Un modelo
que salió mal se queda como basura visual, con su `status: FAILED`. Es el costo aceptado.

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
APP/AAA/<Modelo>.json        ✅   el alta y la edición del modelo (POST crea, PUT edita) — ej: APP/AAA/DBModelRaw.json
APP/AAA/<Modelo>.<func>      ✅   una función del modelo — ej: APP/AAA/<Modelo>.formCreate
APP/AAA/<Modelo>.<func>.json ❌   → 404 "endpoint not found"
```

**En una función, el nombre de la función ocupa el lugar de la extensión.** Con `.<func>.json` recibes **404 `endpoint not
found`**, indistinguible de "el modelo no existe": invita a parchar un modelo sano. Quítale el `.json` y el mismo
llamado responde **401** (o el dato).

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
