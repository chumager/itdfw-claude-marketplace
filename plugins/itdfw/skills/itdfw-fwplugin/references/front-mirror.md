# La asimetría back/front del espejo de carpetas

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

Acá está la **asimetría** con el back, y es de naturaleza, no de estilo:

| | **Back** | **Front** |
|---|---|---|
| Cómo llega al motor | **DECLARAS** las keys del objeto (`schemas`, `types`, `plugins`, `API`) | **NO declaras nada**: se descubre por **ubicación** |
| El espejo de carpetas | por **coherencia y orden** — recomendado, no obligatorio | **imperativo**: la carpeta ES el contrato |
| Si te sales del molde | funciona igual (el motor lee las keys) | **no existe**: nadie lo va a encontrar |
