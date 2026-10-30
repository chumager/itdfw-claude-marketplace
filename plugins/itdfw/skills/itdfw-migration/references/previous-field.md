# `previousField` — renombrar campos de un modelo YA en producción, sin escribir migración

El caso: un modelo que ya corre sobre ITDFW cambia el nombre de un campo. Los documentos en Mongo
tienen el nombre viejo; el schema declara el nuevo. **Sin migración, esos datos quedan huérfanos.**

`back/itdfw/src/SITE/mongoosePlugins/previousField.js`

## Cómo se usa

Se declara **en el campo**, y no hay nada más que hacer:

```js
lastname: {type: String, name: "Apellido", previousField: "surname1"}
```

Al arrancar el servicio, el FW busca los documentos que todavía tienen `surname1` y los renombra.
**Cero código de migración, cero script que alguien tenga que acordarse de correr.**

## Qué cubre (verificado en el código)

| Forma del campo | Cómo lo resuelve |
|---|---|
| root plano | `$rename` |
| **DocumentArray** | pipeline con `$map` sobre el arreglo |
| **Embedded single** | objeto reconstruido directo (sin `$map`) |
| **N niveles** | recursivo — el `instance` se resuelve desde el schema del **padre**, no del root |

El plugin bifurca por nivel según el tipo del padre, así que `extra.extraTest.deepField ← deepOld`
funciona igual que un rename plano.

**Banco de regresión:** el modelo `TestAnon` (`DEFAULT/mongooseSchema/TestAnon.js`) ejercita las tres
ramas con datos reales. 🔴 Si tocás la lógica del plugin, ese es el rig.

## Los recaudos que toma (y por qué importan)

Es el ejemplo canónico de **saltarse el flujo del FW a conciencia** (ver `itdfw-models` §4c): escribe
con `updateMany`, no con `save()`, porque con `save()` se auto-invocaría en recursión infinita. A
cambio asume todo lo que eso implica:

- **Solo el primer proceso** (`global.first`): con varios workers, el rename lo hace uno.
- **Mutex** con `lockName` derivado del modelo y el campo — si otro proceso lo tomó, este se retira
  en silencio (`LOCK_TAKEN` no es error).
- **Solo `active: true`** y solo documentos que **tienen** el campo viejo (`$exists`), así que correrlo
  de nuevo no hace nada.
- **Vistas excluidas** (`isViewP`): clonan el root, su migración es del padre.
- `updatePipeline: true` — requerido por mongoose 9 para pipelines de update sobre arreglos.

## Cuándo NO sirve

🔴 **Solo migra dentro de Mongo.** Si el origen es otro motor (MySQL, Postgres) o otro sistema, esto no
aplica: ahí la transformación es un **ETL**, y el modelo destino se diseña limpio sin arrastres (ver
la regla 4 del SKILL).

`previousField` es para **evolución del propio modelo**, no para importación.

## Cuándo se saca

El campo `previousField` puede quedarse indefinidamente —es idempotente y no cuesta nada una vez que
no quedan documentos viejos—, pero si el modelo es tuyo y la migración ya corrió en todos los
despliegues, sacarlo deja el schema más limpio. Antes de sacarlo, verificar que **ningún despliegue**
tenga todavía datos con el nombre viejo: basta uno que arrancó tarde para perder esos documentos.
