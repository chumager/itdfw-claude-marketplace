---
name: itdfw-deploy-config
description: Use when configuring an ITDFW deploy or a site within it — adding a site, giving a site its own database, declaring plugins, choosing which config file the process starts with (-c/-C, ITDFW_CONFIG_PATH/FILE), deciding whether a setting belongs in the config file or in the runtime Config model, or debugging why a site is not picking up its configuration.
---

# ITDFW Deploy Config — configurar un deploy y sus sites

Un **deploy** de ITDFW es un proceso que sirve uno o más **sites**. Todo lo que ese proceso necesita
para arrancar sale de un archivo de configuración; lo que cada site necesita para diferenciarse sale de
su propia carpeta. Este skill cubre eso.

## 1. 🔴 Los DOS niveles, y el criterio para elegir

Hay dos lugares donde vive configuración, y **la pregunta que decide no es de comodidad, es de arranque**:

> **¿El servicio puede partir sin este dato?**
> **NO** → archivo de configuración (nivel 1). **SÍ** → modelo `Config` en la BD (nivel 2).

| | Nivel 1 — archivo | Nivel 2 — modelo `Config` en BD |
|---|---|---|
| Cuándo | el dato se **requiere para iniciar** | el sistema **opera sin él** y lo pide después |
| Quién lo edita | quien despliega (root o dueño del site) | el usuario, por interfaz, sin redeploy |
| Alcance | por deploy / por site | por zona (multitenant), con `level` de permiso |
| Se aplica | al arrancar el proceso | **en caliente** (PubSub invalida `pool.Config`) |

**Los dos ejemplos que fijan el criterio:**

- **`Zones`** → va en el **archivo**. Es un plugin **estructural**: define cómo se filtran las queries de
  todo el sistema. Si no está desde el arranque, no tiene cómo polutar el sistema de queries — llega tarde.
  🔴 **Apagarlo en un deploy mono-zona NO es `Zones: false`**: el motor hace `pluginOptions[name] || undefined`,
  así que `false` se vuelve "sin options" y el plugin (GLOBAL) corre con defaults. La perilla está adentro del
  plugin: `Zones: {zoneOptions: false}` → `zones.js` retorna antes de tocar el schema (verificado 2026-09-03).
- **`Currency`** → va en el **nivel 2**. Un deploy arranca perfectamente sin saber su moneda; la necesita
  recién cuando alguien opera plata. Por eso un deploy que opera plata tiene su configuración de moneda **y no está en
  el yaml**: subió a nivel 2, con su `configDefinition`.

🔴 **El nivel 2 no es "el otro lugar donde poner cosas"**: es parte del flujo de operación del sistema —
cómo cada pieza declara sus propias necesidades. Un plugin que necesita config del usuario registra su
`configDefinition` y listo; no ensucia el archivo de arranque de nadie.

🔴 **Una Config CRÍTICA se registra con `level` bajo, de preferencia <= 100**: `setConfigDefinition(name, schema,
{level: 0})`. Crítica es todo lo que permitiría mal uso de la plataforma a un admin: api keys, credenciales de validadores
externos, cuentas bancarias o de pago, secretos de firma. Un admin no es el dueño: darle eso es darle al cajero acceso
a las cámaras del local. El `level` decide quién la ve y quién la edita; `send: false` dentro de la definición **no**
la protege. Sin `level` queda en 10000 y la ve cualquiera con lectura sobre Config. Ojo: el documento copia el `level`
al crearse, así que cambiar la definición no baja los documentos que ya existen. Se prueba en dos tiempos: con el
usuario en level 0 se ve y se edita; con level 100 no aparece en `tableData` ni se puede modificar.

⟹ Si te ves agregando al archivo algo que el servicio no necesita para levantarse, va en nivel 2.

## 2. El archivo de configuración — cuál se usa

```sh
node itdfwd.js                      # /etc/itdfw/config.{yaml,json,json5,js,cjs,mjs}
node itdfwd.js -C <deploy>          # /etc/itdfw/<deploy>.<ext>  — la extensión se resuelve sola
node itdfwd.js -c /otra/ruta        # cambia el directorio
```

