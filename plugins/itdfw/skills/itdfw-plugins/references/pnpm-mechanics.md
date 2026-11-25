# La versión de mongoose y la mecánica de pnpm para subir una dependencia

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

🔴 **Y la versión NO es la última: es el MAJOR que tiene el FW** (`"mongoose": "^9.0.0"`, no `"^9.9.2"`).
Un rango pineado por sobre el del back hace que pnpm instale una **segunda copia** en el proceso. Con dos
copias, `Schema.prototype` son dos objetos distintos: los parches que el FW instala (`eachVirtualPath`…)
existen en una y **no** en la otra, y cualquier plugin del core que recorra `childSchemas` explota. Misma
regla para `libs/*`.

Mecánica de pnpm que hay que conocer :

| Comando | Rango declarado | Resolución (lock) |
|---|---|---|
| `pnpm add <pkg>` | intacto | intacta si el rango ya se satisface — **no mueve nada** |
| `pnpm add <pkg>@latest` | **intacto** | sube ✅ **este es el que quieres** |
| `pnpm update <pkg> --latest` | **lo REESCRIBE** al resuelto ❌ | sube |
| `pnpm install` | intacto | solo obedece al lock |

⟹ Para subir sin romper la convención: **`pnpm add <pkg>@latest`**. Y ojo: con rango amplio y una
resolución vieja congelada en el lock, `install` te deja pegado en la versión antigua para siempre
(p. ej. `^9.0.0` clavado en 9.6.2 mientras el back iba en 9.9.2). Verifica con `pnpm why <pkg>` →
debe decir **`Found 1 version`**.
