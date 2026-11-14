# room: TDD de una página

> Modo: **NUEVO** (reimplementa, cero parches, consulta).
> Estado: brief del líder del equipo, con la instrucción del dueño citada por él: "es un irc, con comandos, /invite, /cualquier
> cosa". Las decisiones quedan **por revisar**.
> Destino al cerrar: se queda como spec de la herramienta. No es un módulo del FW: sin modelos ni puntas del FW.

## Narrativa
Una reunión corta entre una persona y dos o tres sesiones vivas de Claude Code de la misma máquina. Para la persona es
una sala de chat con comandos. Para las sesiones son mensajes que llegan por su socket, y contestan por comando. Lo
conversado queda guardado y quien entra tarde lo puede leer. Todo le llega a todos, salvo a quien lo escribió.

## Scope
| Qué | Valor |
|---|---|
| Actores | una persona en una terminal; sesiones, cada una por su propio proceso `room` |
| Concurrencia | real entre procesos, sobre el mismo archivo. Sin servidor ni demonio |
| Quién mira | la persona en vivo; una sesión lee lo que le llega y lo anterior con `room read` |
| Vida | cada comando vive lo que dura; `room <sala>` hasta `/leave`. La sala queda en el disco |
| Red | ninguna: un socket Unix por sesión, en una sola máquina |

## Rebanada 1
ana abre `room design`, hace `/invite lead`, `lead` recibe el aviso, contesta con `room say`, ana lo ve en vivo.

Fuera de la rebanada 1: franja en la interfaz; permisos entre salas; varias máquinas; filtros, menciones y resúmenes.

## Modelo
**Sala**: archivo JSONL append en `${ROOM_DIR:-~/.claude/state/rooms}/<sala>.jsonl`, permisos 600. Lo crea quien entra
primero y vive hasta que alguien lo borre a mano. Los participantes no se guardan: se derivan de los eventos.

| Campo | Tipo | Cuándo | Qué es |
|---|---|---|---|
| `ts` | ISO 8601 | siempre | cuándo se escribió |
| `type` | `msg`, `join`, `left` | siempre | clase de línea |
| `from`, `text` | string | `msg` | autor y texto |
| `who` | string | `join`, `left` | el participante |
| `kind` | `person`, `session` | `join` | una `session` recibe por socket; una `person` sigue el archivo |
| `by` | string | `join`, `left` por `kick` | quién lo hizo |
| `reason` | `leave`, `quit`, `kick`, `dead` | `left` | por qué salió |

**Puntas (CLI)**: `room <sala>` · `say <sala> <texto>` · `read <sala> [--desde N]` · `who <sala>` ·
`invite <sala> <sesión>` · `kick <sala> <sesión>` · `leave <sala>` · `list`.
Salida 0 si se hizo, 1 si falló, 2 si el uso es incorrecto. **Sesiones**: `${ROOM_SESSIONS_DIR:-~/.claude/sessions}`.

## Ejecutores
La persona dispara `room <sala>` y sus comandos con `/`. Una sesión dispara los comandos de CLI desde su Bash; su nombre
sale de subir por los procesos padres hasta su ficha. No hay cron: nada corre si nadie escribe.

