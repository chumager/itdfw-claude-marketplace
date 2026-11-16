# El FWPlugin NO recibe `db` por argumento — el motor, el porqué y el caso

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

#### 🔴🔴 El FWPlugin NO recibe `db` por argumento (y confundirlo lo deja MUDO)

Verificado en el motor de schemas del core → `#expandPlugins`:

```js
if (typeof plugin === "function") {
  result = await plugin.call(this);   // ← SOLO bindea `this`. NINGÚN argumento.
  if (!result) continue;
}
```

(igual para los FWPlugins descubiertos por archivo: `imported.call(this)`)

**Por qué no lo pasa:** porque `this` **ya lo trae** — `Schema`'s constructor hace `this.db = db`. Bindear
la instancia es entregar `db` (y `pool`, e `init`) de una. Pasarlo aparte sería redundante. Eso es todo.

⟹ Escribir `export default function (db) { if (!db) return {}; ... }` hace que `db` sea **siempre
`undefined`** → retorna `{}` → **el plugin carga y no aporta NADA, sin un solo error en el log**. No hay
modelos, no hay índices, no hay warning: falla en silencio y se pierde media hora dudando del modelo.

**De dónde viene la confusión:** el que SÍ recibe `db` por argumento es el **mongoosePlugin**, en
`#addPluginFromObject` del mismo archivo:

```js
if (res.constructor.name === "AsyncFunction") res = await res.call(this, this.db);
else res = res.call(this, this.db);
```

| Qué | Cómo lo invoca el motor | Cómo obtiene db |
|---|---|---|
| **FWPlugin** (función) | `plugin.call(this)` | `const {db} = this` |
| **mongoosePlugin** (función) | `res.call(this, this.db)` | argumento **o** `this` |

Si el FWPlugin **no necesita lógica** (solo declara keys estáticas) → forma **objeto** directo, sin
función y sin scope que resolver. La función es solo para los que SÍ necesitan runtime.

*(Corregido 2026-08-14: el skill documentaba `function (db)` con detección por ausencia del argumento —
le atribuía al FWPlugin la firma del mongoosePlugin. Cazado cuando el plugin `conversation` cargó mudo.)*

La fila original de Common Mistakes:

| Mistake | Fix |
|---------|-----|
| 🔴 `export default function (db)` en un FWPlugin | El motor lo llama `plugin.call(this)` **sin argumentos** → `db` es `undefined`, el plugin retorna vacío y **falla MUDO**. Se saca de `this` y el scope se decide con `inFront`/`inBack` |
