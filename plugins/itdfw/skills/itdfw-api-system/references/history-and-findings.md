# Deuda histórica y hallazgos

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño).

## Deuda histórica: prefijo `AAA/` vestigial

⚠️ El prefijo `AAA/` que aparece en muchos paths actuales (`/APP/AAA/getIcon`, `/APP/AAA/setVersion`, `/APP/AAA/User.tableFields`) **NO es semánticamente significativo** — es deuda histórica:

1. El FW partió con un único controller llamado `AAA`.
2. Todo se acumuló bajo `AAA/` por inercia.
3. Cuando se agregaron otros modelos, se forzó la convención `AAA/<model>` para que el front siguiera funcionando.
4. Después se introdujo `route.meta.model` en el front → el `AAA/` quedó vestigial pero nadie limpió.

**Implicación para nuevos endpoints**: NO sigas la inercia. Cuando crees un nuevo endpoint nivel 1 (APP/), elige un filename que refleje SCOPE SEMÁNTICO real:
- ❌ `APP/AAA.js` con `getIcon` → path `/APP/AAA/getIcon`
- ✅ `APP/icons.js` con `getIcon` → path `/APP/icons/getIcon`
- ✅ `APP/utils/icons.js` con `getIcon` → path `/APP/utils/icons/getIcon`

Y para nivel 3 (`schema.options.API`), también vale revisar la convención: `"AAA/myProfile"` es vestigial, podría declararse simplemente `"myProfile"` (decisión de migración pendiente).

Migración completa documentada en el TODO «aaa-prefix-cleanup».

## Hallazgos (code review for jcmunoz)

- Plugin `FrontEnd` — `//FIX` markers acknowledge the `switch(type)` antipattern (combos `form+specs+value` in `?type=create|update|register|check`). Pending split into discrete extensions.
- `AAA` — commented block transferring `schema.statics` to `route.meta` (saved 57KB payload). Confirm definitive removal.
- `User` — `myProfile` exists in `options.API` while a duplicate (commented) lives in `APP/AAA`. Decide canonical home.
- `execEndpoint` swallows missing methods silently (no `case "undefined"` for the outer `typeof API[func][method]` switch) — `POST` to a `GET-only` endpoint hits no branch and returns nothing. Worth an explicit 405.