## Pruebas (en `agent-tools/room`: `node --test --test-timeout=30000 "test/*.test.mjs"`, con sesiones falsas)
| Caso | Qué lo haría fallar | Estado |
|---|---|---|
| N0 · la sala queda con permisos 600 y un nombre con `../` se rechaza | modo por defecto; ruta sin validar | ✅ |
| N1 · un mensaje llega a todos menos al autor, con sala, autor, texto y cómo responder | entregar al autor; omitir a alguien | ✅ |
| N1 · quien entra tarde lee lo anterior; `--desde N` no repite | contar mal las líneas | ✅ |
| N1 · un muerto no impide entregar, sale con `left: dead` y se avisa a los demás | cortar la entrega en el primer error | ✅ |
| N1 · `kick` y `leave` dejan de recibir | derivar mal los participantes | ✅ |
| N1 · `say` exige participante; `read` es libre; `invite` y `kick` son de participantes | no validar | ✅ |
| N1 · un texto o un nombre no puede cerrar el bloque del mensaje | no escapar `<`, `>` y `"` | ✅ |
| N1 · el aviso de invitación trae sala, presentes y cómo responder, sin el historial | mandar el historial | ✅ |
| N1 · los comandos con `/` funcionan sin TTY, y en vivo por stdin | lógica atada a la terminal | ✅ |
| N1 · con TTY real: recibe en vivo, conserva lo tipeado, sin secuencias del texto | escribir sin limpiar la línea | ✅ |
| N1 · en TTY real, el markdown sale renderizado y un ANSI dentro del mensaje no llega a la terminal | copiar el texto sin limpiar antes de renderizar | ✅ |
| N1 · un `@participante` le llega a todos: al mencionado con "Dirigido a ti.", al resto con la línea informativa; un `@` que no es participante no cuenta | entregar solo al mencionado; contar cualquier `@palabra` | ✅ |
| N1 · un mensaje sin mención (o con `x@nombre`, un `@` pegado a una palabra) deja el aviso igual que antes | agregar la línea siempre; leer un correo como mención | ✅ |
| N1 · `/invite` encuentra la sesión sin distinguir mayúsculas y entra con su nombre real | resolver por igualdad exacta | ✅ |
| N1 · a un participante se le entrega por su nombre exacto aunque otra sesión viva difiera solo en mayúsculas | usar la resolución sin distinguir mayúsculas al entregar: marcaría muerto al participante | ✅ |
| N1 · `@RESTAURANT` menciona a `Restaurant` y el aviso nombra al real | comparar con distinción de mayúsculas | ✅ |
| N1 · la vista en terminal resalta la mención con el nombre real | resaltar con el texto tipeado | ✅ |
| N1 · tab completa `/` (comandos), `/invite ` (sesiones vivas) y `@` (participantes de la sala), sin distinguir mayúsculas; no completa texto común ni argumentos de otros comandos ni un `@` pegado a una palabra | no pasar `completer` a `readline`; comparar con distinción de mayúsculas | ✅ |
| N1 · con TTY real, tab completa el nombre tras `/invite` y una `@mención` y el resultado llega a la sesión | el `completer` fuera de `readline` | ✅ |
| N3 · procesos tras una barrera escriben a la vez, con choque afirmado: ni pierden ni mezclan líneas | escribir en dos pasos o reescribir el archivo | ✅ |
| N3 · dos `say` simultáneos quedan en el archivo y le llegan al otro | ídem | ✅ |

## Huecos
| Falta | Por qué importa |
|---|---|
| Mensajes retenidos: el socket puede aceptar un mensaje que la sesión destino aún no procesa | `say` informa lo que el socket le dijo, nada más: `sent` no significa leído |
| Sin prueba contra una sesión real: el brief prohíbe mandarles mensajes | el primer uso real es la prueba del protocolo con Claude Code |
| Dos terminales de la misma persona: cerrar una la saca de la sala | borde sin caso de uso para 2 o 3 participantes |

## Decisiones (por revisar)
1. La persona se llama `ROOM_USER`, o `$USER` si no está. `room <sala>` siempre entra como persona.
2. Sin marca de autoridad: todo mensaje de sala es informativo y viaja como mensaje entre sesiones.
3. Se escapan `<` y `>` en texto y nombres, y además `"` en el atributo `from-name`.
4. `say` exige participante; `read` es libre; `invite` y `kick` son de cualquier participante, también por CLI.
5. Se identifica por nombre y se entrega a la primera sesión viva con ese nombre.
6. Un muerto sale con `left: dead` y vuelve por `invite`.
7. `--desde N` es el número de línea del archivo, 1 en adelante; devuelve lo posterior a N.
8. **Decidido al implementar:** `invite` sobre una sala inexistente o vacía deja adentro a quien invita. Si no, una
   sesión no podría abrir una reunión. Deshacerlo: quitar una condición.
9. **Decidido al implementar:** entrar, salir, `invite` y `kick` también se avisan a las sesiones de la sala (N²). Quien
   recibe un `kick` recibe ese último aviso y nada más.
10. **Decidido al implementar:** `room <sala>` limpia los caracteres de control al mostrar, para que un texto no maneje
    la terminal; `room read` también. El archivo guarda el texto original.

## Formato (el dueño, 7-nov-2026; modo incremental: el disco y los comandos no cambian)
- Cada mensaje: `[HH:MM][autor]: texto` (con `DD-MM` delante si no es de hoy), una línea en blanco antes, y los saltos
  del texto respetados con sangría bajo la cabecera. Entradas y salidas en una línea, atenuadas en TTY.
