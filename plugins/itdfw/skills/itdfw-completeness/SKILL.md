---
name: itdfw-completeness
description: Use BEFORE declaring any ITDFW task done — the "definition of done" of the framework. Invoke when you finished implementing a custom type, a FWPlugin, a mongoose plugin, a component, an endpoint, or any change, and are about to say "listo"/"funciona"/"done". Covers what tests are expected (green/red, e2e, memleak with WeakRef+gc+canario), how to declare tests that don't get deleted (onDev-gated), logging levels for debugging (front $log/$logDebug, back Log.XXX + logLevel), and the completeness critic (what else did I touch that I didn't verify). 🔴 This is a SERVICE, not a browser — zero memleaks of any kind, proven not assumed. Every other itdfw-* skill points here at its close.
---

# ITDFW Completeness — la puerta de salida

El "definition of done" transversal del FW. **No es un gate de entrada** (que se saltea), es el **cierre**:
llegás acá cuando *creés* que terminaste, y el checklist te muestra lo que NO probaste. Todos los skills
`itdfw-*` apuntan acá al final.

## 🔴 Todo cambio viene con su prueba, y el componente la DECLARA (`@spec`)

Un cambio en un componente, type o plugin no está hecho sin la prueba que lo cubre, y esa prueba se declara en el
JSDoc del componente con `@spec <ruta del spec>` (uno por línea). Quien vuelva a tocarlo sabe qué correr sin
adivinar. Si agregas o cambias una prueba, agrega o corrige su `@spec`. Si el componente no tenía ninguno, este
cambio es el que lo estrena.

"La prueba que lo cubre" se lee sobre el GRAFO de pruebas, no un test por cambio: si el cambio ya queda recorrido por
specs existentes, no se agrega uno nuevo; se agrega solo para el nodo que quedó colgando, y no se escribe un spec
dedicado a un mecanismo que ya recorren N specs (`tdd-narrativo` §4, "Las pruebas son un GRAFO").

## 🔴 El encuadre: esto es un SERVICIO, no un browser

Un browser se refresca y chao — un memleak vive segundos. **El back del FW es un servicio long-running**:
un memleak de cualquier tipo crece request a request hasta caer. **No se parchea con un level-0 que mira la
RAM y reinicia** — eso es de rotos. La correctitud se **prueba, no se asume**. Por eso el done del FW exige
verificación real, no "compila y se ve bien".

## Checklist de done (creá un todo por ítem que aplique)

- [ ] **Probado lo que hiciste** — según la tabla de abajo (no "lo probé a ojo": test ejecutable).
- [ ] **Memleak descartado** si tocaste algo con **retención** (EE del doc, hooks `pre/post`, globals,
      cache, singletons, `pool`, closures que capturan el doc) → `WeakRef`+`gc()`+**canario**. → [memleak-testing.md](references/memleak-testing.md)
- [ ] **Completitud** — el critic: *"¿qué MÁS toqué (herencia, consumers, side-effects) que quedó sin probar?"*
      Ampliá el scope antes de cerrar.
- [ ] **Tests gateados `onDev`, NO borrados** — viven en el código como red de seguridad. → [test-discipline.md](references/test-discipline.md)
- [ ] **Modo test fuera de lo que se publica** — si probaste con la llave `test` de la config del site (`itdfw-deploy-config`, § «El modo test»), se saca antes de publicar: en producción es un ERROR en el log y `guard`/`publish` la frenan.
- [ ] **Los datos de la prueba se borran, la vitrina queda** — el modo de borrado lo decide el modelo (un modelo
      solo de prueba declara `deleteMode: "hard"`; una colección solo de prueba se elimina entera), y el reporte trae
      la URL de la vitrina y qué mirar. → [test-discipline.md](references/test-discipline.md)
- [ ] **Ninguna verificación quedó como RITUAL MANUAL** — si el resultado es un número/conteo (renders por
      tecla, requests, ms, "¿reaccionó alguien más?"), se automatiza EN EL ACTO. Una prueba cara no se
      repite, y su número caduca callado cuando cambia el régimen. → [test-discipline.md](references/test-discipline.md)
- [ ] **Logs con niveles** instrumentados (y el debug ruidoso apagado por config, no borrado). → [logging.md](references/logging.md)
- [ ] 🔴 **`aiDescription` en todo lo nuevo que se declara**: modelo (`schema.options`), campo, punta (`API`/`APP/`) y
      type (`options`). Es lo que lee un LLM por MCP o la paleta para elegir; sin ella elige por la `description`
      corta y se equivoca. Qué es, para qué se usa y qué NO es si hay un vecino parecido; en inglés. Lo dudoso no se
      inventa: queda como pendiente. Detalle: `itdfw-models` §3-4, `itdfw-api-system` §Quick endpoint shape.
