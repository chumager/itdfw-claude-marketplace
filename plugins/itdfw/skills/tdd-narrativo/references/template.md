# Plantilla del `TDD.md`

## Plantilla del `TDD.md`

```markdown
# <módulo> — TDD por niveles
> Regla de escalamiento: un nivel no se evalúa si el anterior no está verde.
> Modo: <NUEVO (reimplementa, cero parches, consulta) | REFACTOR con cobertura completa (firmas cambian si el contrato cambia; toda la suite) | INCREMENTAL (firmas y edges intactos; toda la suite + lista de casos que cambian)>
> Destino al cerrar: <se queda como spec del módulo | skill `<área>` + `architecture/<ruta>` + tests → este archivo a `history/`>
> Producto (solo si hay front de cliente final, skill `producto-antes-del-tdd`): <la alternativa elegida, en una línea> · estudio: <enlace>
> Este archivo es SOLO el contrato. El porqué de cada decisión: `TDD-bitacora.md`. Cada corrida: `TDD-corridas.md`.

## 🔴 Rebanada 1 — con esto avanzamos
| # | Qué | Terminado cuando (operando) |
<fuera de la rebanada 1, una línea cada uno>

## El scope
<tabla front/back o el que corresponda: actor, concurrencia, quién mira, vida, red>
<consecuencias prácticas para estos tests>

## Requisitos y qué NO vamos a construir
<MUST / SHOULD / MAY, declarados ANTES de mirar candidatos>
<si el dominio es una norma externa: qué RFC/spec, versión vigente con fecha, y el choque con lo que
 implementan de verdad los clientes con los que vamos a hablar>
| Requisito | must/should/may | ¿alguien lo provee? | Veredicto: adoptar / adaptar / implementar | Por qué |

## Modelo
### Entidades
| Campo | Tipo | Ref / refPath | Único / índice | Quién escribe | Se proyecta |
### Puntas
| Path | Verbo | Acceso: función asignable / anónima (porqué) / scope | Por qué ese acceso | Quién la llama | Modelo que toca |
| Params (obligatorio · normalización) | Body | Respuesta (shape y status posibles) | Errores (código · causa) |
<el criterio de acceso lo da `itdfw-api-system`; acá solo se declara cuál y por qué. Nunca "perfilada: <perfil>"
ni "solo <tipo de usuario>": se declara la función y, a lo más, su perfil por omisión; quién la recibe es configuración>

### Componentes                <!-- §2b': uno por componente Itd* que el módulo declara o extiende -->
| Prop | Tipo | Default | Qué significa |
| Capa (name) | Extiende a | Métodos que declara | Métodos que pisa |
<quién declara el render y qué llama; y la lista de lo que el componente NO hace>

### Relaciones
```mermaid
erDiagram
```

## Diferencial y defectos heredados        <!-- SOLO si el módulo ya opera (§2f) -->
| Pieza | Estado real | Qué hace este módulo con ella |
| Qué está mal hoy | Cómo se sabe (probado corriendo / sospecha + prueba que la destapa) | Arreglar o heredar |

## UI/UX — lo que ve la persona        <!-- SOLO si el módulo tiene front; la escribe designer -->
<pantallas, maquetas, cómo se entra y se sale de cada estado, en el celular. QA escribe el recorrido a partir de esto>

## Ejecutores
<quién dispara cada flujo>

## Nivel 0..3
| Caso (en dominio) | Qué cubre | Estado |

## Huecos conocidos
| Falta | Nivel | Por qué importa |

## Decisiones que estos tests blindan

## Puesta en operación        <!-- sin los 4 campos el TDD está PROBADO, no OPERANDO -->
| Commit | Versión | Deploy | Uso (quién, qué vio) |
```