- En TTY el markdown se renderiza con `marked` 15.0.12 + `marked-terminal` 7.3.0 (exactas, publicadas hace más de dos
  semanas), al ancho del terminal. Sin TTY va crudo, sin ANSI, con la misma disposición.
- `forDisplay` limpia el texto antes de renderizar: el único ANSI es el del renderizador. El encabezado de las tablas
  va en negrita y los nombres en colores de 256, para no confundirse con un color básico inyectado.
- **Decidido al implementar, por revisar:** el número de línea queda solo en `room read` (es el `N` de `--desde N`);
  la vista en vivo y `/history` no lo muestran. `marked-terminal` 7.3.0 deja crudo el texto de un ítem de lista
  ajustada: se le parsea el inline con un `renderer.text` propio.

## Menciones (el dueño, 7-nov-2026; modo incremental: el disco y los comandos no cambian)
- Todos ven todo: `@nombre` solo dice para quién es el mensaje. Cuenta si `nombre` es participante de la sala y el `@`
  no va pegado a una palabra (un correo no menciona). Puede haber varias. No existe `@todos`: un mensaje sin mención ya
  es para todos.
- Cada sesión recibe el mensaje; a su aviso se le agrega una línea: "Dirigido a ti." si la mencionan, o "Dirigido a
  <nombres>: es informativo para ti; no respondas salvo que tengas algo que corregir." si no. Sin mención, igual que antes.
- En TTY la mención va en el color del mencionado; sin TTY, el texto como llegó.
- **Decidido al implementar, por revisar:** el punto final no es parte del nombre (`@lead.` menciona a lead), y en la
  vista se reconoce a quien alguna vez entró a la sala, porque el archivo no guarda las menciones.

## Nombres sin distinguir mayúsculas y tab (el dueño, 11-nov-2026; modo incremental: el disco y los comandos no cambian)
- `/invite Restaurant` y `/invite restaurant` resuelven a la misma sesión viva, y `@restaurant` menciona a `Restaurant`.
  Se muestra y se guarda el nombre real de la sesión.
- **Premisa:** no hay dos nombres que difieran solo en mayúsculas; por eso no se detecta ni se reporta ambigüedad.
- La entrega a un participante sigue siendo por nombre exacto: solo lo que tipea una persona se resuelve sin distinguir.
- Tab, con el `completer` de `readline`: `/` completa los comandos de `/help`; `/invite ` las sesiones vivas (las mismas que
  lee `invite`); `@` al inicio de palabra, los participantes de la sala. Se compara el prefijo sin distinguir mayúsculas.
- **Decidido al implementar, por revisar:** la completación de `@` incluye a quien escribe y a las personas.

## La persona se distingue y la ausencia se avisa (el dueño, 14-nov-2026; modo incremental: el disco y los comandos no cambian)
- En una sala donde contestan varias sesiones, la persona no encuentra su mensaje: sus líneas van marcadas en la vista
  en vivo, `/history` y `room read`. La persona es quien entró con `kind: person`: no hay segunda forma de saberlo.
- Sin terminal, la línea empieza con `>> ` (después del número de línea de `read`). En terminal, el mismo `>> ` y el
  nombre en negrita, invertido, amarillo 226 (fuera de los colores de nombre). Entradas, salidas y cuerpo no se marcan.
- Una sesión que hace `room say` y no hay ninguna persona en la sala en ese momento recibe una línea: `the person is not in
  this room`. Con una persona presente no se imprime nada; tampoco cuando quien escribe es la persona. Solo informa: no
  bloquea ni cambia la entrega.
- **Decidido al implementar, por revisar:** marca `>> ` y amarillo 226 (elegidos por contraste en fondo claro y oscuro);
  solo la cabecera se estiliza, no el cuerpo (el renderizador de markdown ya usa negrita y colores adentro).
- Casos (todos ✅): marca sin TTY y número primero · sin `people` nada se marca · estilo reservado en TTY · vista en vivo y
  `room read` marcan solo a la persona · TTY real: línea propia marcada y la de una sesión no · `say` avisa en sala solo de
  sesiones · no imprime con la persona presente y avisa cuando sale · la persona que hace `say` no recibe el aviso.

## Puesta en operación
| Commit | Versión | Deploy | Uso |
|---|---|---|---|
| pendiente | no se publica aún | enlace `~/bin/room` | pendiente |
