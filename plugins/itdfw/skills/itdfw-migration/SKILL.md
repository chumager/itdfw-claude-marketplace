---
name: itdfw-migration
description: Use when migrating an EXISTING system into ITDFW (another platform, another stack), or when renaming fields of models already running on ITDFW. Covers the delta method for modeling over what the framework already provides, what NOT to migrate (and why), the `previousField` plugin for zero-code field renames in MongoDB, and how an existing UI maps to a derived front. NOT for building something new (use itdfw-models / itdfw-fwplugin).
---

# ITDFW Migration — traer un sistema existente a la plataforma

## Referencias

| Referencia | Qué trae | Léela cuando |
|---|---|---|
| [front.md](references/front.md) | Migrar el front: la UI no se porta, se lee como inventario de requerimientos; qué se deriva del modelo y qué no; medir el tamaño; qué rescatar; separación por rol | vas a migrar las pantallas de un sistema existente |
| [previous-field.md](references/previous-field.md) | `previousField`: renombrar campos de un modelo ya en producción sin escribir migración; qué cubre, recaudos, cuándo no sirve y cuándo se retira | un modelo que ya corre cambia el nombre de un campo y los datos tienen el nombre viejo |

**Construir desde cero está cubierto por los otros skills. Esto es otra disciplina.**

Migrar no es traducir. El sistema origen ya tomó decisiones —algunas del negocio, otras de su
implementación, varias equivocadas— y la plataforma destino ya provee la mitad de lo que hay. El
trabajo real es **decidir qué merece existir**.

> Estado: en construcción con la primera migración real (minería / Proyecto Propio, agosto 2026). Cada
> regla nace de un error cometido, no de teoría.

## Las dos migraciones, que son distintas

| | Origen | Herramienta principal |
|---|---|---|
| **De otra plataforma** | otro stack (Go+MySQL, PHP, lo que sea) | modelado por DELTA + ETL |
| **Dentro de ITDFW** | un modelo ya corriendo que cambia de forma | **`previousField`** — [previous-field.md](references/previous-field.md) |

---

## 1. 🔴 El entregable es el DELTA, no el modelo completo

Al modelar sobre algo que ya existe **no se escribe el modelo entero**. Se escribe:

1. **De qué se parte** — qué provee el FW (clon base, plugin que aporta la capacidad). Si no provee
   nada, decirlo: es una verificación, no una omisión.
2. **Qué es NUEVO** — solo eso.
3. **Cómo entra** — ¿plugin o clon?
4. **La transformación de campos** — tabla origen → destino, **con los DESCARTADOS y su motivo**.

**Por qué:** escribir el modelo completo lleva a re-declarar lo que ya existe y a arrastrar campos del
origen sin filtrarlos. El delta obliga a justificar cada campo.

**Vara de calidad:** si la tabla de transformación no tiene descartes, no filtraste — transcribiste.
*(Caso real: `personat` tenía 9 campos, quedaron 5.)*

## 2. 🔴 Lo LOCAL manda sobre lo del origen

El destino ya tiene una forma de hacer las cosas, y esa gana. El origen no impone su diseño solo por
existir.

Caso real: el sistema traía `surname1` y `surname2`. **Nosotros usamos UN apellido.** No se migran dos
porque el origen los tenga: si un cliente los exige, se agrega el segundo **por plugin sobre el
derivado**, nunca al modelo base.

Y los nombres de campo salen de **la convención del destino**, no del origen: `firstname`/`lastname`
como los declara `User` del FW, para que el día que haya que cruzar los modelos hablen igual.

⟹ Antes de traer un campo: *"¿así lo hacemos nosotros?"*, no *"¿así lo tenían ellos?"*.

## 3. 🔴 No migrar lo que CONTRADICE un mecanismo del destino

Peor que un campo de más: uno que **rompe una capacidad de la plataforma**.

Caso real — `personat.country`: traerlo implica que puede haber personas de distintos países en el
mismo sistema. Pero el país lo define el **plugin del tenant**, que opera **por MODELO** (promueve
`nationalId` al type local para todo el modelo). Con `country` por documento esa promoción deja de
servir: habría que resolver la definición del campo **documento a documento**, con controladores
multicapa. Otro nivel de complejidad, y para nada.

**El país es del DEPLOY, no del dato.**

