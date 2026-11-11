# inventory — specs declarados por componente, y configuración propia del proyecto (enmiendas)
> Estado: enmienda 1 (specs) APROBADA, 28-sep-2026. Enmienda 2 (configuración propia) pedida por el dueño al publicar la herramienta, 11-nov-2026.
> Modo: enmienda 1 INCREMENTAL. Enmienda 2 REFACTOR con cobertura completa: cambia dónde vive la raíz y la config; el resultado del escaneo se conserva.
> Destino al cerrar: se queda como spec de `agent-tools/inventory`.

## Narrativa
Quien va a tocar un componente del front pregunta al inventario por su rama y su lista de regresión. Hoy recibe
la cadena de herencia, pero no sabe qué pruebas cuidan cada eslabón y las adivina. El componente declara sus
pruebas en su propio archivo (`@spec <ruta desde la raíz del repo>`), y el inventario las enuncia junto a cada
instancia, tal como están escritas. Que el archivo exista lo verifica quien ejecuta las pruebas, no el inventario.

La herramienta se publica sin saber nada del proyecto que la usa: cada proyecto trae su `inventory.config.json`,
y la carpeta que lo contiene es la raíz del escaneo.

## Scope
Herramienta de desarrollo, un proceso por consulta (el MCP hace spawn del CLI), sin concurrencia, sin red. Lee disco.
El directorio de trabajo del proceso (o `INVENTORY_CONFIG`) decide qué proyecto se escanea.

## Contrato
| Pieza | Qué |
|---|---|
| declaración | uno o más `@spec <ruta>` en cualquier parte del archivo del componente (regex; un `@spec` no es código) |
| `specsOf(src)` | pura y exportada: devuelve las rutas declaradas, sin duplicados, sin tocar disco |
| instancia | cada instancia de `nodes[slot].instances` suma `specs: [...]` |
| `branch` / `affected` | suman `specsBySlot`: por cada slot (nodo, ancestros, descendientes) → `{<file>: [specs]}`; `[]` marca la instancia sin pruebas. `ancestors`/`descendants` siguen siendo strings |
| CLI | corre solo si `scan.mjs` es el entrypoint (importarlo no escanea ni lee config ni escribe `inventory.json`) |
| config | `inventory.config.json` del directorio de trabajo, o el archivo de `INVENTORY_CONFIG`. Sin config: error `inventory.config.json not found in <cwd>` (o `<ruta> not found`), exit 1, nada escrito. **Nunca un default** |
| raíz | la carpeta de la config. Las rutas relativas de la config (`frontDirs`, `callerDirs`, `projectDirs`) y las rutas de salida (`file`, callers) son relativas a ella |
| salida | `inventory.json` junto a la config |
| `callerDirs` | opcional, `[{layer, path}]`; un `*` en `path` expande directorios y, dentro de `layer`, el nombre encontrado. El back ya no va fijo en el código: lo declara la config |
| `loadConfig({cwd, env})` | exportada: devuelve `{cfg, root, file}` o lanza el error de arriba |
| `--help` / `-h` / `help` | imprime el uso; no lee config ni escribe nada |
| capa de un front fuera de la raíz | `external:<carpeta>`. Dentro de la raíz: `plugin:<x>`, `front:<x>` o `core` |

## Nivel 1
| Caso | Esperado | Estado |
|---|---|---|
| un componente declara dos `@spec` | ambas rutas aparecen en `specs`, tal cual | ✅ |
| un componente no declara `@spec` | sale con `specs: []` | ✅ |
| sin config en el cwd | error exacto, exit 1, nada escrito | ✅ |
| `INVENTORY_CONFIG` apunta a otra carpeta | la raíz es esa carpeta y `inventory.json` queda ahí | ✅ |
| `INVENTORY_CONFIG` apunta a un archivo que no existe | error que nombra la ruta | ✅ |
| `--help` sin config | uso impreso, carpeta intacta | ✅ |
| fixture: resumen, capas, dirs escaneados y de callers | 5 componentes; `core`, `plugin:demo`; `back back` | ✅ |
| fixture: `affected`, `callers`, `branch`, `orphans` | descendientes por extends, declared por variante sin prefijo, render por `localImport`, ancestros, huérfanos | ✅ |
| MCP: `initialize`, `tools/list`, llamada con `jq`, llamada sin config | 6 tools con `jq`; el error del escáner llega tal cual | ✅ |

Ejecutor: `pnpm test` en `agent-tools/inventory` (`node --test "test/*.test.js"`). El fixture vive en `test/fixture/` y
cada caso trabaja sobre una copia temporal: ninguna prueba escribe en el repo ni usa rutas del proyecto que la usa.

## Decisiones
- Regex sobre el archivo entero, igual que `name`/`extends`: no hay segundo parser.
- El inventario enuncia, no verifica existencia de los `@spec`: eso es del que ejecuta las pruebas.
- `specsBySlot` va aparte para no cambiar la forma de `ancestors`/`descendants`.
- Sin config no hay default: un default tendría las rutas de quien escribió la herramienta.
- `callerDirs` es config y no código: el back y los plugins de un proyecto no son parte de la herramienta.
- `config` se sigue embebiendo en `inventory.json` (mismo formato de salida que antes).
- Decidido al implementar, por revisar: los textos de salida pasaron a inglés (`SLOT DOES NOT EXIST`, el `warning` de `orphans`, las descripciones de las tools del MCP).
