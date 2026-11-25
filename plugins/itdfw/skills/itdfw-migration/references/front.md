# Migrar el front de un sistema existente

## 🔴 La UI no se porta: se lee

En ITDFW el front **se deriva del modelo** — formularios, grillas, filtros, exportación y control de
acceso salen de la declaración del schema. Un front existente está construido al revés: cada pantalla
resuelve lo suyo a mano.

⟹ **El código del front origen no es material a traducir. Es el inventario de requerimientos**, que
suele ser lo único que documenta qué hace el sistema. Se lee para saber **qué pantallas existen y qué
reglas de negocio hay adentro**, no para portar componentes.

## Qué se deriva y qué no

| Del front origen | En ITDFW |
|---|---|
| Formularios de alta/edición | **derivado** del modelo |
| Grillas, filtros, orden, paginación | **derivado** |
| Exportación XLS/PDF | **derivado** (del type de cada campo) |
| Inputs (texto, select, fecha, moneda) | **los provee el FW** |
| Formularios por etapas / wizard | **bloques de layout** (`blocks` en `formSpecs` + `group` en el campo) — no hay que construir un wizard |
| Comentarios sobre una ficha | **Bitácora** del FW |
| **Dashboards, gráficos, tableros** | 🔴 **NO se derivan.** Son agregación y visualización: hay que construirlos |
| **Carta Gantt, líneas de tiempo, diagramas** | 🔴 NO se derivan |
| Pantallas de un vertical propio (torneos, agenda…) | según el caso: probablemente no se migran |

**Regla práctica:** todo lo que sea *"un CRUD sobre una entidad"* se deriva y no se escribe. Lo que
quede afuera —lo que agrega, cruza o dibuja— es el trabajo real del front, y suele ser mucho menos de
lo que el conteo de archivos sugiere.

## Cómo medir cuánto hay realmente

El conteo de archivos engaña. Antes de estimar:

1. **Duplicados**: buscar el mismo nombre en `views/` y `components/`. Un sistema con dos entry points
   paralelos tiene la misma pantalla dos veces, divergida.
2. **Huérfanos**: componentes que nadie importa. Suelen ser buena parte de la carpeta, casi
   todos residuo del template de admin.
3. **Reutilización real**: contar importadores por componente. Si los únicos con 10+ usos son campos de
   formulario, no hay biblioteca de componentes — hay pantallas que repiten inputs. Y esos inputs los
   da el FW.
4. **Dónde vive la lógica**: `<template>` vs `<script>` en las vistas más grandes, y si usan composables
   o todo está inline. Si está inline, **la vista ES la lógica** y no hay nada reutilizable que rescatar.

*(Ejemplo: de ~200 archivos `.vue` pueden salir menos de 80 vistas reales, con duplicados divergidos, huérfanos, y como
únicos componentes compartidos unos pocos inputs de formulario.)*

## Lo que sí conviene rescatar

- **El mapa de pantallas** — qué existe y para qué rol.
- **Las reglas de negocio incrustadas** en las vistas (validaciones, cálculos, condiciones de
  visibilidad). Esas casi nunca están documentadas en otro lado.
- **La capa de datos**, si está bien hecha: los servicios agrupados por dominio son el contrato real
  de operaciones del sistema, y se leen mucho más rápido que el backend.

## Separación por rol: la trampa del front único

Un sistema con un solo front para todos los roles esconde el problema con `v-if` sobre el rol y
escondiendo ítems del menú.

En ITDFW eso no se resuelve escondiendo: **el perfil determina qué modelos existen para ese usuario**,
y el menú se deriva de ahí. Un usuario cuyo perfil solo tiene un modelo no tiene manera de llegar a lo
demás — no está oculto, **no existe**.

⟹ Al migrar, la pregunta no es *"¿qué le escondo a cada rol?"* sino **"¿qué modelos y verbos tiene
cada perfil?"**. Y de ahí suele salir que roles muy distintos (un administrador interno vs. un usuario
externo que llena una ficha) no necesitan la misma aplicación, aunque el origen los tuviera juntos.