| Flag | Env equivalente | Qué define |
|---|---|---|
| `-c` `--configPath` | `ITDFW_CONFIG_PATH` | el **directorio** (default `/etc/itdfw`) |
| `-C` `--configFile` | `ITDFW_CONFIG_FILE` | el **archivo** (absoluto, o relativo al directorio) |

🔴 **Que el archivo se elija por flag/env es lo que permite correr N deploys del FW en la misma máquina**,
cada uno con su configuración. No hay un archivo base fijo que amarre el arranque a un único punto de
entrada — se le pasan sus envs y conviven.

⟹ **Antes de editar nada, averigua qué archivo corre**: `ps aux | grep itdfwd` te muestra el `-C`. Editar
el archivo equivocado es el error más caro de esta área, porque no falla — simplemente no pasa nada.

Formatos soportados: `yaml`, `json`, `json5`, `js`, `cjs`, `mjs`.

## 3. Las DOS capas del nivel 1

```
/etc/itdfw/<deploy>.yaml          ← la base del deploy (la pone el admin)
   sites:
     <host>:                      ← bloque del site, dentro del archivo central

<documentRoot>/<host>/.itdfw.js   ← configuración PROPIA del site, en su carpeta
<documentRoot>/DEFAULT/.itdfw.js  ← lo común a todos los sites del deploy
```

**Es el patrón de `/etc/default` de Linux**: el admin fija la base en `/etc`, y quien despliega el site
ajusta lo suyo **sin necesitar acceso a `/etc`**.

### 🔴 El orden: el `.itdfw.js` del site GANA

Al arrancar, para cada carpeta del `documentRoot` se construye la config del site mezclando, **en este
orden de precedencia creciente**:

```
DEFAULT/.itdfw.js   →   bloque sites:<host> del /etc   →   <host>/.itdfw.js
   (lo común)              (lo que puso el admin)          (lo que pone el site) ← MANDA
```

Y encima de eso, al leer cualquier llave hay un **fallback a la raíz** del archivo central:

```
la llave existe en el site  →  se usa la del site
no existe                   →  se usa la de la raíz del /etc
```

⟹ Dos mecanismos encadenados: uno **construye** la config del site (merge de 3 fuentes), otro **resuelve**
cada llave (site → raíz). Ponés en la raíz lo común a todo el deploy, y en el site solo la diferencia.

### 🔴 Los sites se descubren por CARPETA, no por el archivo central

El arranque hace un `readdir` del `documentRoot`: **toda carpeta que no sea `DEFAULT` ni empiece con punto
se sirve como site**, tenga o no un bloque en `sites:`. El bloque central es **opcional** — existe para que
el admin pueda configurar un site desde `/etc`, no para autorizarlo.

⟹ Por eso un site completo se puede montar **sin tocar `/etc`**: carpeta + su `.itdfw.js`, y queda servido.

### Por qué `.itdfw.js` es JS (y por qué eso importa)

**Primero: porque ahí va CÓDIGO.** No es un archivo de valores con otra sintaxis — permite calcular,
condicionar y declarar funciones (ver `fastResponse` más abajo). Puede exportar un objeto o una función
(async incluida, si necesita resolver algo antes de entregar la config).

**Segundo: por la RESOLUCIÓN de los plugins.** Se declaran como **módulos importados**, no como nombres:

```js
// <documentRoot>/DEFAULT/.itdfw.js
import Config from "@chumager/itdfw-plugin-config";
import Chile from "@chumager/itdfw-plugin-chile";
import Financial from "@chumager/itdfw-plugin-financial";

export default {
  plugins: [Config, Financial, Chile()]   // Chile() = plugin parametrizable
};
```

### 🔴 Qué va en `.itdfw.js` y qué va en `/etc`: lo INHERENTE al site vs lo del AMBIENTE

| Va en el `.itdfw.js` (viaja con el site, igual en dev, QA y prod) | Va en `/etc/itdfw/<deploy>.yaml` (cambia por máquina) |
|---|---|
| `plugins`, `withDefault`, `fastResponse`, `genericPlaceholder`, `mongoosePlugins`, `alias` | `Hosts`, `devHost`, `devPort`, `Port`, `Protocol`, `fakeHTTPS`, `mongoURL`, `Procs`, credenciales |

