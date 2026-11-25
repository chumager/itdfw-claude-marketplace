# Lo que el FW lee hoy — inventario de llaves, `Procs`, `bodyParser` y llaves obligatorias

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los ejemplos y el inventario.

### Lo que el FW lee hoy

| Área | Llaves |
|---|---|
| Servidor / HTTP | `Hosts` `devHost` `devPort` (puerto de entrada en dev detrás de un proxy reverso; sin él, `Port`; ver `itdfw-front-app` §La URL de dev) `Port` `Protocol` `fakeHTTPS` `greenLock` `Procs` `env` `trustProxy` `headers` `cors` `alias` `fastResponse` `bodyParser` `csrf` `maxConcurrentRequests` `retryAfterSeconds` `defaultPage` `documentRoot` `apiPath` |
| Base de datos | `mongoURL` `mongoOptions` `noLock` `mongoosePlugins` · `pubsubChannel: "<nombre>"`: el canal de `run`, `action`, `actionSelf` y SSE, en vez del nombre del site (por ejemplo, dominios distintos de un multitenant que comparten canal para repartir la carga, independiente de la BD) |
| Sesión / auth | `session` `Expire` `masterPassword` `authorizationZones` |
| Correo | `emailTransport` `masterEmail` `recoveryEmail` `errorRecipients` `recaptcha` |
| Licencia | `instanceId` `machineLockedMessage` |
| Operación | `logLevel` `logs` `Locale` `withDefault` `plugins` `test` (ver §«El modo test») |
| Formularios | `genericPlaceholder` — objeto por **type** (`{generic: "Ingrese un valor", Email: "correo@dominio.cl"}`), leído con `configMerge` (el site pisa por llave); `toInput` lo pone en todo input que no declare `placeholder` ni lo traiga su type, y sin la llave usa `"Enter data"`. Fijo por site → `.itdfw.js`; por deploy → el yaml. El front lo traduce como cualquier texto |

🔴 **`Procs` multiplica por SITE, y el peso son los modelos.** Cada carpeta del `documentRoot` es un host (el FW no
resuelve DNS: escucha en la IP y solo mira el `Host` para enrutar), y cada host levanta `Procs` workers. Un worker
pesa ~250 MB de base (los modelos de `DEFAULT/` + los del FW, 10-15 MB cada uno; las puntas y el proceso en sí son
marginales) y cada modelo propio suma de verdad. Regla rápida: `RAM ≈ sites × Procs × 250 MB` + lo que más corra en
la máquina. Ejemplo (máquina de 4 GB): tres carpetas nuevas en la raíz × `Procs: 5` + tres procesos de
~400 MB = thrashing y reboot. El arreglo es bajar `Procs` y limpiar la raíz, no el FW. (Capacity planning fino queda
para su propio skill.)

Con valor por omisión aunque no los declares: `documentRoot` (`/var/www/itdfw`), `logs` (`/var/log/itdfw`),
`logLevel` (`WARN`), `defaultPage` (`index.html`), `user` (`root`), `packageManager` (`pnpm`).

**`bodyParser`** — tamaño máximo del cuerpo, por deploy o por site (desde back 7.3.5 hay UN parser por tipo, al
inicio de la cadena; antes había dos y mandaba el primero con 100 kb → **413** en cualquier form gordo):

```yaml
bodyParser:
  json: {limit: 10mb}                      # default 10mb
  urlencoded: {limit: 10mb, extended: true} # default 10mb
```

Va en el archivo (nivel 1) porque el parser arranca antes de que carguen los modelos. `req.rawBody` existe siempre
(los webhooks firmados verifican el HMAC sobre los bytes exactos). Los archivos van por multipart (`multer`), no por
este límite; desde 7.3.6 el nombre del archivo subido llega en UTF-8 (`defParamCharset`), antes en latin1.

🔴 **Dos llaves obligatorias para ARRANCAR que no se adivinan** (al armar `/etc/itdfw/dev.yaml`):

| Llave | Sin ella | Qué poner en un deploy nuevo |
|---|---|---|
| `masterEmail` (con `from`) | muere antes de escuchar: `Cannot read properties of undefined (reading 'from')` — el appender de log por email se arma al inicio | si no manda correo, un transporte inerte basta: `{host: localhost, port: 25, secure: false, from: "…"}`. **No copies credenciales SES a un deploy que no las necesita** |
| `instanceId` | arranca pero responde **423** `MACHINE_LOCK_VIOLATION` a todo (`No machine fingerprint configured`) | es el fingerprint **de la máquina**: en la misma máquina se reusa el de otro deploy; en una nueva se genera con el flujo de licencia |

Un deploy sin `html/index.html` arranca igual en modo **HEADLESS** (solo API) — lo avisa con un WARN, no es error.

