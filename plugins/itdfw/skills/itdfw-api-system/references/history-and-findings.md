# Deuda del prefijo `AAA/` y hallazgos

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño).

## Deuda: prefijo `AAA/` vestigial

⚠️ El prefijo `AAA/` que aparece en muchos paths actuales (`/APP/AAA/getIcon`, `/APP/AAA/setVersion`, `/APP/AAA/User.tableFields`) **NO es semánticamente significativo** — es una deuda:

El prefijo es un residuo del controller único `AAA` bajo el que se acumuló todo; desde que el front resuelve por `route.meta.model` ya no aporta información.

**Implicación para nuevos endpoints**: NO sigas la inercia. Cuando crees un nuevo endpoint nivel 1 (APP/), elige un filename que refleje SCOPE SEMÁNTICO real:
- ❌ `APP/AAA.js` con `getIcon` → path `/APP/AAA/getIcon`
- ✅ `APP/icons.js` con `getIcon` → path `/APP/icons/getIcon`
- ✅ `APP/utils/icons.js` con `getIcon` → path `/APP/utils/icons/getIcon`

Y para nivel 3 (`schema.options.API`), también vale revisar la convención: `"AAA/myProfile"` es vestigial, podría declararse simplemente `"myProfile"` (decisión de migración pendiente).

## Hallazgos (code review)

- Plugin `FrontEnd` — `//FIX` markers acknowledge the `switch(type)` antipattern (combos `form+specs+value` in `?type=create|update|register|check`). Pending split into discrete extensions.
- `AAA` — commented block transferring `schema.statics` to `route.meta` (saved 57KB payload). Confirm definitive removal.
- `User` — `myProfile` exists in `options.API` while a duplicate (commented) lives in `APP/AAA`. Decide canonical home.
- `execEndpoint` swallows missing methods silently (no `case "undefined"` for the outer `typeof API[func][method]` switch) — `POST` to a `GET-only` endpoint hits no branch and returns nothing. Worth an explicit 405.