La prueba: *si hago `git pull` del site en otra máquina, ¿tengo que tocar esta llave?* Si la respuesta es sí, la
llave es del ambiente y va en `/etc`. Un `devHost` en el `.itdfw.js` obliga a editar el site en cada máquina, y
además **le gana** al yaml (el `.itdfw.js` del site manda), así que el admin no lo puede corregir desde `/etc`. Se
puede escribir ahí, pero está mal (jcmunoz, 7-oct-2026: todos los sites del lab lo tenían, copiado de un ejemplo de
este skill).

🔴 **Un secreto que es la IDENTIDAD del site** (el par VAPID del push, la llave de firma de sus tokens) es igual en
toda máquina donde corra el site: por la prueba de arriba no es del ambiente. Dónde va lo decide **cada deployer**:
en el `.itdfw.js` viaja con el site (menos configuración de máquinas, pero lo ve todo el que tenga el git o el tar);
en `/etc` no queda en el repo (pero hay que copiarlo a cada máquina). El plugin lo lee con `configGet` y anda en los
dos lugares; no se le impone uno (jcmunoz 30-oct-2026, VAPID de notifications).

🔴 **Un nombre en texto no se puede resolver, y no es un problema de sintaxis.** Al consumidor le llega el
**merge ya hecho** — perdió de qué archivo vino cada entrada. Entonces `"mi-plugin"` ¿contra qué
`node_modules` se resuelve? Ni el `DEFAULT/` ni la carpeta del site están en el scope de importación de
quien recibe la config. La referencia queda huérfana.

Con un import, **la resolución ocurre donde se declara**: el `.itdfw.js` de DEFAULT resuelve contra su
propio contexto, el del site contra el suyo, y al merge llega un objeto ya resuelto. El import se lleva su
contexto consigo; el string lo pierde justo en el merge.

⟹ Y peor con el yaml de `/etc`: está **fuera del `documentRoot`**, así que desde ahí no hay contexto de
resolución posible. Por eso los plugins se declaran en el `.itdfw.js`, no en el archivo central.

### Dos perillas de corte

| | Qué hace |
|---|---|
| `withDefault: false` | el site **no hereda** `DEFAULT/.itdfw.js`. Declarable en el bloque `sites:` o en el `.itdfw.js` del site — cualquiera de los dos corta |
| archivo `.disabled` en la carpeta | el site **desaparece** del árbol: no se sirve |

## 4. Los tres accesores — hacen cosas DISTINTAS

Quien lee configuración desde el código elige uno de tres, y la diferencia importa al declarar la llave:

| Accesor | Comportamiento site vs raíz | Cuándo se usa |
|---|---|---|
| `configGet(k)` | el site **PISA** a la raíz | valores simples: `Port`, `mongoURL`, `Locale` |
| `configArray(k)` | **CONCATENA** site + raíz | listas que se suman: `plugins`, `alias`, `fastResponse` |
| `configMerge(k)` | **deep merge**, el site gana en colisión | objetos: `headers`, `env`, `mongoosePlugins` |

🔴 **Los arrays se concatenan en el merge**, no se reemplazan. Si la raíz declara plugins y el site también,
el site termina con **los dos conjuntos**, no con el suyo pisando al otro.

## 5. `fastResponse` — la config que ES código

`fastResponse` declara respuestas HTTP de bajo nivel **sin rutas ni métodos**: se evalúa antes que la app, contra el `req` crudo; es la prueba de que el `.itdfw.js` no es un yaml con otra sintaxis. Resuelve dos problemas: **Open Graph en una SPA** (el `type: "tag"` inyecta los `<meta property="og:…">` según la URL o el User-Agent del crawler, sin tocar el build) y el **healthcheck de un balanceador** (ALB/ELB pega a `/` sin cabecera `Host`; un `fastResponse` con `cond: {"headers.user-agent": /^ELB-HealthChecker/}` y `response: {type: "string", data: "Pong"}` responde 200 sin la app). 🔴 **No agregues `path` a esa condición**: el balanceador se identifica por su User-Agent. El `req` llega **COMPLETO**, incluido `req.db`, así que la respuesta puede consultar la BD; dos condiciones se aplican en AND (sift).

