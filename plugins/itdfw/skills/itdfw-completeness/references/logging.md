# Logging con niveles — front vs back

Instrumentá con logs **desde el inicio** del desarrollo, con niveles, y **apagá por config** (no borres) al
cerrar. El FW tiene dos sistemas distintos según el lado.

## Front — `$log` / `$logDebug` (loaders)

Dos loaders que gobiernan el logging de un componente:
- **`$log: true`** → **activa** el logging del componente (sin esto, `this.log` es no-op).
- **`$logDebug: true`** → **despliega** los logs de nivel debug (el detalle ruidoso).

`this.log` es un **Proxy condicional**: si el activador está off, es no-op (cero costo, no rompe). 🔴 **Nunca
borres `this.log`** al terminar — es infraestructura permanente; lo que se quita es el `$logDebug`/los logs de
debug puntuales que pusiste para cazar un bug. El activador apagado ya los silencia.

```js
// en el componente
this.log("flujo normal");        // visible si $log
this.log.debug?.("detalle");     // visible si $log + $logDebug
```

## Back — `Log.XXX` + `logLevel` en YAML

- Llamás **`Log.XXX`** (`Log.info`, `Log.warn`, `Log.error`, `Log.debug`, …) — `/* global Log */`.
- El nivel se configura en **cualquiera de los dos YAML de configuración** (el del sistema
  `/etc/itdfw/config.yaml` o el del sitio) con la llave **`logLevel: <VALOR_UPPERCASE>`**
  (ej. `logLevel: DEBUG`, `INFO`, `WARN`, `ERROR`).
- El `logLevel` filtra qué se despliega: en `INFO` no ves los `Log.debug`; en `DEBUG` ves todo.

```yaml
# config.yaml (sistema o sitio)
logLevel: DEBUG   # uppercase
```

## Principio común

Instrumentar **desde el inicio** (no después de que algo falla), con el nivel adecuado, y **gatear por config
en vez de borrar**. El logging permanente es barato (no-op / filtrado) y es la red que te deja diagnosticar en
producción sin redeployar con `console.log`. Corregir es la versión disciplinada de "poné logs para depurar":
los logs se quedan, apagados por config.
