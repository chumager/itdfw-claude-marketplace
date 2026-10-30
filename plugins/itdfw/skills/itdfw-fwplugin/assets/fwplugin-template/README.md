# Template FWP

Estructura RECOMENDADA de un FWPlugin distribuible: **espeja el back (`SITE/`) + el front**, con `lib/` para
lo isomorphic. Ver skill `itdfw-fwplugin`. (Es recomendada, no obligatoria: el motor solo lee las keys que
exportás en el index — pero espejar el back mantiene el FWP legible.)

## Uso
1. Copiá esta carpeta a `plugins/<tu-plugin>/` (externo) o `back/itdfw/src/SITE/FWPlugins/<tu-plugin>/` (deploy).
2. Renombrá los esqueletos (`MyType` / `myPlugin` / `MyModel` / `MyVO` / `ItdMyComp`) a lo tuyo.
3. **Borrá las carpetas/keys que no uses.**

## Estructura
```
<plugin>/
  index.js            → ensambla (scope por globales inFront/inBack, imports del back dinámicos)
  lib/                → isomorphic (VO, helpers back↔front)     → skill itdfw-mongoose-types (DDD)
  mongooseTypes/      → types custom                            → skill itdfw-mongoose-types
  mongoosePlugins/    → mongoose-plugins                        → skill itdfw-plugins
  mongooseSchema/     → schemas de negocio                      → skill itdfw-models
  mongooseDB/  APP/   → utilidades db / endpoints (si aplica)   → skill itdfw-api-system
  vue/ | vue2/ | vue3/ | react/ …  → front por framework        → skill itdfw-front-develop
  test/               → la suite (green+red, e2e)               → skill itdfw-completeness
```
`vue` = sirve para vue2 Y vue3; `vue2`/`vue3` solo si es específico de esa versión.