🔴 **Para armar URLs absolutas, los getters del `req`, nunca a mano**: `req.baseURL` (`protocolo://host`, respeta `fakeHTTPS`), `req.fullURL`, `req.pathURL` y `req.sameOrigin`. Sobre `baseURL` se compone con `new URL(path, req.baseURL)`; nunca `${req.protocol}://${req.get("Host")}`.

Los ejemplos completos (Open Graph con datos de la BD), la tabla de getters y por qué no a mano: [references/fast-response.md](references/fast-response.md).

## 6. 🔴 El archivo es ABIERTO — no hay whitelist

No existe una lista cerrada de llaves válidas. **Quien necesita una configuración, la pone en el archivo y
la lee con el accesor que corresponda.** Un plugin, un modelo o una punta pueden declarar la suya sin pedir
permiso a nadie y sin tocar el core — es el mismo criterio que las options de schema.

⟹ El inventario de abajo es **lo que el FW lee hoy**, no un contrato de lo que se puede escribir.

### Lo que el FW lee hoy

El inventario por área (servidor/HTTP, base de datos, sesión/auth, correo, licencia, operación, formularios), cada llave con su nota, está en [references/keys-catalog.md](references/keys-catalog.md). Lo que un deploy nuevo no puede olvidar:

- 🔴 **Dos llaves obligatorias para ARRANCAR** (no se adivinan): **`masterEmail`** (con `from`; sin ella el back muere antes de escuchar con `Cannot read properties of undefined (reading 'from')`; si no manda correo basta un transporte inerte) e **`instanceId`** (el fingerprint **de la máquina**; sin él arranca pero responde **423** `MACHINE_LOCK_VIOLATION` a todo).
- 🔴 **`Procs` multiplica por SITE**: cada carpeta del `documentRoot` es un host y cada host levanta `Procs` workers; un worker pesa ~250 MB de base. **`RAM ≈ sites × Procs × 250 MB`** más lo que más corra en la máquina.
- **Con valor por omisión**: `documentRoot` (`/var/www/itdfw`), `logs` (`/var/log/itdfw`), `logLevel` (`WARN`), `defaultPage` (`index.html`), `user` (`root`), `packageManager` (`pnpm`).
- **`bodyParser`**: tamaño máximo del cuerpo, por deploy o por site (10 mb por tipo por omisión); va en el archivo (nivel 1) porque el parser arranca antes de que carguen los modelos.
- Un deploy sin `html/index.html` arranca igual en modo **HEADLESS** (solo API), con un WARN.

### 🔴 El modo test: la llave `test`, y por qué no sale a producción

`test` es una llave del site: va en la **raíz** de su `.itdfw.js` o en el yaml (`sites.<host>.test`), con la
precedencia de siempre (el `.itdfw.js` del site gana). El back la lee con `configGet("test")`.

| Dónde | Qué pasa con `test` encendida |
|---|---|
| el back, al arrancar | el **primer worker** del site registra un **WARN** `TEST` en desarrollo y un **ERROR** `TEST` en producción (`onDev` falso). En producción solo las pruebas finales previas a un release corren así: la llave se saca antes de publicar |
| `guard` (pre-push) y `publish` de `itdfw-deps` | **frenan** si el `.itdfw.js` de algún site del workspace trae `test` activo, o si no se puede importar (no se sabe si la trae). Solo se lee el `.itdfw.js`, que viaja con el repo; el yaml es de cada máquina y no se revisa |

Hoy esa llave solo la leen el aviso del back y esos dos controles: no abre ni cierra nada por sí misma. Es una
**definición**, no una regla del código: quien la deja encendida lo ve en el log y el publish lo frena.

## 6. Agregar un site a un deploy existente

### 🔴 El nombre de la carpeta ES el hostname

La carpeta bajo `documentRoot` **debe llamarse igual** que la clave del bloque `sites:`, y ese nombre entra
solo a la lista de vhosts junto con `Hosts` y `devHost`. Si no coinciden, el bloque `sites:` **se ignora en
silencio** y el site levanta solo con lo que herede de DEFAULT.

```
<documentRoot>/
  DEFAULT/                        .itdfw.js con lo común (plugins)
  sitio-a.example.org/            ← el nombre es el host
  sitio-b.example.org/
```

### Los pasos

