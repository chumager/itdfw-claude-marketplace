# Después de crear un modelo: asignarlo a un perfil y la ruta de las puntas

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y las mediciones.

### 🔴 Un modelo recién creado NO es accesible hasta ASIGNARLO A UN PERFIL

Que el modelo cargue **no** lo hace visible ni llamable. Recién creado no es accesible **para nadie**:
hay que **asignarlo a un perfil** (`Profile.functions`) con los verbos que corresponda. Un **403** al
llamar sus puntas justo después de crearlo (un **401** si quien llama no está autenticado) es el sistema de perfiles funcionando, **no un error** —
y no hay nada que arreglar en el modelo.

⟹ Antes de dudar del código: **¿está asignado a un perfil?** Es el paso que más se olvida, porque el
modelo compila, arranca y hasta crea su colección en la BD sin él.

**Cómo se asigna** — dos vías:

| Vía | Cómo | Qué tener presente |
|---|---|---|
| Formulario del perfil | En `Profile`, campo `functions`: se arrastra desde "Available Functions" a "Assigned Functions" y se eligen los verbos | La lista sale de `Profile.allFuncs`: toda la API registrada, salvo las puntas `noProfile` |
| MCP `assignFunction` | `{profile, path, defaultMethods?}`: `profile` es el nombre o el `_id`; `path` es el que entrega `listAPIs` (`AAA/<Modelo>`) | Idempotente: si el perfil ya la tiene responde `exists`. Responde 404 si el perfil no existe o si el `path` no está en `allFuncs` (el back no cargó ese código, o es una punta `noProfile`). Sin `defaultMethods` copia los verbos de la función. La entrada se copia de `allFuncs`, nunca se arma a mano |

El permiso se lee del perfil en la BD en cada petición, así que no hay que reiniciar.

🔴 **Lo que NO existe:** ningún mecanismo agrega funciones a un perfil que ya existe, ni al instalar un plugin
ni cuando aparece un modelo nuevo. Un plugin solo puede **sembrar perfiles propios nuevos**, y lo hace una vez
(el plugin `restaurant` siembra `Owner` y no lo toca si ya existe). Si un plugin gana un modelo después, los
perfiles ya sembrados no lo reciben: se asigna con alguna de las dos vías de arriba.

### 🔴 La ruta de las puntas (y por qué el 404 miente)

```
APP/AAA/<Modelo>.<func>      ✅   ej: APP/AAA/Vehicle.formCreate
APP/AAA/<Modelo>.<func>.json ❌   → 404 "endpoint not found"
```

**La FUNCIÓN ocupa el lugar de la extensión**, no va después. Con `.json` al final recibes
**404 `endpoint not found`**, que es **indistinguible de "el modelo no existe"** → invita a parchar un
modelo sano. Quítale el `.json` y el mismo llamado responde **403** (o **401** sin identidad), o el dato.

> Regla de lectura: **404 = la punta no está registrada** · **403 = existe y estás autenticado, pero tu perfil no la tiene** · **401 = existe y no hay identidad**.
> Si el modelo aparece en `listModels`, el modelo NO es el problema — revisa la URL y el perfil antes
> de tocar código.

(Mismo comportamiento y misma trampa que en los modelos definidos en la BD → `itdfw-db-models`.)
