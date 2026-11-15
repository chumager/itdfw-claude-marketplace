# Escribir con `save()` = estar en el flujo — detalle y mediciones

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y las mediciones.

**El FW no hace magia: usa las herramientas de los módulos que usa.** Todo lo suyo cuelga de **plugins
de mongoose**, y esos plugins enganchan los **hooks de documento** (`pre`/`post` de `validate` y `save`).
Las operaciones de query (`updateOne`, `updateMany`, `findOneAndUpdate`, `bulkWrite`, `insertMany`)
**no pasan por los hooks de documento** — es una decisión de mongoose y el FW no puede compensarla.

⟹ Escribir por esa vía **se come el flujo**: bitácora, `__history`, `updateUser`/`updateDate`,
multitenant, cast de types custom, validación, y cualquier plugin que un tercero enganche mañana.
**Y no avisa**: la operación responde OK y el dato queda escrito a medias respecto del contrato.

🔴 **Verificado empíricamente (2026-08-15, sonda contra el FW real)**: `Model.updateOne(..., {$push})`
sobre un docArray → **CERO hooks disparados**, ni del root ni del subdocumento.

### 🔴 La regla NO es "no se puede" — es "si no usas `save()`, eres responsable de lo que haces"

Saltarse el flujo es **legítimo y a veces obligatorio**. El propio FW lo hace: un plugin que escribe con
`save()` se dispara a sí mismo → **recursión infinita**. Por eso `previousField` (denormalización de
campos hacia los hijos) escribe así:

```js
await Model.model("Mutex").lock({          // ⟵ coordina entre procesos
  async fn() {
    await Model.updateMany(query, update, {strict: false, updatePipeline: true});
  }
});
```

Se salta el flujo **porque debe** (masivo, N documentos, y con `save()` se auto-invocaría), y a cambio
**asume los recaudos**: mutex, chequeo de vista, solo el primer proceso. Ese es el trato completo.

⟹ El criterio: **¿quiero el flujo del FW?** → `save()`. **¿Necesito saltármelo?** → adelante, pero
entonces son tuyos los hooks que no corrieron, la coordinación entre procesos y la consistencia. Lo que
NO vale es saltárselo **sin saber que lo hiciste** — que es el caso de "usé `updateOne` porque era más
directo".

### Efecto colateral que sí hay que conocer: los hooks del docArray corren para TODOS

Con `save()`, los `pre`/`post` del **sub-schema** de un docArray corren sobre **todos los subdocumentos**,
no solo el que cambió — y también cuando solo se modificó un campo del root. Medido:

| Operación | Qué dispara |
|---|---|
| crear con 3 subdocs | 3 `pre` + 3 `post` del sub, 1 `post` del root |
| agregar **1** subdoc a 3 existentes | **4** `pre` + **4** `post` del sub |
| modificar SOLO un campo del root | **4** `pre` + **4** `post` del sub (¡sin tocar el array!) |
| `updateOne` con `$push` | **nada** |

Además: el `post` del **root** corre **antes** que los `post` de los subdocumentos, el orden entre
subdocumentos **no es determinista**, y `modifiedPaths()` discrimina cuál cambió **solo en el `pre`** (en
el `post` ya viene vacío para todos).

⟹ **No cuelgues de un `post("save")` de sub-schema una acción con efecto externo** (emitir un evento,
mandar un correo, llamar una API): se dispara para todos los subdocumentos y hasta cuando nadie los tocó.
Esa acción va donde se sabe QUÉ cambió — la punta o el static que hizo el cambio.