1. **Carpeta** con el nombre del host, replicando la estructura de un site que ya exista
   (`mongooseSchema/`, `mongoosePlugins/`, `mongooseTypes/`, `mongooseDB/`, `FWPlugins/`, `APP/`, `html/`).
2. **Su `package.json`** si el `documentRoot` es un workspace pnpm (`packages: ["*"]` toma cada carpeta).
3. **Su configuración**: en el `.itdfw.js` de la carpeta (no necesita `/etc`), o en el bloque `sites:` del
   archivo central. **Nada** si alcanza con heredar de DEFAULT.
4. **Reiniciar el proceso.** El archivo se lee una sola vez al arrancar; no hay watch propio. (En dev suele
   haber un `nodemon` que vigila el `documentRoot` y `/etc/itdfw` y reinicia solo.)

### Darle su propia base de datos

Un `mongoURL` en el site basta: cada site abre **su propia conexión**, así que sus modelos y datos quedan
separados de los demás aunque compartan réplica.

```js
// <documentRoot>/mi-site.ejemplo.cl/.itdfw.js
export default {
  mongoURL: "mongodb+srv://usuario:clave@cluster.mongodb.net/mi-site?appName=mi-site"
};
```

🔴 **Sin esto, todos los sites del deploy comparten la BD de la raíz.** Y eso incluye los modelos definidos
en BD (`DBModelRaw`, skill `itdfw-db-models`): un modelo creado en un site **aparece en todos los demás**,
porque el PubSub lo anuncia a todos los workers de esa base. Si el aislamiento entre sites importa, la BD
propia no es opcional.

⚠️ El usuario de la base tiene que tener permiso sobre la BD nueva; eso se resuelve en el motor, no acá.

🔴 **Así se aíslan los tenants de un SaaS: una BD por tenant, no zones** (jcmunoz 31-oct-2026). Misma réplica, una
base por tenant, cada una con **su propio usuario de Mongo**, con permiso solo sobre su base. Un usuario administrador
del cluster crea esos usuarios, y ningún site usa el usuario de poder total. Así nadie ve ni entra a otra base, y lo
que un tenant haga en la suya solo alcanza sus datos. Zones (varios tenants en una misma BD) es para el servicio que
necesita una vista sobre todos los tenants a la vez; se decide por servicio y va apagado por omisión (`Zones:
{zoneOptions: false}`, arriba). Superficie de ataque completa: skill `tdd-narrativo` §2g.

## 7. 🔴 Dónde termina este skill

El FW provee `Hosts`, `Port` y `Protocol`. **Ahí termina su responsabilidad.**

Cómo se resuelve ese nombre (DNS, `/etc/hosts`), si hay TLS y quién lo termina, si hay balanceador — **nada
de eso es del framework**. Un deploy perfectamente válido corre con `/etc/hosts` sobre HTTP, sin balanceo y
sin certificados.

⟹ Si la tarea pide DNS, certificados o balanceo, eso es de la capa de infraestructura: se chutea a quien
tenga esa pega, no se inventa acá.

## Red flags

- Editar `/etc/itdfw/config.yaml` sin haber corrido `ps aux | grep itdfwd` → puede que el proceso corra con
  otro archivo y tu cambio no haga nada.
- Poner en el archivo algo que el servicio **no necesita para arrancar** → eso es nivel 2.
- Carpeta del site con nombre distinto a la clave de `sites:` → el bloque se ignora sin avisar.
- Asumir que el bloque `sites:` de `/etc` pisa al `.itdfw.js` del site → es al revés.
- Esperar que un cambio en el archivo se aplique en caliente → se lee al arrancar.
- Documentar DNS/TLS/balanceo como parte de la configuración del FW → no lo es.

## Skills hermanos

| Skill | Para qué |
|---|---|
| **`itdfw-db-models`** | modelos definidos en la BD — y por qué comparten base si los sites comparten `mongoURL` |
| **`itdfw-fwplugin`** | qué es un plugin de los que van en `plugins` |
| **`itdfw-front-app`** | el CLI del front (`-c`/`-C`, `devHost`) y la cascada del front |
| **`itdfw-models`** | dónde vive un modelo según `documentRoot` (DEFAULT vs site) |