- [ ] 🔴 **La VERTICAL cerrada** si tocaste un componente o un tipo propio: **XLS y PDF**. Es la salida menos
      reversible (un contrato o una planilla que ya salió al cliente) y la que más depende de contexto
      goteado — locale, moneda, request. Un test unitario del objeto de valor NO la ejerce: el objeto
      formatea bien aunque el pipe que le entrega el locale esté roto. Y es barata: `toPDF` devuelve un
      `{text, ...style}` plano → se afirma sobre el objeto, **sin renderizar el archivo**.
- [ ] **Validación externa** — el "Done" no se da sobre tu propio testing: e2e real / browser / datos reales,
      y ese e2e lo escribe y lo corre QA, no quien implementó (§ "Quién prueba qué"). Lo que vos probás prueba que
      TU modelo mental anda, no que el sistema anda.

## 🔴 Quién prueba qué

| Quién | Qué prueba |
|---|---|
| quien implementa (el PMO y sus esclavos) | **headless**: lo que declara en su TDD, su back y su lógica |
| QA | **todo e2e**, por complejo que sea: el recorrido completo por pantalla contra el back real, la UI/UX y las capturas, sin repetir lo headless |

- Ni el PMO ni el designer ni core escriben ni commitean un spec e2e: quien prueba lo propio en pantalla prueba lo
  que él entendió. Si QA necesita definiciones o un scope inicial, se le dan **en prosa** (casos, datos, qué
  observar), no como spec. Un spec e2e que ya tenías escrito se le entrega a QA como insumo.
- Los specs e2e que ya viven en `plugins/*/test/e2e` y `fronts/*/test` siguen donde están, pero son de QA: no se
  borran ni se reescriben de golpe.
- El control propio de quien implementa (una sonda o una captura en su tmp antes de entregar) se permite: no se
  commitea y no reemplaza nada de QA.

## Tabla: hiciste X → se espera Y

| Hiciste… | Pruebas esperadas |
|---|---|
| **custom type / Value Object** | `cast`/`parse`/`toBSON`/`toJSON` **green + red** (molde: `itdfw-mongoose-types/templates/*.test.js`) · 🔴 **+ la VERTICAL: un caso de descarga XLS y uno de PDF** |
| **FWPlugin / plugin con EE, hooks, globals, cache, closures-con-doc** | **memleak** (`WeakRef`+`gc()`+canario) + green/red de la lógica |
| **componente front** | headless de su lógica, lo que declara el TDD · 🔴 **el e2e de pantalla es de QA, no de quien implementa**: se le entrega el scope en prosa (casos, datos, qué observar: render por cada `mode`/`viewType`, entrar/SALIR de cada estado, anónimo Y logueado, claro Y oscuro, al ancho del celu real ~360 px, pulgar, sin red / vacío / nombre largo) y QA arma y corre el spec (`@playwright/test` por consola; **🔴 JAMÁS por un MCP de browser**: devuelve la página entera por llamada y quema el límite semanal; el spec queda, la sesión MCP no — rule `e2e-programatico-nunca-mcp`). El recorrido de usuario (rule `sombrero-de-usuario`) lo hace QA · 🔴 **+ la VERTICAL: un caso de descarga XLS y uno de PDF** |
| **endpoint / API** | el verbo correcto gateado (401/403/404 según la tríada), ext obligatoria |
| **mongoose plugin (global/filtered/named)** | que el modelo objetivo lo reciba (o NO, si no aplica) + idempotencia del re-cast |
| **cualquier cosa** | completitud critic + logs con niveles + validación externa |
| **cualquier cosa, para decir TERMINADO** | 🔴 **está OPERANDO**: commit + versión publicada + deploy nombrado + alguien lo usó (evidencia). "Probado" ≠ "terminado": el auth-chain estuvo 90 verdes y cuatro días sin deploy (skill `tdd-narrativo` §6) |
| **pruebas contra el back con JWT / headless** | 🔴 JWT es el camino headless/MCP, ya autenticado; el front espera SESIÓN (un 401 corta, encola y pide login). Un arnés por JWT no reproduce el flujo del navegador: dos "defectos" reportados el 15-sep-2026 eran el arnés |

## 🔴 Por qué este skill existe

La disciplina de cierre vivía dispersa (logs condicionales, probar-antes-de-documentar, no-Done-sobre-mi-
testing, TDD onDev) — folklore repetido en memorias sueltas. Acá se vuelve **canónica y citable**: un solo
lugar al que todo skill apunta. Crece orgánico: a medida que hagamos cosas nuevas dependientes de los
skills, lo que falte se agrega acá.

## References

| Reference | Read when |
|-----------|-----------|
| [memleak-testing.md](references/memleak-testing.md) | Tocaste algo con retención (EE/hooks/globals/cache) → patrón WeakRef+gc+canario |
| [test-discipline.md](references/test-discipline.md) | Cómo declarar tests green/red, gateados onDev (no borrar), e2e |
| [logging.md](references/logging.md) | Instrumentar logs con niveles: front `$log`/`$logDebug`, back `Log.XXX` + `logLevel` |