⟹ **Detección:** si un campo del origen exige resolver **por documento** algo que la plataforma
resuelve **por modelo**, no se migra — se resuelve por configuración del despliegue.

## 4. 🔴 El amarre pertenece al proceso de carga, no al modelo

**NO se agrega `legacyId` / `oldId` / `sourceId`** a los modelos para amarrar la migración.

La carga de datos es **una operación que ocurre una vez**; el modelo vive años. Un campo de amarre
ensucia N modelos con infraestructura de esa operación, y queda ahí para siempre — visible en forms,
en grillas, en exportaciones, confundiendo a todo el que lo lea después.

⟹ Se cae la falsa disyuntiva *"¿migramos datos o partimos limpio?"*: **se modela el dominio como debe
ser, y la carga resuelve el puente por su cuenta.** Son dos problemas separados, y separarlos es el
punto.

⚠️ **Ojo con los modelos ETL del FW** (`ETLSelection`, `ETLDirect`): son para **SACAR** datos del FW
hacia otra plataforma, no para cargar desde una. No sirven para esto y confundirlos lleva a asumir que
la importación está resuelta cuando no lo está.

## 5. Lo que el destino YA PROVEE no se migra: se descarta

Antes de traducir un área, verificar si la plataforma ya la tiene. En el caso minero se cayeron de
entrada: tickets (6 tablas), plantillas y envíos de correo (3), tokens de recuperación y verificación
(2), comentarios, archivos, y los catálogos (`parametros` → modelo `Config`).

⟹ Consultar `mcp__itdfw-graph__find` **antes** de modelar cada área. Con términos técnicos.

## 6. Separar el sistema REAL de lo que se le montó encima

Un sistema con años acumula capas que no son del negocio: demos, pruebas, verticales de otro cliente,
código que viajó por copiar carpetas.

Caso real: de 68 tablas, **17 eran de una demo** montada tres días antes de la entrega, y un servicio
completo era un producto ajeno arrastrado.

**Cómo se detecta:** el `.git` del origen, aunque sea corto. El primer commit suele ser el estado
"antes de", y `git diff <primer-commit> HEAD --stat` dice exactamente qué se agregó después.

## 7. 🔴 El origen puede estar MAL, y eso no se migra

| En el origen | Por qué no se migra tal cual |
|---|---|
| `estado` string libre sin restricción de transición | Falsificable: se salta a "aprobado" sin evidencia. El FW **deriva** el estado de una bitácora de hechos (`itdfw-models/state-flows.md`) |
| Catálogos cruzados **por texto** | Ya hay datos sucios (`"Ejecución Presupuestaria "` con espacio, `"Planificacion"` sin tilde). Hay que normalizar o esos registros llegan mudos |
| Reglas que viven **solo como CHECK de BD** | No están en el código. Si nadie las replica, la regla desaparece en silencio |
| IDs con rango semántico | El ID codificaba el tipo de entidad. Es convención, no estructura — con ObjectId desaparece y no hay que reemplazarla |

⟹ Cada uno exige una **decisión explícita**, y varias son preguntas al cliente, no nuestras.

## 8. La fuente de verdad es el CÓDIGO, no el DDL

El esquema declarado y el código pueden haber divergido. Caso real: el `database.sql` del origen
conservaba una versión vieja de una tabla que ya había sido refactorizada en los modelos.

⟹ Cruzar siempre: DDL + modelos del código + datos reales del dump. **Donde discrepen, manda el
código.**

## 9. Lo que nadie sabe explicar, no se modela

Siempre hay campos sin semántica conocida. **No se inventa una**: se listan como preguntas al cliente y
se modela lo demás.

⟹ **El vocabulario del dominio resuelve más incógnitas que leer código.** Búscalo temprano — en el
caso minero, un campo sin FK ni uso claro (`tronco_id`) se resolvió al aparecer la terminología: eran
los troncos familiares aymaras.

---

## El front

Una UI existente no se porta: **se lee como inventario de requerimientos**. Detalle y criterios en
[front.md](references/front.md).

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

Y en migración hay una verificación propia: **el dato migrado se contrasta contra el origen**, no
contra lo que uno cree que migró. Un ETL que corre sin error puede haber dejado la mitad de los
registros mudos por un catálogo que no matcheó.
