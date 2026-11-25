# El template, su `package.json` y los FWP inline del core

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle.

🔴 **Es RECOMENDADA, no obligatoria**: salvo la carpeta del front, el motor solo lee las **keys del objeto**
que exportás — podrías poner todo inline y funciona igual. Pero espejar el back es lo que mantiene el FWP
legible y coherente con el resto del FW. Para arrancar bien, **copiá el template** (`assets/fwplugin-template/`),
🔴 **incluido su `package.json`**: trae la whitelist `files` (rule `package-files-whitelist`) con las carpetas del
espejo y `README.md`, y **sin `TDD*.md` ni `test/`**: el README es la cara del paquete, el TDD es la cocina y va en
git pero no en el tarball. Un plugin que declara `TDD.md` a mano en `files` lo viola; el veto de `itdfw-deps.sh files`
lo detecta.
Los FWP que viven INLINE en la carpeta `FWPlugins/` del core (Currency, PDF) están así por **migración desde el
core** (se movieron/mergearon), NO porque sea el patrón a imitar.
